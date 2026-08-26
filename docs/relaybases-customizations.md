# RelayBases 定制维护与上游合并手册

> 本文记录 RelayBases 部署在 `QuantumNous/new-api` 之上的定制层，供升级、回归和回滚使用。它不是替代上游文档的产品说明。

## 1. 维护基线

本文最后按以下代码状态审计：

| 项目 | 状态 |
| --- | --- |
| 上游基线 | `QuantumNous/new-api` `v1.0.0-rc.24`（共同基线 `5c3abffe`） |
| RelayBases 集成基线 | `origin/main` `fc5ab87f`；原生展示与七语言迁移已合入，本次删除迁移期 Worker 握手 |
| 上游身份 | 必须保留 new-api、QuantumNous、许可证、版权、源码头、模块路径及原有归属信息 |
| 本文范围 | fork 内的产品差异，以及不在本仓库中的外部 UI/CF Worker 依赖边界 |

每次合并或删除定制后都应同步更新此表和下方清单。仓库级约束以 [AGENTS.md](../AGENTS.md) 为准。

## 2. Git 与分支策略

| 名称 | 用途 | 规则 |
| --- | --- | --- |
| `upstream` | 官方 `QuantumNous/new-api` | 只拉取；push 必须保持禁用。不得改写、强推或把 RelayBases 提交推到该 remote。 |
| `origin` | RelayBases 自有 fork | PR、集成分支和发布标签的唯一公开写入目标。 |
| `main` | 已验证的 RelayBases 集成线 | 只通过已审阅 PR 合并；不得在生产目录直接编辑后再打包。 |
| `codex/<topic>-<date>` | 单一需求功能分支 | 从最新 `origin/main` 创建；每个提交只承担一个可审计目的。 |
| `v<upstream>-relaybases.<n>` | 可选发布标签 | 标明对应的官方版本和 RelayBases 修订号，不冒充官方标签。 |

推荐升级步骤：

1. `git fetch upstream --tags` 和 `git fetch origin`，确认官方目标 tag/commit。
2. 从最新 `origin/main` 创建 `codex/upgrade-<version>-<date>`，以普通 merge 保留官方与定制两条历史，不重写已发布的 `main`。
3. 用 `git diff $(git merge-base HEAD upstream/main)..HEAD` 重新生成定制差异清单。
4. 对每个差异先判断官方是否已提供同等能力：已提供则删除本地实现和兼容测试；未提供才保留最小补丁。
5. 按第 7 节完成测试，通过 fork PR 合入 `origin/main` 后再发布。

低耦合原则：优先新增窄字段、窄投影和独立 feature 目录；支付安全逻辑放在服务端；不改变已有字段语义；不复制官方大组件；生成文件只随对应源码一起更新；所有数据库改动同时兼容 SQLite、MySQL 和 PostgreSQL。

## 3. 定制清单

### 3.1 产品与账务定制

| 模块 | 当前行为与不变量 | 关键位置 | 升级时优先检查 |
| --- | --- | --- | --- |
| Stripe USD 单位价与折扣 | Checkout 实付金额按 `充值额度 × StripeUnitPrice × 用户充值倍率 × 预设折扣` 计算；从已配置的一次性 Stripe Price 读取产品和币种，并以单行动态金额创建 Checkout。生产目标单位价目前为 `USD 0.1425/Ɍ`，但数值只存在运行配置中，不应硬编码。`TopUp.Money` 仍是入账基数，不能替换为实付 USD。 | [controller/topup_stripe.go](../controller/topup_stripe.go)、[setting/payment_stripe.go](../setting/payment_stripe.go)、[setting/operation_setting/payment_setting.go](../setting/operation_setting/payment_setting.go) | 官方是否已支持折后实付、Price 校验和动态单行金额；Stripe API 的 Price/Checkout 字段是否变化。 |
| Waffo Pancake | 网关本体、Store/Product 绑定和 USD 单位价配置来自官方实现。RelayBases 仅把其已验签实付数据接入支付快照、推荐返利及退款撤销。曾有的“可配置 CNY”定制已撤回，不得恢复旧补丁；运行配置仍需核对 `WaffoPancakeUnitPrice`、最低充值、Store 和 Product 的绑定。 | [controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go)、[service/waffo_pancake.go](../service/waffo_pancake.go)、[setting/payment_waffo_pancake.go](../setting/payment_waffo_pancake.go) | 官方是否已提供等价的实付快照或返利钩子；Webhook 的 `total`、`currency`、`paymentId`、环境和退款事件契约是否变化。 |
| 支付实付快照 | `top_ups.payment_amount` 与 `top_ups.payment_currency` 只用于展示和审计。此次仅在正在使用的 Epay、Stripe、Waffo、Waffo Pancake 创建订单时保存预期金额/币种，已验签回调在完成充值的同一事务内覆盖为最终值；重复成功回调可安全补齐快照。绝不参与充值入账或返利换算。Creem 和旧订阅保持现状。 | [model/topup.go](../model/topup.go)、[controller/topup.go](../controller/topup.go)、[controller/topup_stripe.go](../controller/topup_stripe.go)、[controller/topup_waffo.go](../controller/topup_waffo.go)、[controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go)、[web/src/lib/payment-amount.ts](../web/src/lib/payment-amount.ts)、[web/src/features/wallet/components/dialogs/billing-history-dialog.tsx](../web/src/features/wallet/components/dialogs/billing-history-dialog.tsx) | 官方是否新增实际支付金额/币种字段；若有，迁移数据后删除本地平行字段和格式化层。 |
| 首笔实付推荐返利 | 仅受邀用户首笔已验签、生产环境、成功且支持 CNY/USD 的外部支付产生返利；比例为优惠后实付计费基数的 3%。注册本身不产生邀请返利，平台注册赠送保持独立。首笔资格由历史已验签成功充值判定；首笔正式实付即使因币种等原因不符合发放条件，资格也不顺延。退款、撤销或暂缓同样不会重新释放资格，既有多笔历史返利不追缴、不改写。Stripe/Waffo Pancake 的 USD 实付按下单时快照的单位价还原为 RelayBases 计费单位，再计算 3%；发布前创建的待支付订单缺少快照时才回退当前配置并记录告警。账本仍保存原始实付金额和币种。返利转入余额提交后清理用户缓存；缓存清理失败只告警，不能把已提交转账返回成失败并诱发重复操作。 | [model/referral_reward.go](../model/referral_reward.go)、[model/referral_reward_admin.go](../model/referral_reward_admin.go)、[model/user.go](../model/user.go)、[controller/referral_reward.go](../controller/referral_reward.go)、[controller/referral_reward_admin.go](../controller/referral_reward_admin.go)、[router/api-router.go](../router/api-router.go) | 官方是否支持“首笔已验签实付返利”、订单级单位价快照、不可重复发放、隐私投影和退款撤销；不要退回“注册送邀请奖励”或“每笔充值返利”。 |
| 合伙人佣金 | 独立 Partner 资格替代普通 3% 返利且不修改 API 计费分组：受邀用户每笔已验签生产 USD 充值，按该合伙人当时的专属比例（默认 30%）和真实实付计算佣金，不叠加普通返利、不追溯历史。佣金以 USD micros 记账并保留比例快照，7 天后可转为 API Credits 或申请提现；最低提现 USD 20，同一时间仅一笔待处理。提现支持支付宝和 BNB Smart Chain（BEP-20）USDT，收款资料使用 `CRYPTO_SECRET`（未配置时为 `SESSION_SECRET`）派生密钥加密保存；该密钥在发布、重启和回滚时必须保持稳定。管理员二次验证后才可查看收款资料，并在实际打款后登记凭证。退款/争议撤销未结算或可用佣金；已使用部分形成持久调整额，由后续佣金抵扣。 | [model/partner_commission.go](../model/partner_commission.go)、[controller/partner_commission.go](../controller/partner_commission.go)、[router/partner_router.go](../router/partner_router.go)、[web/src/features/partner-rewards](../web/src/features/partner-rewards) | 官方若新增多层级佣金或提现账本，迁移时必须保留 USD 精度、比例快照、7 天结算、提现幂等、退款负债和加密收款资料；不得与普通返利双发。 |
| 返利退款/争议撤销 | 以支付渠道 + 规范化支付引用的摘要串行化 grant/reversal；Stripe、Creem、Waffo、Waffo Pancake 的可机读退款/争议自动撤销，Epay 可走审计过的管理员兜底。已转入正常余额的返利也会被扣回；无法完全追回时留下运维错误。 | [model/referral_reward.go](../model/referral_reward.go)、[controller/topup_stripe.go](../controller/topup_stripe.go)、[controller/topup_creem.go](../controller/topup_creem.go)、[controller/topup_waffo.go](../controller/topup_waffo.go)、[controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go) | Webhook 事件名、幂等 ID 和退款引用字段；回调重试是否仍返回可重试状态。 |
| 用户及管理员返利账本 | 用户只看脱敏后的受邀人标识；管理员有全站汇总、筛选和脱敏账本，不暴露订单号、支付引用或网关事件 ID。实付显示必须带 ISO 币种，例如 `USD 13.54`、`CNY 90.00`；返利额度继续显示为 `Ɍ`。 | [web/src/features/referral-rewards](../web/src/features/referral-rewards)、[web/src/features/admin-referral-rewards](../web/src/features/admin-referral-rewards)、[web/src/routes/_authenticated/referral-rewards/index.tsx](../web/src/routes/_authenticated/referral-rewards/index.tsx)、[web/src/routes/_authenticated/admin/referral-rewards/index.tsx](../web/src/routes/_authenticated/admin/referral-rewards/index.tsx) | 官方是否出现同名路由/API；合并时避免双菜单、双路由和重复 i18n key。 |
| 用户列表邀请投影 | `qualified_referral_invitees` 是 `referral_reward_claims` 中 `awarded + withheld` 的受邀用户去重数，`reversed` 不计入；旧 `qualified_referral_payments` 仅作兼容别名。它们是 `gorm:"-"` 非持久字段，列表、搜索和用户详情一次分组查询填充，避免 N+1。前端没有邀请人时留空，不显示占位文案。 | [model/user.go](../model/user.go)、[controller/user.go](../controller/user.go)、[web/src/features/users/components/users-columns.tsx](../web/src/features/users/components/users-columns.tsx)、[web/src/features/usage-logs/components/dialogs/user-info-dialog.tsx](../web/src/features/usage-logs/components/dialogs/user-info-dialog.tsx) | `aff_count` 不得重新作为权威统计；官方若新增返利用户统计，统一到一套语义后再删本投影。 |
| 用户可见管理员额度日志 | 管理员 add/subtract/override 额度时，日志归属受影响用户；管理员身份、来源 IP 等仍放在仅管理员可见的 `admin_info`，普通用户只能看到操作结果。 | [controller/audit.go](../controller/audit.go)、[controller/user.go](../controller/user.go)、[controller/user_manage_test.go](../controller/user_manage_test.go) | 官方审计日志是否已有“目标用户可见、操作者信息隐藏”的投影。 |

### 3.2 展示、品牌和兼容性定制

| 模块 | 当前状态 | 关键位置 | 升级注意 |
| --- | --- | --- | --- |
| RelayBases 公网分享元数据 | 在部署入口增加 RelayBases favicon、manifest、Open Graph、Telegram/X 卡片和说明文案；浏览器 favicon 固定使用版本化圆形资产，不随后台可配置站点 Logo 被覆盖。它只定制部署外观；不得删除或改写仓库内 new-api、QuantumNous、AGPL、版权和源码归属。 | [web/index.html](../web/index.html)、[web/public](../web/public)、[web/src/features/relaybases/branding/favicon.ts](../web/src/features/relaybases/branding/favicon.ts) | 官方重构入口模板时仅重新应用部署元数据，不批量替换官方名称；运行时品牌刷新不得重新把方形站点 Logo 写入 favicon。 |
| VIP 海外渠道支付确认提醒 | 仅当用户分组精确为 `vip` 且选择 Stripe、Waffo 或 Waffo Pancake 时，在付款摘要内提示海外渠道手续费较高、VIP 8 折不会自动应用，并提供前往 RelayBases 官方 Telegram 客服或按当前显示金额继续付款两种选择。当前显示金额可能已包含公开充值优惠；本提示只说明 VIP 优惠，不改变支付、折扣或入账计算。 | [web/src/features/wallet/relaybases-vip-payment-warning-policy.ts](../web/src/features/wallet/relaybases-vip-payment-warning-policy.ts)、[web/src/features/wallet/components/relaybases-vip-payment-warning.tsx](../web/src/features/wallet/components/relaybases-vip-payment-warning.tsx)、[web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx](../web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx) | 官方若支持按用户分组与渠道配置确认提醒，迁移到官方能力后删除本地组件和单个布尔接线；保持客服地址与官网 canonical 入口一致。 |
| 原生 RelayBases 展示层与七语言 | RelayBases 自定义钱包、支付渠道说明、注册权益、法律同意文案、状态/无限画布导航、模型广场补充信息和通用日志导出入口均位于 `web/src/features/relaybases`；上游组件只保留窄接线点。自定义前端文案使用独立 `relaybases` i18next namespace，并且 en、zh-CN、zh-TW、fr、ja、ru、vi 七份资源必须具有完全相同的叶子键。任何 RelayBases 自定义用户可见文案的新增或修改都必须在同一提交补齐七语言；递归完整性测试校验内容结构，CI 门禁逐键比较合并基线并要求七份资源修改完全相同的叶子键集合。不得借此改写官方 upstream 文案。静态文档暂只提供中英文时，其他界面语言明确回退英文。 | [web/src/features/relaybases](../web/src/features/relaybases)、[web/src/features/relaybases/i18n/__tests__/locale-coverage.test.ts](../web/src/features/relaybases/i18n/__tests__/locale-coverage.test.ts)、[web/scripts/check-relaybases-locale-change-set.mjs](../web/scripts/check-relaybases-locale-change-set.mjs)、[.github/workflows/ci.yml](../.github/workflows/ci.yml)、[web/src/i18n/config.ts](../web/src/i18n/config.ts)、[web/index.html](../web/index.html) | 官方新增同等 slot、品牌配置或本地化能力时，优先换成官方入口并删除宿主补丁；自定义文案若缺少任一语言、叶子键不一致或七语没有修改同一组文案键，CI 必须失败。 |
| 钱包付款方式品牌卡片 | 钱包付款卡片和确认弹窗恢复官方紧凑按钮、图标、标题和排列；仅在中文界面把 Stripe 的展示映射为支付宝、Waffo/Waffo Pancake 的展示映射为微信支付，提交时仍使用原始网关类型。非中文保持官方网关名称和图标。中文确认弹窗在 USD 应付金额下显示按系统汇率计算的人民币近似值；支付方式与订阅区块继续上下排列。 | [web/src/features/relaybases/wallet/payment-method-card.tsx](../web/src/features/relaybases/wallet/payment-method-card.tsx)、[web/src/features/relaybases/wallet/policy.ts](../web/src/features/relaybases/wallet/policy.ts)、[web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx](../web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx)、[web/src/features/wallet/lib/ui.tsx](../web/src/features/wallet/lib/ui.tsx) | 保留官方 Waffo 子方式的根相对图标路径；Waffo Pancake SDK 当前没有可安全传入付款方式的字段，不伪造 WeChat 参数。Stripe 仅在中文一次性 Checkout 指定 `alipay`，订阅和其他语言保持原逻辑。 |
| 公告与部署内容本地化 | `/api/status` 中当前公告、FAQ、API 地址说明，`/api/notice` 以及用户可用分组说明按请求界面语言返回七语言内容。条目使用稳定 ID 与源内容 UTF-16 FNV 哈希绑定；管理员修改源内容后哈希不匹配即原样返回，旧翻译不得覆盖新公告。归档公告仅由明确 ID 清单过滤。后端业务报错仍使用官方 en/zh-CN/zh-TW bundle，fr/ja/ru/vi 回退英文。 | [relaybases/contenti18n](../relaybases/contenti18n)、[controller/misc.go](../controller/misc.go)、[controller/group.go](../controller/group.go)、[web/src/features/relaybases/content](../web/src/features/relaybases/content) | 新增或修改公告时，必须同步稳定 ID、最新源哈希和七语言正文；不得按正文模糊匹配。管理员临时编辑优先于仓库翻译。 |
| 服务端统一执行最低充值 | en、zh-CN、zh-TW、fr、ja、ru、vi 七种界面语言统一最低 Ɍ20，并与各支付渠道配置的最低值取更严格者。GetTopUpInfo、预设选项、报价和实际下单入口共用同一服务端策略；旧 Epay 自定义渠道的独立最低值也由报价与下单接口按所选渠道执行，浏览器展示值不能绕过服务端。 | [controller/relaybases_topup_policy.go](../controller/relaybases_topup_policy.go)、[controller/topup.go](../controller/topup.go)、[controller/topup_stripe.go](../controller/topup_stripe.go)、[controller/topup_waffo.go](../controller/topup_waffo.go)、[controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go) | 官方若提供服务端统一最低充值策略，迁移后删除本地 helper；支付入口、报价入口和展示数据必须始终使用同一结果，渠道配置仍可提高安全下限。 |
| 自动路由展示 | 自动分组、`auto_groups`、熔断路由和主要 UI 是 `v1.0.0-rc.24` 的官方功能，不是 RelayBases 后端魔改。当前 fork 仅有与官方实际单层动效一致的测试期望调整；可用分组与顺序是运行配置。 | [web/src/features/keys/components/api-key-group-cell.tsx](../web/src/features/keys/components/api-key-group-cell.tsx)、[web/src/features/keys/components/__tests__/api-key-group-cell.test.tsx](../web/src/features/keys/components/__tests__/api-key-group-cell.test.tsx)、[setting/user_usable_group.go](../setting/user_usable_group.go)、[service/group.go](../service/group.go) | 升级时以官方实现为准；若官方测试已修复，删除本地测试差异。外部公告/文档文案不应变成路由实现。 |
| 移动侧栏 | 仅桌面折叠态包装 tooltip；移动端链接先交给路由处理，再在下一帧关闭侧栏，避免首击被焦点/tooltip 处理吞掉。 | [web/src/components/ui/sidebar.tsx](../web/src/components/ui/sidebar.tsx)、[web/src/components/layout/components/nav-group.tsx](../web/src/components/layout/components/nav-group.tsx)、[web/src/components/ui/__tests__/sidebar-tooltip.test.tsx](../web/src/components/ui/__tests__/sidebar-tooltip.test.tsx) | 官方若修复相同触摸竞态，删除本地 hook 和测试，不叠加两套延迟关闭逻辑。 |
| 版本与 CI 兼容 | `VERSION` 明确记录当前官方基线；前端 CI 将 Bun 测试按文件串行执行以规避共享 DOM/全局状态互扰。 | [VERSION](../VERSION)、[.github/workflows/ci.yml](../.github/workflows/ci.yml) | 每次升级同步版本；先验证官方测试隔离是否已修复，再决定是否继续串行。 |

## 4. 数据语义与迁移不变量

### 4.1 `top_ups` 金额字段

| 字段 | 含义 | 可否参与入账 |
| --- | --- | --- |
| `amount` | 用户购买的 RelayBases 充值额度/数量 | 是，按各网关既有路径使用 |
| `money` | 官方遗留的充值结算/额度基数；不同网关历史语义并不完全一致 | 是；必须保持现有公式 |
| `payment_amount` | 网关创建或已验签回调确认的实际支付金额，十进制字符串 | 否 |
| `payment_currency` | 对应 `payment_amount` 的大写 ISO 4217 代码 | 否 |

必须始终满足：

- `payment_amount/payment_currency` 是配对快照；任一为空或无效时，UI 显示“币种不可用”，不得从 `money`、支付渠道、日期或当前单位价猜测。
- 新订单先记录提交给网关的预期值；成功回调通过 `setVerifiedPaymentSnapshot` / `updateCompletedTopUpPaymentSnapshot` 在原充值事务中写入最终值。
- 幂等成功回调在两个快照字段都为空时只补齐快照，已有快照必须与回调的十进制金额和币种一致；字段残缺或值冲突时拒绝覆盖并留下运维错误。无论哪种情况都不能再次充值或再次发放返利。
- 管理员手动补单没有已验签的实付数据，因此必须清空创建时的报价快照。之后若收到真实验签回调，只补写快照，不重复入账，也不追溯发放推荐返利或改写验证标志。
- 订单列表把 `amount` 标为“充值额度”，成功订单把已验签快照标为“实付金额”，pending 订单标为“应付金额”，expired/failed 只标为“结账金额”，避免暗示仍然欠款。

历史策略：本次不执行猜测式回填，旧记录默认留空。以后如需回填，只能使用支付渠道查询/已验签回调，或以 `top_up_id` 精确匹配且含真实 `paid_amount + paid_currency` 的返利账本；脚本必须先 dry-run、按订单留审计结果并可重复执行。当前配置、切换币种日期和 `money` 都不是可靠来源。

回滚策略：旧版本会忽略新增列，因此回滚应用时保留两列，不执行 `DROP COLUMN`。如只回滚展示，恢复旧前端即可；充值和额度公式从未依赖新字段。至少经过两个稳定发布周期且完成数据导出前，不考虑删列。

### 4.2 推荐返利表

| 表/字段 | 用途 |
| --- | --- |
| `referral_reward_claims` | 推荐返利的不可变主账本；包含邀请双方 ID、`top_up_id`、渠道、实付金额/币种、奖励额度、状态和撤销信息。切换为首笔规则前已经产生的多笔历史返利原样保留。面向用户的 API 只返回隐私投影。 |
| `referral_payment_states` | 以规范支付引用摘要实现 grant/refund 并发串行化和幂等，不保存明文网关引用。 |
| `top_ups.referral_payment_verified` | 标记充值是否来自已验签生产支付；人工补单和沙盒支付不得据此产生正式返利。 |
| `top_ups.referral_unit_price` | Stripe/Waffo Pancake 下单时的 USD 单位价快照，仅供返利换算；不得参与支付结算或充值入账。历史空值不猜测回填。 |
| `users.aff_quota` / `users.aff_history` | 可转入返利额度 / 历史返利额度，单位是 `Ɍ`。 |
| `users.aff_count` | 兼容字段，**不是权威支付笔数**。2026-08-04 前代表邀请注册数，之后曾复用为返利支付计数，历史语义混合；不得迁移覆盖。 |
| `users.qualified_referral_invitees` | 非持久 API 投影；从账本实时聚合有效受邀用户去重数。旧 `qualified_referral_payments` 为同值兼容别名。 |
| `referral_reward_claims.program` / `commission_usd_micros` | 区分普通返利与合伙人佣金，并以 USD micros 保存合伙人佣金；`rate_basis_points` 是发放时比例快照。 |
| `referral_reward_claims.partner_*` | 保存 7 天可用时间和 pending/available/reversed 结算状态；历史普通返利默认 `program=standard`。 |
| `partner_profiles` | 独立的合伙人资格、专属比例与生效时间；不得修改 `users.group`，避免影响 API 路由和计费。启用记录是实时授权门。 |
| `partner_wallets` / `partner_wallet_entries` | USD pending/available/locked/debt 物化余额与不可重复流水；所有资金动作必须在同一事务持行锁更新。 |
| `partner_withdrawals` | USD 提现申请；收款资料使用 `CRYPTO_SECRET` 派生 AES-GCM 密钥加密，API 默认只返回脱敏值。 |

邀请投影的回滚只需移除投影和 UI；不修改 `aff_count`，不删除账本。其值必须只由账本状态推导，不能双写为数据库计数器。

## 5. CF Worker 与源码边界

CF Worker 由独立的 [relaybases-site](https://github.com/gulullu/relaybases-site) 仓库管理。New API 展示已经由本仓库原生实现，Worker 不再注入、翻译或改写控制台页面与展示型 API 内容。

| 应由本仓库源码负责 | Worker 必须继续负责 |
| --- | --- |
| 钱包与支付说明、金额/币种显示、最低充值的服务端策略、七语言自定义文案、公告/FAQ/分组展示、注册和法律文案、导航、模型广场展示、iframe 语言/主题参数、favicon、通用日志导出按钮 | 模型与 endpoint allowlist、Token 分组服务端校验、Canvas Sync/R2、公共媒体上传、通用日志导出的鉴权/限流/签名和源站代理、Upstream Hub SSO、静态及法律站点边缘路由、邀请归因，以及其他访问控制 |
| Checkout 参数、Webhook 验签、额度入账、币种快照、返利发放/撤销、权限与隐私投影 | 不得重新加入控制台 DOM 注入、展示文案替换或响应内容翻译；安全过滤必须保持服务端执行 |

Worker 不得伪造支付回调、计算或赠送额度、决定返利资格、删除 ISO 币种或遮蔽服务端错误。完成本次双仓交接后，New API 与 Worker 不再使用 marker 握手：应用回滚不得依赖边缘展示回退；Worker 回滚必须选择不含旧 DOM 注入的安全版本。如果唯一可用的旧版 Worker 仍包含兼容展示，不得直接回滚，应以当前安全版为基线修复并前滚。任何发布都要分别检查直连源站和经 Worker 的响应，防止边缘层掩盖源码回归。

## 6. 上游合并审计清单

### 合并前

- [ ] 记录当前 `origin/main`、目标官方 tag/commit 和共同祖先。
- [ ] 阅读官方 release notes 与支付、用户、路由、审计、i18n 相关 diff。
- [ ] 对第 3 节逐项标注：官方已支持 / 仍需保留 / 应删除 / 需迁移。
- [ ] 导出数据库 schema；支付或返利变更另做可恢复备份，但不把数据或凭据提交仓库。
- [ ] 确认运行配置中的 Stripe/Waffo Pancake 单位价、币种、Price/Product/Store 绑定和最低充值，不在代码中写死线上 ID。

### 合并中

- [ ] 保留 new-api、QuantumNous、LICENSE、版权头、Go 模块路径、官方 README 和包元数据。
- [ ] 不向 `upstream` push，不以全局搜索替换官方品牌。
- [ ] 若官方已有等价功能，优先迁移到官方字段/API 后删除本地平行实现。
- [ ] 特别复核 [model/topup.go](../model/topup.go)、[model/user.go](../model/user.go)、各支付 controller、[router/api-router.go](../router/api-router.go) 和前端路由生成文件。
- [ ] 保持 `Amount/Money` 入账语义、回调幂等、退款先后竞态和用户隐私不变量。

### 合并后

- [ ] 更新本文的基线、文件链接、字段和已删除定制。
- [ ] `git diff $(git merge-base HEAD upstream/main)..HEAD` 中的每个产品差异都能在本文找到归属；纯格式差异应尽量消除。
- [ ] 路由树、i18n 和生成文件由对应工具重新生成，不手工维护分叉副本。
- [ ] PR 按 [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) 填写，并说明升级基线、保留的定制和回滚方式。

## 7. 回归测试矩阵

| 范围 | 必测场景 |
| --- | --- |
| 数据库 | SQLite、MySQL、PostgreSQL 均可自动新增快照字段；旧空值可读；推荐账本聚合查询一致。 |
| Stripe | 预设折扣、用户充值倍率、USD 单位价、最低/最高金额；pending 保存应付快照；同步/异步成功回调覆盖最终快照；重复回调等值时幂等、冲突时拒绝，且不重复入账；手动补单清空报价快照；退款/争议只撤销一次。 |
| Waffo Pancake | USD 单位价与折扣、正确 Store/Product、order.completed 实付快照、沙盒隔离、refund.succeeded 撤销和重复事件。 |
| 其他网关 | Epay CNY、Waffo 回调币种均保存真实快照；网关不匹配不得完成订单。Creem 与旧订阅保持现状，不纳入此次功能验收。 |
| 历史数据 | 旧 CNY/USD 订单字段为空时显示“币种不可用”；不得显示裸 `money` 或按当前配置推断。 |
| 推荐返利 | 每位受邀用户仅首笔已验签正式付款可获 3%，首笔不合格时资格不顺延；CNY/USD 原币种留账；订单单位价在建单与回调间变化；历史已付费但无返利；并发首单；注册不返；优惠后实付为基数；无邀请人、禁用邀请人、沙盒、重复回调、退款、争议和额度溢出。既有历史返利与余额必须保持不变。 |
| 合伙人佣金 | 专属比例快照、同受邀用户多笔付款均发放、与普通 3% 互斥、7 天边界结算、退款前后冲正、已转出后形成调整额、USD→Credits 单价快照、最低 USD 20、单笔待处理提现、支付宝/BSC 校验、收款资料密文与二次验证、管理员打款/驳回幂等；MySQL/PostgreSQL 并发双回调仅一笔账。 |
| 统计与隐私 | 用户列表按 `invitee_id` 去重统计 `awarded + withheld`，排除 `reversed`；`aff_count` 不参与；普通用户仅见脱敏身份，管理员页面不泄露支付引用。 |
| 前端 | 七语言桌面与移动端；`Ɍ` 额度与 `USD/CNY` 实付不混淆；官方支付按钮、中文 Stripe→支付宝/Waffo→微信支付展示、确认弹窗人民币近似值、低于最低额度禁用态和支付/订阅上下排列；返利表桌面/移动一致；移动侧栏首击导航有效；VIP 仅在 Stripe/Waffo/Waffo Pancake 确认页看到完整双选项，其他分组和渠道仍使用官方确认流程。 |
| 七语言与内容 | en、zh-CN、zh-TW、fr、ja、ru、vi 的 RelayBases namespace 叶子键完全一致且均非空；切换语言会重新请求 status/notice/groups；公告按 ID+源哈希本地化，管理员编辑后原样保留；fr/ja/ru/vi 的后端业务报错回退英文。 |
| 最低充值 | 七种界面语言的 GetTopUpInfo、预设、报价、Stripe/Waffo/Waffo Pancake 下单均拒绝低于 Ɍ20；TOKENS 模式使用对应的请求单位；渠道设置更高时不得被统一策略降低；请求不得修改全局 PayMethods。 |
| Worker 边界 | Worker 旧 DOM/API 展示改写为 0；定价、模型和分组安全过滤继续生效；直连与代理页面金额、公告和模型集合一致。 |
| 构建 | 后端相关单测后运行 `go test ./...`；前端使用 Bun 执行 typecheck、测试和 production build；`relaykit` 有改动时额外执行 `cd relaykit && GOWORK=off go build ./...`。 |

## 8. 维护记录模板

每次新增定制时，在同一 PR 中追加一行，避免功能先上线、文档后遗忘：

| 日期 | 官方基线 | 定制/删除项 | 数据变更 | 外部依赖 | 验证与回滚 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-09 | `v1.0.0-rc.24` / `5c3abffe` | 新增订单实付快照、ISO 币种展示和有效受邀支付投影 | `top_ups.payment_amount`、`top_ups.payment_currency`；User 投影不落库 | 无新增 | 见第 4、7 节；回滚保留新增列 |
| 2026-08-09 | `v1.0.0-rc.24` / `88786a2b` | 推荐返利改为每位受邀用户仅首笔已验签正式付款可获返利，首笔不合格时不顺延；新增订单单位价快照、去重受邀用户投影、转余额缓存失效和精简的七语言界面 | `top_ups.referral_unit_price`；既有返利账本和用户返利余额不修改；User 投影不落库 | 无新增 | 见第 4、7 节；回滚保留新增列和全部历史返利 |
| 2026-08-09 | `v1.0.0-rc.24` / `5259a8e0` | 新增 VIP 海外渠道支付确认提醒和七语言双选项；支付与折扣计算不变 | 无 | RelayBases Telegram 客服 `https://t.me/relaybases` | 定向组件/交互/i18n 测试；回滚删除独立组件及确认弹窗的布尔接线 |
| 2026-08-10 | `v1.0.0-rc.24` / `fc5ab87f` | 将 Worker 中的 New API 展示迁入低耦合原生 feature；补齐七语言钱包、认证、导航、模型广场、公告/FAQ/notice/分组；最低充值由服务端策略统一管理 | 无 schema 变更；公告翻译仅为代码目录和源哈希映射 | `relaybases-site` Worker 仅保留安全与边缘服务 | 七语言递归覆盖、Go/前端全量测试、直连/代理差异；回滚应用不依赖 Worker 展示回退 |
| 2026-08-10 | `v1.0.0-rc.24` / `f087a738` | 以 feature-owned content/class slot 恢复 Infinite Canvas 顶栏胶囊、侧栏卡片、AI 标识、折叠态与移动端原样式；文档与 Canvas 链接透传七种语言和主题；登录/注册法律提示改为七语言完整句 | 无 | `site.relaybases.com`、`canvas.relaybases.com` | 前端 typecheck、10 项定向回归与 production build；回滚删除独立展示组件和窄 slot，不改导航数据或业务接口 |
| 2026-08-10 | `v1.0.0-rc.24` / `be1491c1` | 原样保留 Infinite Canvas 导航卡片，对超过 16 个字符的本地化标题仅收紧字距与字号，避免俄语等长标题被省略 | 无 | 无新增 | 七语言标题渲染与实际宽度验收；回滚删除 content-owned 紧凑标签属性与两条限定样式 |
| 2026-08-10 | `v1.0.0-rc.24` / `c65df902` | 重做钱包 Stripe/Waffo 品牌卡片的默认与选中层次，Waffo 改用仓库内静态品牌资源；明确自定义用户文案必须同提交补齐七语言 | 无 | 无新增 | 组件可访问状态/布局/品牌资源回归、七语言递归完整性、typecheck/lint/build；回滚删除 feature 卡片样式与三个窄选中态 props |
| 2026-08-10 | `v1.0.0-rc.24` / `73255c82` | 七种界面语言的 RelayBases 最低充值统一为 Ɍ20；GetTopUpInfo、预设、报价及 Stripe/Waffo/Waffo Pancake 下单继续以服务端结果为准，渠道配置可设置更严格下限 | 无 | 无新增 | 七语言文案覆盖、USD/TOKENS 入口级最低充值回归；回滚恢复上一版语言分层常量 |
| 2026-08-10 | `v1.0.0-rc.24` / `61ab0267` | 统一所有支付方式卡片、报价与下单入口的严格最低额；修复重复渠道的精确选中/加载状态；充值预设和手机应付摘要改为七语言短标签与 `$` 紧凑金额，并新增七语言变更集合 CI 门禁 | 无 | 无新增 | Epay/Stripe/Waffo/Waffo Pancake 八入口回归、320px 布局、234 项前端测试、Go 全量测试及 production build；回滚该提交并保留上一版最低额策略 |
| 2026-08-27 | `v1.0.0-rc.26-relaybases.36` | 撤销钱包支付卡片的定制品牌样式与 CTA 文案，恢复官方按钮；中文仅做 Stripe→支付宝、Waffo→微信支付的展示映射，并在确认弹窗补充人民币近似值；Stripe 中文一次性 Checkout 传 `alipay`，Waffo Pancake 因 SDK 无付款方式字段保持原接口 | 无 | Stripe Checkout、Waffo/Waffo Pancake | 受影响前端测试、七语言覆盖、Go Stripe 测试、S12 隔离 typecheck/lint/build；发布时只重建 new-api，保留本次镜像回滚标签 |
| 2026-08-11 | `v1.0.0-rc.24` / `7812e610` | 新增不影响 API 计费分组的 Partner 资格、专属比例、每笔 USD 佣金、7 天结算、余额转换、支付宝/BSC 提现与七语言专属页面 | `referral_reward_claims` 增加 program/佣金结算字段；新增 partner profiles/wallet/entries/withdrawals 四表；不回填历史 | 无新增 | Go 账务/退款/提现/加密、七语言与前端构建、MySQL/PostgreSQL 并发和迁移烟测；应用回滚保留新增表列且先暂停合伙人入口 |
| 2026-08-11 | `v1.0.0-rc.24` / `0a89f5a8` | New API favicon 固定为与官网和 Infinite Canvas 一致的版本化圆形 RelayBases 图标；后台站点 Logo 继续只用于页面品牌展示 | 无 | 无新增 | favicon 所有权回归、typecheck、production build 与静态资产哈希；回滚前端提交或上一镜像即可 |
| YYYY-MM-DD | tag + commit | 一句话说明 | 字段/迁移/无 | Worker/支付平台/无 | 测试命令、发布版本、回滚提交 |
