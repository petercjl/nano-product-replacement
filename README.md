# @petercjl/nano-product-replacement

按真实参考替换场景图中的商品，提供本地遮挡、素材检查与结果收集。

面向具备所需执行能力的任意 Agent；Node.js 22+。当前 Agent 识别自己的 Skill 目录、能力与注册方式。

## 安装

把下面这句话发送给当前 Agent：

> 请安装 npm 包 @petercjl/nano-product-replacement。

安装同时包含工具、完整 Skill 和独立运行依赖。Agent 核验本地入口、文件与版本，再确认宿主能发现 Skill。

## 更新

> 请更新 npm 包 @petercjl/nano-product-replacement。

每次更新只处理明确选中的当前 Agent，保留自定义元数据与更新前备份。同版本也会检查和修复 Skill。自动检测默认提示；自动安装需要单独授权。

## 使用

附上图片并说明本次用途、输出数量和特殊要求。

> 请使用 nano-product-replacement，按所附图片和本次要求完成处理。

默认使用 SealSeek Nano Banana Pro，按输入比例生成 2K、一次 4 张候选，全部交付并附编号对比图；用户明确的模型、数量与渠道要求优先，不自动追加迭代批次。

先直接查看原图，按产品轮廓画多边形。涂黑默认外扩短边 1.5%，再从硬选区向外柔化短边 1%（最多 80 像素）；硬选区内保持纯黑。允许多盖少量人物接触边缘，仍须实际检查人物主体和旧产品残边。坐标网格与局部检查工具按需使用；需要硬边时设置 `feather: 0`。

账号、服务访问与付费生成按各自授权执行。安装不授予服务权限。

## Agent 执行合同

[安装合同](INSTALL.md) · [更新与恢复合同](UPDATE.md)。CLI 通过 `skill source --json` 返回规范来源。安装后的 Skill 使用自身 `scripts/run.mjs`，运行代码与依赖位于自身 `.runtime`。宿主适配记录能力差异与实际测试证据，不作为支持白名单。
