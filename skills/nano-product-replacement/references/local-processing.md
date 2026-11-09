# 本地处理合同

通过 `nano-product-replacement version` 和 `capabilities --json` 核验当前包。Node.js 22+ 与打包依赖 sharp 是本地处理所需运行时。CLI 不生成、不上传、不读取服务凭据。文件存在时返回 `OUTPUT_EXISTS`，使用新路径。

## 1. 核验入口，按需检查显示方向

使用已安装的公开 CLI；所有命令返回 JSON，失败时非零退出，错误在 `error.code` / `error.message`。以下 `TASK` 是执行 Agent 解析的任务目录占位符，不是内置环境变量；输入和输出路径均需替换为本次真实路径，路径含空格时作为一个参数传入。PowerShell 同样调用该 CLI，不依赖 shell 专属脚本。先检查输出路径，所有检查目录和结果文件均使用未占用的新路径。

```text
nano-product-replacement version
nano-product-replacement capabilities --json
nano-product-replacement doctor --json
```

核对能力含 `outward-feather`、`simple-polygon-validation`，`local_ready=true`。需要检查辅助时，包另有 `coordinate-inspection` 和 `local-warm-pixel-protection`。旧版缺少所需能力时，走包的安装/更新流程；尚无可用版本时报告 `CAPABILITY_UNAVAILABLE`，保留当前输入。普通任务不修改包或 Skill。受管安装后的上述所属包命令均通过本 Skill 的 `scripts/run.mjs` 与当前 Node.js 调用。

默认直接查看原图，沿产品轮廓记录顶点；不把网格图或放大坐标图作为固定前置步骤。图片方向不明确、坐标需要辅助或接触边缘难以判断时，可调用：

```text
nano-product-replacement inspect --source TASK/source.png --output-directory TASK/inspect-source-v1 --json
```

`inspect` 产生 `oriented.png`、`coordinate-grid.png` 和 `inspection.json`。前两张同像素尺寸；网格标注为全图像素，不是百分比。需要归正方向时后续以 `oriented.png` 为 source。`inspection.json.width/height` 为归正尺寸，不能凭原始 EXIF 宽高猜坐标。无法可靠查看图像或识别轮廓时报告缺口，不以矩形或猜测坐标冒充完成。

## 2. 按轮廓编写区域 JSON

先实际查看原图。输入图片解码后按 EXIF 显示方向归正，坐标以归正后的像素宽高为准。输出与归正图保持同像素尺寸。PNG、JPEG、WebP 的静态图片均可使用。

区域为 UTF-8 JSON：

```json
{
  "coordinate_width": 1000,
  "coordinate_height": 800,
  "cover": [{"points": [[100,200],[350,160],[500,200],[550,600],[300,650],[100,600]]}],
  "protect": [{"points": [[250,250],[350,250],[350,400],[250,400]], "grow": 0}],
  "check_areas": [{"id":"contact-upper", "rect":[200,200,200,250]}]
}
```

示例只有语法意义，坐标不能套用到新图片。沿边界连续取点，顺时针或逆时针均可；CLI 自动闭合末点到首点，允许显式重复首点作为闭合标记。其余顶点应互异。多边形必须有面积、边不自相交、不折返重叠、坐标落在 `[0, coordinate_width] × [0, coordinate_height]` 内。复杂曲线按实际轮廓增加顶点，分离小块分别列入 cover。CLI 会拒绝无效几何，但无法判断有效多边形是否选中了正确商品。

每个多边形 3–4096 点，cover 与 protect 合计不超过 256 个。坐标比例与归正图一致（允许 0.5% 比例误差）。默认使用原尺寸坐标；若确需按缩略图标注，将其完整宽高作为 coordinate_width/height，由 CLI 等比例映射，不能混用两套坐标。局部裁图里的坐标先按 inspection.json 的映射转回全图坐标，再按所声明的区域坐标系换算。

`cover[].grow` 默认坐标短边 1.5%，显式值是该坐标系的外扩距离，0 表示选区本身已有余量。`protect[].grow` 默认 0，在产品外扩后扣除，形成硬选区。长毛、尾巴或接触处识别不确定时，可局部增大 grow；不依赖固定余量自动解决遗漏。

`feather` 是归正原图像素中的柔边宽度，整数 0–80；省略时取原图短边的 1%，四舍五入并限制在 80 以内。2048×1536 图默认 15。先将扣除保护后的硬选区向外扩 feather，再模糊，与硬选区逐像素取较大遮挡值：硬选区内保持原有遮挡强度，纯黑部分不会因虚化透出旧产品。过渡带在硬选区外侧，也会进入保护区边缘；紧贴产品的少量人物边缘可变暗，窄手腕等小保护区需要实际查看，必要时减小 feather。显式 `"feather": 0` 使用硬边并保持保护像素。`mask-output` 保存最终实际遮挡权重，包含柔边。

保护区沿人物关键部位绘制并略向人物内侧收；两只手、前臂和头发分别处理，接触的产品、指缝与手臂间隙仍属于 cover。允许多盖产品周围一圈背景及少量接触人物边缘，不大面积涂掉脸、手等关键部位。眼睛、鼻子、暗色产品部件的颜色不能作为人物保护依据。普通 protect 从硬选区中扣除整个多边形，后续柔边可能使其边缘变暗。

### 可选：局部暖色像素保护

几何保护难以贴合皮肤边缘、且局部图能确认皮肤与产品颜色可分时，可以给该 protect 增加：

```json
"selection": {"type":"warm-pixels", "min_red_green":6, "min_green_blue":8}
```

这不是语义皮肤模型。它仅在该多边形的局部范围内，保留原图像素同时满足 `R-G > min_red_green` 和 `G-B > min_green_blue` 的部分；差值以 0–255 RGB 为单位，默认分别为 6 和 8，参数范围 0–255。不满足条件的像素继续被 cover 遮黑。判断使用归正原图，多个 protect 取并集，再从 cover 中扣除；暖色模式不执行自动膨胀、闭运算或全图分类。

先选择贴近已确认皮肤的小范围 ROI，再检查绿色选中像素是否只覆盖人物。暖色产品可能同样满足条件，偏色光照或部分肤色可能不满足条件；此时缩小 ROI 或改用普通几何 protect，回到预览检查。头发和衣服使用普通 protect。运行时不复写该算法、不根据颜色名临时发明 HSV 阈值。

## 3. 按需预览选区与接触部位

轮廓或接触边界需要辅助时使用本节；能够直接查看原图并可靠标注时，可直接执行第 4 步。

```text
nano-product-replacement inspect --source TASK/inspect-source-v1/oriented.png --regions TASK/regions-v1.json --output-directory TASK/inspect-regions-v1 --json
```

有 regions 时额外输出 `regions-overlay.png`：洋红色为实际遮挡权重（含柔边），绿色为保护区中保留下来的部分，原图保持可见。它与 blackout 共用像素选择逻辑。检查覆盖范围、人物主体保护及接触处，保护区中不得因退让过多而残留旧产品。

每个 protect 自动输出 `protect-1.png` 等原像素局部图，并加周边余量；`check_areas` 另外指定需要核验的产品边缘和接触部位，最多 32 个。每项 `id` 唯一，仅用英文、数字、下划线、连字符（1–64 字符）；`rect=[left,top,width,height]` 使用区域文件的坐标系，必须在画布内。

裁图不缩放。`inspection.json.crops` 记录每张裁图的全图像素 left/top/width/height：`global_x=left+local_x`、`global_y=top+local_y`。还原全图后，再乘 coordinate_width/width、coordinate_height/height 写回区域文件。检查目录另外返回 mask_fraction（涂黑权重占比）；超过 80% 提示检查背景与人物，任何面积数值都不自动代表通过。

## 4. 涂黑并检查实际结果

```text
nano-product-replacement blackout --source TASK/source.png --regions TASK/regions-v1.json --output TASK/masked-base-v1.png --mask-output TASK/mask-v1.png --json
```

若前面已归正方向，source 改用检查目录中的 oriented.png。`mask-output` 可选，是黑底白选区及灰色柔边检查图，不传给生成服务。结果 JSON 含实际宽高、feather、默认 grow、文件路径和涂黑图哈希。

运行后必须实际查看 masked-base 全图；耳尖、脚、尾巴、指缝或接触处可疑时再检查原像素局部。需要 CLI 裁图辅助时调用：

```text
nano-product-replacement inspect --source TASK/masked-base-v1.png --regions TASK/regions-v1.json --output-directory TASK/inspect-masked-v1 --json
```

这次 inspect 中的 `oriented.png` 就是本轮涂黑结果，`protect-*.png` 与 `check-*.png` 是该结果的原像素裁图。最终验收以真实像素为准，不以重绘的 overlay 为准。

逐项通过后才进入生图：旧产品纹理、原色细边及毛边全部遮住；人物主体和无关背景保留；指缝与手臂间隙没有产品残片；允许产品周围背景和少量接触人物边缘被多盖。若关键人物部位被大面积遮挡，修正 protect 或减小柔边；若保护区残留产品，收窄 protect；若产品边缘漏涂，调整局部 cover 或 grow。每次修改另存 regions-v2.json、masked-base-v2.png 等新路径并重查，不能在不合格底图上继续生图。用户只要求预览涂黑时到此交付，不提交付费生成。

### 错误与能力边界

| error.code / 情况 | 处理与返回点 |
| --- | --- |
| INVALID_REGIONS | 按错误里的多边形索引或字段修正 JSON，回到步骤 2；自相交需重新按边界顺序排列顶点 |
| OUTPUT_EXISTS | 保留旧文件，选择新版本路径，重试当前命令 |
| INVALID_INPUT | 核对真实输入文件、必需参数与输出扩展名，重试当前命令 |
| 看图无返回、图像不可访问或接触边界无法判断 | 保留当前输出，报告视觉检查未完成，停在步骤 3/4 |
| CLI 不支持所需操作 | 报告 CAPABILITY_UNAVAILABLE，通过正式维护扩展工具，普通运行不写临时像素算法 |

所有本地命令只读输入、排他创建输出，不上传图片，不调用生成服务。检查用栅格和裁图是测量工具；轮廓识别与业务验收仍由当前 Agent 根据实际图片完成。

## 5. 收集生成结果

使用媒体能力取得终态任务 JSON，保留已下载文件路径；本地相对路径按任务 JSON 所在目录解析。接收顶层任务或 `{ "task": ... }` 包装，`status` 为 succeeded、partial 或 failed，且存在 1–64 个有效本地图片 artifacts。无本地图片时返回错误，保留原任务以继续下载或诊断。

```json
{"task_id":"TASK_ID","status":"succeeded","requested_count":4,"model":"SELECTED_MODEL","artifacts":[{"path":"generated/image.png","sha256":"OPTIONAL_SHA256"}]}
```

```text
nano-product-replacement collect --task-json TASK/result.json --output-directory TASK/new-delivery --json
```

先验证全部输入及可选哈希，再创建全新交付目录。按实际解码格式保存原始字节，输出 result-01 等文件、实际尺寸及 SHA256 的 `files.json`，多于 1 张时生成 `comparison.jpg`。四张采用 2×2 编号，不拉伸图像。部分任务缺数照实返回，保留所有已有结果。
