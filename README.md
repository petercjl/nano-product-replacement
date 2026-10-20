# nano 产品替换

先完整涂黑场景图中的旧产品，再按实物参考修复形态与纹理，保留人物及场景关系并交付全部候选结果。

安装请将下面的提示词发给 Agent：

> 安装 @petercjl/nano-product-replacement，并注册到当前 Agent。

更新：

> 更新 @petercjl/nano-product-replacement，并检查安装状态。

检查：

> 检查 nano-product-replacement 的本地处理能力和生图依赖。

使用时附上场景原图和对应实物参考：

> 用 nano-product-replacement 按所附实物参考替换场景图中的产品。

需要使用 SealSeek 的 Nano Banana Pro 时：

> 用 nano-product-replacement 和 SealSeek Nano Banana Pro 按所附实物参考替换场景图中的产品。

本地处理要求 Node.js 22+；图片处理依赖随 npm 包安装。生成遵循宿主工具路由，明确选择 SealSeek 时需另装 @petercjl/sealseek-media-cli、自己的账号及可用积分。安装本包不授权生成。

包提供可发现的 CLI 与规范 Skill，支持 Codex/SealSeek 的安装映射。包级跨平台测试与真实宿主测试分别记录。本地涂抹检查提供坐标网格、接触处裁图、简单多边形验证和可选局部暖色保护；轮廓识别仍需要 Agent 查看图片。Windows 和 SealSeek 宿主的端到端结果以对应运行证据为准。

## Agent 安装与维护合同

Agent 用包 CLI 的 help、capabilities、doctor 和 skill source/status/install/update 发现与管理规范来源。默认 macOS 使用规范来源链接，Windows 使用可校验的受管副本。已有非受管目录会保留；副本更新先备份，保留自定义 UI 元数据。用户编辑过的受管业务文件须显式请求备份迁移。

更新由用户发起，采用 npm latest；离线时保留已安装版本。开发 checkout 由 Git 管理。包更新后同步已管理的 Skill；链接安装直接指向更新后的规范来源，副本由包命令更新并返回备份。需要回退时由 Agent 安装先前的确切 npm 版本，并从更新返回的备份恢复所需用户文件。

本地任务的 inspect/blackout 入口默认检查稳定版更新，每 24 小时最多联网一次，超时上限 1.5 秒；离线时继续处理，结果 JSON 的 update_check 返回状态。检测只提示，不安装。通过环境配置 NANO_PRODUCT_REPLACEMENT_UPDATE_CHECK=0 关闭，update status 查看策略；状态缓存在用户级包状态目录，NANO_PRODUCT_REPLACEMENT_STATE_DIR 可显式指定。version、help、能力发现和任务轮询不触发联网。开发与 CI 测试可关闭检测。

其他 Agent 使用 generic 适配，由宿主发现自己的 Skill 目录，并将准确目标目录传给 skill source/status/install/update 合同中的 target-directory；命名适配继续提供 Codex/SealSeek 默认路径。显式指定 home 与 target-directory 互斥。自定义目标由调用者在包更新后再次执行该目标的 skill update，同样遵守受管来源、备份和本地编辑保护。

凭据和任务素材保存在包外。生图认证、幂等恢复和下载由所选择的媒体能力拥有；本包不重复实现服务协议。
