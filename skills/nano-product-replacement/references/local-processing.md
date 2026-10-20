# 本地处理合同

通过 `nano-product-replacement version` 和 `capabilities --json` 核验当前包。Node.js 22+ 与打包依赖 sharp 是本地处理所需运行时。CLI 不生成、不上传、不读取服务凭据。文件存在时返回 `OUTPUT_EXISTS`，使用新路径。

## 涂黑

先实际查看原图。输入图片解码后按 EXIF 显示方向归正，坐标以归正后的像素宽高为准。输出与归正图保持同像素尺寸。PNG、JPEG、WebP 的静态图片均可使用。

区域为 UTF-8 JSON：

```json
{"coordinate_width":1000,"coordinate_height":800,"cover":[{"points":[[100,200],[500,200],[550,600],[100,600]]}],"protect":[{"points":[[250,250],[350,250],[350,400],[250,400]]}],"feather":0}
```

示例只有语法意义，每张图重新绘制。坐标比例应与归正图一致（允许 0.5% 误差），每个多边形至少三个有限 `[x,y]` 点。`cover[].grow` 默认坐标短边 1.5%，显式值为该坐标系的外扩距离，0 表示选区本身已有余量。`protect[].grow` 默认 0，在产品外扩和可选柔边后扣除。`feather` 是原图像素柔边半径，整数 0–20，默认 0。柔边仅供明确需要时使用，视觉检查确保旧产品全部落在实黑区。

```text
nano-product-replacement blackout --source TASK/source.png --regions TASK/regions.json --output TASK/masked-base.png --mask-output TASK/mask.png --json
```

`mask-output` 可选，是黑底白选区检查图，不传给生成服务。结果 JSON 含实际宽高、默认 grow、文件路径和涂黑图哈希。检查轮廓和人物接触后才进入生成。

## 收集

使用媒体能力取得终态任务 JSON，保留已下载文件路径；本地相对路径按任务 JSON 所在目录解析。接收顶层任务或 `{ "task": ... }` 包装，`status` 为 succeeded、partial 或 failed，且存在 1–64 个有效本地图片 artifacts。无本地图片时返回错误，保留原任务以继续下载或诊断。

```json
{"task_id":"TASK_ID","status":"succeeded","requested_count":4,"model":"SELECTED_MODEL","artifacts":[{"path":"generated/image.png","sha256":"OPTIONAL_SHA256"}]}
```

```text
nano-product-replacement collect --task-json TASK/result.json --output-directory TASK/new-delivery --json
```

先验证全部输入及可选哈希，再创建全新交付目录。按实际解码格式保存原始字节，输出 result-01 等文件、实际尺寸及 SHA256 的 `files.json`，多于 1 张时生成 `comparison.jpg`。四张采用 2×2 编号，不拉伸图像。部分任务缺数照实返回，保留所有已有结果。
