# SealSeek 媒体交接

触发：按本 Skill 默认使用 SealSeek，或用户明确选择 SealSeek；当前用户和宿主明确的渠道选择优先。先通过 `sealseek-media skill source --json` 定位并完整加载当前依赖 Skill，读取所需当前 CLI 合同，并探测实时模型。此页只说明本应用的交接，不替代能力包的协议。

输入：本次简洁修复提示词、有序参考清单（涂黑底图在前，所需实物参考在后）、模型、比例、分辨率、数量与输出位置。默认目标 Nano Banana Pro、2K，每张输入场景一次生成 4 张并全部交付。用户明确数量优先；“先测试一张”指一张输入场景，“只生成一张结果”才改为 1 张。参数以实时能力校验，不静默替换模型或改变数量。

```text
sealseek-media image generate --model nano-banana-pro --prompt PROMPT --reference MASKED_SCENE --reference PRODUCT_REFERENCE --ratio 5:4 --resolution 2K --count 4 --output TASK/generated --dry-run --json
```

真实路径、比例、参考数量和输出目录按本次输入重写。先 dry-run，确认实际请求符合数量与授权，再依当前媒体合同提交一次。保存 task ID，使用同一 ID 跟踪或恢复，结果不明时检查历史，不以 `--new` 自动创建新付费任务。涂黑底图是普通有序参考，不是专用 inpainting mask；不同时附上传未遮挡的错误场景。原图与凭据留在各自所有者管理的目录。

输出：task ID、终态、真实本地 artifacts、实际服务返回参数与费用。回到主线的检查与交付，逐图验收并保留全部候选；四张结果另附编号 2×2 对比图。部分成功先交付已有文件并说明缺数，不因主观不满意或技术失败自动追加生成批次。追加批次须有用户明确授权，媒体能力不代替应用做商品验收。
