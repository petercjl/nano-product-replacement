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

包提供可发现的 CLI 与规范 Skill，支持 Codex/SealSeek 的安装映射。包级跨平台测试与真实宿主测试分别记录；本次范围是本地安装和图片处理，真实生图待提供素材。Windows 和 SealSeek 宿主未实测时不宣称已通过。

## Agent 安装与维护合同

Agent 用包 CLI 的 help、capabilities、doctor 和 skill source/status/install/update 发现与管理规范来源。默认 macOS 使用规范来源链接，Windows 使用可校验的受管副本。已有非受管目录会保留；副本更新先备份，保留自定义 UI 元数据。用户编辑过的受管业务文件须显式请求备份迁移。

更新由用户发起，采用 npm latest；离线时保留已安装版本。开发 checkout 由 Git 管理。包更新后同步已管理的 Skill；链接安装直接指向更新后的规范来源，副本由包命令更新并返回备份。需要回退时由 Agent 安装先前的确切 npm 版本，并从更新返回的备份恢复所需用户文件。

凭据和任务素材保存在包外。生图认证、幂等恢复和下载由所选择的媒体能力拥有；本包不重复实现服务协议。
