# SealSeek 媒体交接

触发：人类已明确选择 SealSeek。先通过 `sealseek-media skill source --json` 完整加载当前依赖 Skill，读取所需当前 CLI 合同，并探测实时模型。此页只说明本应用的交接，不替代能力包的协议。

输入：本轮完整的简洁修复提示词、首轮固定的有序场景和实物参考、本应用或人类明确的模型、比例、分辨率、本轮输出位置。应用默认目标 Nano Banana Pro、2K，每轮 1 张，最多 4 轮。参数以实时模型支持和人类要求校验；用户明确使用原场景时，固定参考清单的首张使用原场景。

```text
sealseek-media image generate --model nano-banana-pro --prompt ROUND_PROMPT --reference FIXED_SCENE_REFERENCE --reference FIXED_PRODUCT_REFERENCE --ratio 5:4 --resolution 2K --count 1 --output TASK/round-01/generated --dry-run --json
```

真实路径、比例、参考数量及轮次目录按本次输入重写。每轮先 dry-run，再在授权范围内以 `--via sealseek --submit` 提交一次。保存本轮 task ID，使用该 ID 跟踪或恢复，结果不明时检查历史。相同请求需要去重时遵循依赖合同；`--new` 仅用于应用已决定且用户授权范围内的下一轮，不能用于恢复未知任务。原图与凭据留在各自所有者管理的目录。

输出：本轮 task ID、终态、真实本地 artifacts、实际服务返回参数与费用。返回主线第 5 步，由应用实际看图、记录偏差并决定达标结束或修订下一轮提示词。下一轮复用固定初始参考，仍只请求 1 张；达到目标或累计 4 轮即结束。媒体能力不代替应用做商品验收或自动开启后续轮次。
