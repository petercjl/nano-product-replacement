# 本地处理合同

通过 `nano-product-replacement version` 和 `capabilities --json` 核验当前包。Node.js 22+ 与打包依赖 sharp 是本地处理所需运行时。CLI 不生成、不上传、不读取服务凭据。文件存在时返回 `OUTPUT_EXISTS`，使用新路径。

## 1. 核验入口并生成坐标图

使用已安装的公开 CLI；所有命令返回 JSON，失败时非零退出，错误在 `error.code` / `error.message`。以下 `TASK` 是执行 Agent 解析的任务目录占位符，不是内置环境变量；输入和输出路径均需替换为本次真实路径，路径含空格时作为一个参数传入。PowerShell 同样调用该 CLI，不依赖 shell 专属脚本。先检查输出路径，所有检查目录和结果文件均使用未占用的新路径。

```text
nano-product-replacement version
nano-product-replacement capabilities --json
nano-product-replacement doctor --json
nano-product-replacement inspect --source TASK/source.png --output-directory TASK/inspect-source-v1 --json
```

核对能力含 `coordinate-inspection`、`simple-polygon-validation` 和 `local-warm-pixel-protection`，`local_ready=true`。旧版缺少这些能力时，走包的安装/更新流程；尚无可用版本时报告 `CAPABILITY_UNAVAILABLE`，保留当前输入。普通任务不修改包或 Skill。

`inspect` 产生 `oriented.png`、`coordinate-grid.png` 和 `inspection.json`。前两张同像素尺寸，实际查看原图与网格图；网格标注为全图像素，不是百分比。后续以 `oriented.png` 为 source，统一显示方向。`inspection.json.width/height` 为归正尺寸；声明区域时默认使用相同 `coordinate_width/height`，不凭原始 EXIF 宽高猜坐标。

## 2. 按轮廓编写区域 JSON

先实际查看原图。输入图片解码后按 EXIF 显示方向归正，坐标以归正后的像素宽高为准。输出与归正图保持同像素尺寸。PNG、JPEG、WebP 的静态图片均可使用。

区域为 UTF-8 JSON：

```json
{
  "coordinate_width": 1000,
  "coordinate_height": 800,
  "cover": [{"points": [[100,200],[350,160],[500,200],[550,600],[300,650],[100,600]]}],
  "protect": [{"points": [[250,250],[350,250],[350,400],[250,400]], "grow": 0}],
  "check_areas": [{"id":"contact-upper", "rect":[200,200,200,250]}],
  "feather": 0
}
```

示例只有语法意义，坐标不能套用到新图片。沿边界连续取点，顺时针或逆时针均可；CLI 自动闭合末点到首点，允许显式重复首点作为闭合标记。其余顶点应互异。多边形必须有面积、边不自相交、不折返重叠、坐标落在 `[0, coordinate_width] × [0, coordinate_height]` 内。复杂曲线按实际轮廓增加顶点，分离小块分别列入 cover。CLI 会拒绝无效几何，但无法判断有效多边形是否选中了正确商品。

每个多边形 3–4096 点，cover 与 protect 合计不超过 256 个。坐标比例与归正图一致（允许 0.5% 比例误差）。默认使用原尺寸坐标；若确需按缩略图标注，将其完整宽高作为 coordinate_width/height，由 CLI 等比例映射，不能混用两套坐标。局部裁图里的坐标先按 inspection.json 的映射转回全图坐标，再按所声明的区域坐标系换算。

`cover[].grow` 默认坐标短边 1.5%，显式值是该坐标系的外扩距离，0 表示选区本身已有余量。`protect[].grow` 默认 0，在产品外扩和可选柔边后扣除。`feather` 是原图像素柔边半径，整数 0–20，默认 0。柔边仅供明确需要时使用，视觉检查确保旧产品全部落在实黑区。

保护区沿人物实际边界绘制；两只手、前臂和头发分别处理，接触的产品、指缝与手臂间隙仍属于 cover。眼睛、鼻子、暗色产品部件的颜色不能作为人物保护依据。普通 protect 保留整个多边形内的像素。

### 可选：局部暖色像素保护

几何保护难以贴合皮肤边缘、且局部图能确认皮肤与产品颜色可分时，可以给该 protect 增加：

```json
"selection": {"type":"warm-pixels", "min_red_green":6, "min_green_blue":8}
```

这不是语义皮肤模型。它仅在该多边形的局部范围内，保留原图像素同时满足 `R-G > min_red_green` 和 `G-B > min_green_blue` 的部分；差值以 0–255 RGB 为单位，默认分别为 6 和 8，参数范围 0–255。不满足条件的像素继续被 cover 遮黑。判断使用归正原图，多个 protect 取并集，再从 cover 中扣除；暖色模式不执行自动膨胀、闭运算或全图分类。

先选择贴近已确认皮肤的小范围 ROI，再检查绿色选中像素是否只覆盖人物。暖色产品可能同样满足条件，偏色光照或部分肤色可能不满足条件；此时缩小 ROI 或改用普通几何 protect，回到预览检查。头发和衣服使用普通 protect。运行时不复写该算法、不根据颜色名临时发明 HSV 阈值。

## 3. 预览选区并修正

```text
nano-product-replacement inspect --source TASK/inspect-source-v1/oriented.png --regions TASK/regions-v1.json --output-directory TASK/inspect-regions-v1 --json
```

有 regions 时额外输出 `regions-overlay.png`：洋红色为 cover，绿色为实际 protect，原图保持可见。它与 blackout 共用像素选择逻辑。实际查看：覆盖应沿产品轮廓，人物应得到连续保护，绿色区域中不得残留旧产品。

每个 protect 自动输出 `protect-1.png` 等原像素局部图，并加周边余量；`check_areas` 另外指定需要核验的产品边缘和接触部位，最多 32 个。每项 `id` 唯一，仅用英文、数字、下划线、连字符（1–64 字符）；`rect=[left,top,width,height]` 使用区域文件的坐标系，必须在画布内。

裁图不缩放。`inspection.json.crops` 记录每张裁图的全图像素 left/top/width/height：`global_x=left+local_x`、`global_y=top+local_y`。还原全图后，再乘 coordinate_width/width、coordinate_height/height 写回区域文件。检查目录另外返回 mask_fraction（涂黑权重占比）；超过 80% 提示检查背景与人物，任何面积数值都不自动代表通过。

## 4. 涂黑并检查实际结果

```text
nano-product-replacement blackout --source TASK/inspect-source-v1/oriented.png --regions TASK/regions-v1.json --output TASK/masked-base-v1.png --mask-output TASK/mask-v1.png --json
nano-product-replacement inspect --source TASK/masked-base-v1.png --regions TASK/regions-v1.json --output-directory TASK/inspect-masked-v1 --json
```

`mask-output` 可选，是黑底白选区检查图，不传给生成服务；推荐每次保存。结果 JSON 含实际宽高、默认 grow、文件路径和涂黑图哈希。检查实际 masked-base 全图与局部裁图；最后一次 inspect 中的 `oriented.png` 就是本轮涂黑结果，`protect-*.png` 与 `check-*.png` 是该结果的原像素裁图。最终验收以这些真实像素为准，不以重绘的 overlay 为准。

逐项通过后才进入生图：旧产品纹理、原色细边及毛边全部遮住；手指、手臂、头发、衣服保留；指缝与手臂间隙没有产品残片；背景只损失紧贴商品的一圈余量。若误涂人物，收紧 cover 或修正 protect；若保护区残留产品，收紧 protect；若产品边缘漏涂，调整局部 cover 或 grow。每次修改另存 regions-v2.json、masked-base-v2.png 等新路径，重复步骤 3–4，不能在不合格底图上继续生图。

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
