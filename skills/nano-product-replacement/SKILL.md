---
name: nano-product-replacement
description: 用 SealSeek Nano Banana Pro 修复或替换场景图中形态、纹理有误的产品；先涂黑旧产品，再按对应实物参考生成并交付全部结果。用于“nano 产品替换”、产品替换、同款产品细节修复等已有场景与实物参考的任务；不用于单纯换背景或从零创作。
metadata:
  package: "@petercjl/nano-product-replacement"
  version: 0.2.2
  workflow_revision: "2026-11-09"
---

# nano 产品替换

把用户的实物产品准确还原到现有场景中。核心方法是先遮掉原产品的错误细节，再让模型按实物参考重建，保留场景和人物关系。当前请求的明确参数、对象和授权优先于本技能的默认值。

## Package installation and local execution

The owning npm package is the canonical source. Installation instructions are in its INSTALL.md and UPDATE.md before Skill loading. Resolve the current Agent's supported Skill directory and use explicit `--path` with package-managed install/status/update. Named Agent identities describe conventions, not eligibility or directory defaults.

After managed installation, invoke this Skill's `scripts/run.mjs` with the current Node.js runtime for every owning-package CLI command below. The launcher uses the target-owned `.runtime` and bundled dependencies. Resolve this launcher relative to this Skill's actual directory; do not fall back to a shared global package when the installed runtime is missing. External service dependencies are declared separately and resolve their own canonical Skill through their documented CLI contract.

Maintenance completes CLI/runtime and Skill verification, followed by host-native reload and discovery. CLI receipts leave host discovery pending. Automatic checks notify by default; installation requires separate standing authorization and a compatible stable version. Use update operation/resume for partial or unknown outcomes, preserving the original transaction and backup. Only the selected current Agent is synchronized.

## 执行准备

本应用负责素材匹配、遮挡选择、提示词与商品验收；所属 npm 包提供跨平台本地处理及安装更新。读取当前宿主对应的 [Codex 适配](adapters/codex.json)、[SealSeek 适配](adapters/sealseek.json) 或 [通用适配](adapters/generic.json)，核对 [能力合同](capabilities.json)。通过本 Skill 的 `scripts/run.mjs doctor --json` 核验 `local_ready`；媒体依赖和登录状态单独核验。安装本包不授权付费生图，不改变宿主或用户明确的渠道选择。

## 已确定的默认值

| 项目 | 默认执行 |
|---|---|
| 渠道 | `sealseek-media` CLI；执行前读取其当前 Skill，遵循模型发现、认证、提交和恢复协议 |
| 模型 | SealSeek 显示名 `sealseek-ai-image-pro`，CLI ID `nano-banana-pro`；执行时用实时目录核对映射 |
| 分辨率 | `2K` |
| 数量 | 每张输入场景生成 `4` 张结果，全部交给用户选 |
| 比例 | 优先匹配输入宽高比；无对应档位时，从该模型支持的比例中选最接近的，不拉伸原图 |
| 保存 | 保留源文件及生成原件；按当前用户约定的缓存或交付目录另存易识别副本，没有约定时使用本次任务输出目录，已有目录或文件不覆盖 |

以当前用户或宿主明确的提供方与模型选择为准，未指定时使用上述默认值。需要的渠道或模型不可用时报告具体能力缺口，不擅自替换；参考素材按本次附件及实际项目定位，不依赖作者机器上的私人路径。

用户在这一流程中说“先测试一张”，默认指一张输入场景，仍输出四张；若明确说“只生成一张结果”，则按一张输出。不沿用已弃用的 `sealseek-ai-image-2.1`，也不因 CLI 默认模型不同而切换为 Sunburst。模型不可用时说明限制，不静默换模型。

## 识别与参考匹配

先查看原场景和产品实物参考，建立本张图的对应关系：位置、品类、颜色、数量、参考文件。产品真实性以实物参考和用户明确的款色设定为准；原场景中的产品可能正是错误来源。

- 只选本张场景实际出现、需要替换的产品参考，不把所有目录素材都上传。
- 同一品类多色时明确目标颜色；没有实物证据的结构、品牌或颜色细节不猜。无法消除的产品事实冲突才提问。
- 参考排序固定为：**涂黑底图在第 1 张，所需实物参考按提示词的对应顺序放在后面**。不要再默认把未遮挡的错误产品场景一起传给模型。
- 同属杉居“抱抱云朵社”长条抱枕时，读取 [当前抱枕设定](references/pillow-catalog.md)。该目录不适用于其他商品。
- 使用附件的真实文件；找不到可读取的场景文件时，先通过环境提供的附件入口定位，必要时再请用户给文件路径，不能重画一张当作原件。

## 制作涂黑底图

在原图副本上，以不透明黑色覆盖需要替换产品的全部可见区域，包括五官、耳朵、四肢、尾巴、绒毛外沿及细小露出部位。**宁多勿少：选区可以明显超出产品边缘，盖住产品周围一圈背景，也可以盖住人与产品接触处的一小部分手、脸边、衣服或脚。** Nano Banana Pro 能识别哪怕很细的旧产品残边并沿用旧形态，因此不要为了贴边而留下原色细线、毛边或纹理；被多盖的人物边缘可由模型补回。目标是隐藏旧形态和纹理，保留大致位置、占位及前后遮挡关系。

**默认流程（使用所属包的跨平台 `blackout` CLI，见 [本地处理合同](references/local-processing.md)）：**

1. 直接查看原图，沿产品可见轮廓输出**有序多边形顶点**（每只产品一个或多个多边形），写入 `cover`；不要只给矩形外接框。不把生成坐标网格、裁切放大坐标图作为默认前置步骤。
2. 人物需要保留的关键部位（脸、手、腿脚等与产品接触处）单独写入 `protect`。保护区画得**偏保守、略向人物内侧收**，宁可让黑色压到人物边缘，也不要让保护区把旧产品露出来；指缝、手臂间隙里的产品不要保护回来。
3. 产品选区默认外扩短边的 **1.5%**（CLI 默认值）；边缘默认**虚化**，`feather` 省略时为源图短边的 **1%**（2048×1536 图约 15 像素，最大 80）。CLI 保证原硬选区内保持纯黑，柔和过渡只落在选区外侧，因此虚化不会露出旧产品，但会让紧贴的人物边缘稍微变暗，这是允许的。需要硬边时写 `"feather": 0`。长毛、尾巴、接触处或轮廓不确定处直接给该多边形更大的 `grow`。
4. 运行 `blackout` 后**查看完整涂黑底图**，确认旧产品是否全部遮住、人物主体和无关背景是否保留；对人物接触处、耳尖、尾巴、脚等可疑位置可再看原像素局部。仍能辨认出旧产品的颜色、细线或纹理时，局部修改坐标（扩大 `cover`、加 `grow` 或收窄 `protect`）后用新文件名重跑。
5. 合格后同像素尺寸保存 `masked-base.png`，保留原件和每版 `regions*.json`。

坐标格式、EXIF 方向处理及按需调用的 `inspect` 见 [本地处理合同](references/local-processing.md)。每张新图都重新识别和绘制区域，不能复制上一张图的坐标。如果无法可靠输出产品轮廓坐标（例如图像无法查看、产品与背景难以分辨），明确说明限制，不用矩形或猜测坐标冒充完成。

局部遮挡修正可直接完成，不设例行用户确认环节；用户要求先看涂黑效果时，交付涂黑底图后暂停，不提交付费生成。用户已给合格涂黑底图时复用它。

## 简洁提示词与生成

以用户示范的简洁修复句式为主，只补充必要的款色对应、空间关系及保留要求，不扩写成重新创作场景的长提示词。例如：

> 第一张图片中的产品形态和纹理有误，已用黑色遮住。请根据后面的实物参考修复：左侧为图 2 的白色长条熊，前景为图 3 的粉色长条兔，后方为图 4 的棕色长条狗。准确还原对应产品的形态、五官和面料纹理，保持产品位置、人物接触遮挡关系，以及原人物、姿势、服装、背景、构图和光线。完整替换黑色区域，输出一张完整场景图。

每次按实际参考张数重写编号和产品名称；不机械套用三款示例。需要保留原朝向时写清楚；不要擅自新增饰品、文字或装饰。

通过 `sealseek-media skill source --json` 定位并完整读取当前规范 Skill，按 [SealSeek 调用交接](references/sealseek-handoff.md) 完成发现与校验，使用 `image generate` 的有序 `--reference` 输入。这里的黑色底图是一张普通参考图片，不是 API inpainting mask，也不需要调用专用 `image edit` 接口。参数结构如下，路径和比例按本次任务替换：

```powershell
$prompt = Get-Content -LiteralPath 'TASK_DIR\prompt.txt' -Raw -Encoding UTF8
sealseek-media image generate --model nano-banana-pro --prompt $prompt --reference 'TASK_DIR\masked-base.png' --reference 'PRODUCT_REFERENCE_1' --reference 'PRODUCT_REFERENCE_2' --ratio 5:4 --resolution 2K --count 4 --output 'TASK_DIR\generated' --dry-run --json
```

校验通过且生成已获授权后，将 `--dry-run` 改为 `--submit`，只提交一次。记录 task ID，持续跟踪直到终态；无需用户重复批准已有范围。画布按 CLI 的归档机制处理，不要求用户操作画布，也不扩展成选稿看板流程。

参考图片超出实时上传限制时只压缩副本，保留整套必要视角及可辨识纹理，不覆盖原件。任何认证、失败或结果未知的情况按 SealSeek Skill 的同一任务恢复协议处理；不通过 `--new` 自动追加付费生成。

## 检查与交付

1. 核对真实完成状态、请求与实际数量、文件存在、哈希和实际尺寸。`2K`、`5:4` 是请求参数，不能假称返回尺寸严格符合。
2. 实际查看所有结果，检查产品种类、数量、颜色、面料纹理、五官及结构；再看手部接触、人物变化、残留黑块和额外生成的物品。纹理准确是核心，不能只因画面好看就称完全还原。
3. 保留全部结果。可以简短指出差异或明显问题，但不替用户删掉选项，也不因主观不满意自行加生成批次。部分成功就交付已有结果并说明缺数。
4. 给每张完整原图的可点击入口，四张时另做有 `01–04` 编号的 2×2 对比图，便于用户挑选。对比图不能代替原图交付。
5. 简述模型、实际尺寸、实际费用（仅在工具返回时）、保存位置与实质偏差。保存涂黑底图、提示词和任务记录，方便复查；不公开分享，不覆写用户原图。

使用所属包的 `collect` 读取终态任务 JSON，核验并复制已下载的本地生成文件、记录实际尺寸、制作编号对比图。命令和支持格式见 [本地处理合同](references/local-processing.md#5-收集生成结果)。该步骤不调用生成服务、不花积分；仍需逐图视觉检查。安装后的所属包命令均通过本 Skill 的 `scripts/run.mjs` 调用。
