# SealSeek 媒体交接

触发：人类已明确选择 SealSeek。先通过 `sealseek-media skill source --json` 完整加载当前依赖 Skill，读取所需当前 CLI 合同，并探测实时模型。此页只说明本应用的交接，不替代能力包的协议。

输入：简洁修复提示词、有序的涂黑场景和实物参考、本应用或人类明确的模型、比例、分辨率、数量、输出位置。应用默认目标 Nano Banana Pro，2K，每场景四张。参数以实时模型支持和人类要求校验。

```text
sealseek-media image generate --model nano-banana-pro --prompt PROMPT --reference TASK/masked-base.png --reference PRODUCT_REFERENCE --ratio 5:4 --resolution 2K --count 4 --output TASK/generated --dry-run --json
```

真实路径、比例和参考数量按本次输入重写。只在授权范围内将 dry-run 改为 submit。记录一次提交返回的 task ID，使用该 ID 跟踪或恢复，结果不明时检查历史，不新建付费批次。原图与凭据留在各自所有者管理的目录。

输出：task ID、终态、真实本地 artifacts、实际服务返回参数与费用。返回主线第 5 步进行本地收集与逐图验收。
