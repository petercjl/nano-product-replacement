---
name: nano-product-replacement
description: 按实物参考替换已有场景图中的产品，先完整涂黑旧产品并保护人物，再修复产品形态与纹理，检查并交付全部结果。用于 nano 产品替换、同款产品细节修复等已有场景与实物参考的任务。
metadata:
  package: "@petercjl/nano-product-replacement"
  version: 0.2.2
---

# nano 产品替换

## Package installation and local execution

The owning npm package is the canonical source. Installation instructions are in its INSTALL.md and UPDATE.md before Skill loading. Resolve the current Agent's supported Skill directory and use explicit `--path` with package-managed install/status/update. Named Agent identities describe conventions, not eligibility or directory defaults.

After managed installation, invoke this Skill's `scripts/run.mjs` with the current Node.js runtime for every owning-package CLI command below. The launcher uses the target-owned `.runtime` and bundled dependencies. Resolve this launcher relative to this Skill's actual directory; do not fall back to a shared global package when the installed runtime is missing. External service dependencies are declared separately and resolve their own canonical Skill through their documented CLI contract.

Maintenance completes CLI/runtime and Skill verification, followed by host-native reload and discovery. CLI receipts leave host discovery pending. Automatic checks notify by default; installation requires separate standing authorization and a compatible stable version. Use update operation/resume for partial or unknown outcomes, preserving the original transaction and backup. Only the selected current Agent is synchronized.


以实物参考为产品事实来源，将正确产品还原到已有场景。方法是先在原图副本中完整遮挡旧产品，再按有序实物参考生成，保留场景和人物的接触关系。当前人类明确要求和宿主路由优先于应用默认值。

## 输入与输出

输入：可读取的场景原图、对应产品实物参考、需要替换的位置及款色；可选模型、轮次上限、比例、输出目录。源文件缺失时先定位附件，仍不可读取才请求路径。没有实物证据的商品事实冲突需要澄清。

输出：源文件引用、区域文件、同像素尺寸涂黑底图、固定有序参考清单，以及每轮提示词、生成请求与任务 ID、生成原件、实际尺寸和哈希、验收问题与继续或停止决定；多轮结果附编号对比图。输出保存到用户指定目录或任务工作区中新建的唯一目录。

本应用 Skill 负责素材匹配、遮挡选择、提示词和商品验收。所属 npm 包 `@petercjl/nano-product-replacement` 提供确定性本地处理及安装更新；媒体能力负责认证、模型校验、生成提交、任务恢复及下载。安装本包不授权付费生图，也不修改全局路由。

## 执行准备

读取当前宿主对应的 [Codex 适配](adapters/codex.json) 或 [SealSeek 适配](adapters/sealseek.json)；其他宿主读取 [通用适配](adapters/generic.json)，自行发现能力和准确安装目录，核对 [能力合同](capabilities.json)。本地处理先运行 `nano-product-replacement doctor --json`，检查 `local_ready`。媒体依赖和登录状态单独报告。

生图按宿主当前规则选择工具。人类明确选择 SealSeek 时使用下述依赖合同；一般 Codex 生图请求遵循宿主自带生图工具规则。需要 Nano Banana Pro 且当前路由不能提供时，报告具体能力缺口，等待人类明确选择支持该模型的提供方；保留其模型意图。

SealSeek 分支：逻辑依赖名为 `sealseek-media`，由 `@petercjl/sealseek-media-cli` 分发。通过 `sealseek-media skill source --json` 解析规范来源，完整读取其当前 `SKILL.md`，相对资源从该目录解析。核验 CLI 当前版本、能力、实时模型和参数合同。要求其支持有序参考图、单张输出、2K、任务 ID 查询恢复、原件下载和 dry-run/submit。缺失时返回 `CAPABILITY_UNAVAILABLE`，使用该包公开安装流程修复后回到本节；不复制媒体服务集成或依赖 Skill。认证和生成恢复全程由该依赖处理，交接输出为本轮任务 ID 和已下载文件，再回到第 5 步。

## 主线

### 1. 查看并匹配素材

实际查看场景和实物参考，记录每个目标的位置、品类、颜色、数量和参考文件对应。原场景中的产品可能正是错误来源。只用本张场景所需的实物参考；颜色或结构以当次提供的证据为准。识别记录供核验使用，提示词以简洁的参考对应关系表达。

### 2. 完整涂黑旧产品

进入本步骤先完整读取 [本地处理合同](references/local-processing.md)，按其中的命令、JSON 格式、坐标映射和失败分支执行。CLI 负责归正图片、生成坐标图与局部检查图、校验多边形、像素涂黑和局部颜色保护；Agent 负责根据图片判断产品轮廓、人物边界并填写区域 JSON。当前能力不包含自动语义分割。

固定执行顺序：

1. `inspect --source ... --output-directory ... --json` 获取归正全图、像素坐标网格和真实尺寸，实际查看两张图。
2. 沿产品外缘顺序记录顶点，弯曲、耳尖、凹口和接触点增加顶点；分离的露出部分使用独立 cover。以轮廓为依据，不把物体外接矩形当作产品选区。cover 可围住被手遮挡的完整产品，再用贴合人物实际边界的 protect 扣除人物。
3. 人物保护以几何多边形为主。需要颜色辅助时，只在已确认贴近皮肤的局部多边形内使用包内 `selection.type=warm-pixels`；头发、衣服及不适用该颜色条件的皮肤使用普通 protect。全图颜色筛选不能代替产品轮廓。图像转换、网格、分割辅助与预览均调用公开 CLI，缺少能力时报告缺口，不临时编写图像算法或导入包内部依赖。
4. `inspect --source ... --regions ... --output-directory ... --json` 检查洋红覆盖、绿色保护叠加图和接触处原像素裁图。先修正误选，再执行 `blackout`，同时保存 `mask-output`。
5. 再对涂黑结果执行 `inspect`，实际检查全图、每个人物接触处及产品边缘。修改区域后使用新版本 JSON 和新输出路径，重复步骤 4–5。

默认先将产品选区外扩短边 1.5%，再扣除保护区；长毛处可到 2%–3%，选区本身已有余量时设 grow=0。保护区默认不外扩，指缝和手臂间隙中的旧产品仍应遮住；默认羽化 0。

**进入生图的门槛：** 旧产品全部可见像素已被实黑遮挡；人物脸、手指、手臂、头发和衣服保持原样；背景只允许紧贴产品的一圈余量；接触处无旧产品原色细线或毛边。几何校验、CLI 成功和 mask 面积均不代表视觉合格。看图工具失败或无法分清接触边界时停在本步，报告具体缺口并保留产物。用户已提供合格涂黑底图时检查后复用，回到第 3 步。

### 3. 编写简洁提示词并校验

参考顺序：第 1 张是涂黑场景，后续是对应实物参考。编号与位置、款色的映射按本张图重写。参考图片承担产品结构、外观和身份事实，文字主要说明修复目标、对应关系、朝向及保留要求。示例：

> 第一张图片中的旧产品已用黑色遮住。请按后续实物参考修复对应产品：左侧对应图 2，前景对应图 3。所有可见产品结构、比例、组件位置、材质、颜色、文字、标识和连接关系遵循对应实物参考。保持原位置、朝向、人物接触遮挡、人物姿势、服装、背景、构图与光线。完整替换黑色区域，输出完整场景图。

每轮生成 1 张，默认最多 4 轮（含首轮），达到目标即提前结束。每张场景的实际轮次上限取 4、用户指定上限和已授权预算所允许次数中的最小值。用户明确只生成一次或一张时，上限为 1。默认 2K、最接近输入宽高比的支持档位，保持画面比例。

开始首轮前固定有序参考清单，记录文件路径、角色和哈希。后续各轮始终复用这组初始参考；用户明确选择直接使用原场景时，首张固定为原场景。生成结果只用于验收，不替换或追加为下一轮参考。先确定产品结构、比例、材质颜色、人物姿势与接触、场景构图光线等本次验收目标，再进入第 4 步。

人类选择 SealSeek 后，应用默认目标为 `nano-banana-pro`（显示名以实时目录核对）；当前人类明确模型优先。读取 [SealSeek 调用交接](references/sealseek-handoff.md)，再依当前依赖 Skill 校验与 dry-run。涂黑底图是普通有序参考图片，不是独立 inpainting mask。仅压缩参考副本以满足实时上传限制，并保留必要视角和可辨识纹理。

### 4. 单张提交并跟踪本轮任务

每轮使用独立的 `round-01` 等目录，保存当前完整提示词、固定参考清单、校验请求及结果。按第 3 步的模型和参数执行 dry-run，确认单张请求（SealSeek 为 `--count 1`），再在已授权范围内提交一次，立即保存本轮 task ID，跟踪同一任务到终态。各轮串行，上一轮完成第 5 步验收后才决定下一轮。

每次已确认提交计入轮次上限；未知提交结果、认证中断和超时先查询或恢复本轮同一任务，不为恢复另建付费任务。媒体失败按依赖合同处理，无法恢复则结束并保留已有结果，不把技术失败当成需要自动调提示词的新一轮。默认画布归档沿用媒体能力合同，用户明确的画布或位置参数保持不变。

### 5. 看图验收、修订提示词或结束

先核对本轮真实终态、请求与实际数量、文件存在、哈希和实际尺寸，再实际查看完整结果及必要局部。请求参数如 2K 或比例不代表服务严格返回对应像素值。按 [本地处理合同](references/local-processing.md) 的 `collect` 整理每轮下载文件，保留全部原件。

逐项对照初始参考和本次目标：先检查产品种类、数量、结构与连接关系、外形比例、颜色和材质纹理，再检查朝向、手部接触与遮挡、人物姿势、场景构图光线、残留黑块及额外物品。记录可见偏差及其位置、影响的目标和证据；不能把任务 succeeded 或“比上一轮好”视为验收通过。

- **达标：** 本次必需目标均已满足，记录 `accepted` 和依据，立即结束。
- **未达标且有剩余轮次与授权：** 根据已观察到的主要偏差修订下一轮完整提示词；保留有效的意图和要求，用参考对应、比例关系、动作、镜头与保留要求解决问题，继续让参考图承担商品事实。提示词表达当前目标，问题分析另存验收记录。保存改动目的，使用同一组初始参考回到第 4 步，单张生成下一轮。
- **达到上限、预算不足或无法实际看图：** 结束并说明未满足项；未看图不得继续自主迭代。最多执行 4 轮，不因结果仍有问题自动增加次数。

结束时逐轮给完整原图入口，标明最终达标轮；若均未达标，明确标注并说明最接近目标的结果及剩余问题。多轮可用汇总任务清单交给 `collect` 制作按轮次排列的编号对比图，4 轮采用 2×2；保留每轮真实 task ID 的对应关系。报告实际轮数、停止原因、各轮提示词与验收记录、模型、尺寸和工具返回费用；汇总费用时保留未知项，不将其计为零。

## 分支与演进

- 缺输入：定位真实附件或请求缺失事实，回到第 1 步。
- 缺本地能力：运行 doctor，按所属包安装/更新流程修复，回到执行准备。
- 缺模型特性：返回 `FEATURE_UNSUPPORTED`，保留明确模型与参考语义，获得人类选择后回到第 3 步。
- 媒体失败：按当前媒体依赖的相同任务恢复合同处理，回到第 4 步；无法恢复则交付已有结果及准确错误。
- 输出目录已存在：保留旧内容，使用新目录，回到相关处理节点。
- 未实际查看图片：标注视觉验收未完成；文件校验不代替视觉证据。
- 重复出现的方法或工具缺口：记录失败证据，进入另行授权的维护；普通运行不改自身 Skill 或适配。
