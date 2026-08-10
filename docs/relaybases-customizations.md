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
| 返利退款/争议撤销 | 以支付渠道 + 规范化支付引用的摘要串行化 grant/reversal；Stripe、Creem、Waffo、Waffo Pancake 的可机读退款/争议自动撤销，Epay 可走审计过的管理员兜底。已转入正常余额的返利也会被扣回；无法完全追回时留下运维错误。 | [model/referral_reward.go](../model/referral_reward.go)、[controller/topup_stripe.go](../controller/topup_stripe.go)、[controller/topup_creem.go](../controller/topup_creem.go)、[controller/topup_waffo.go](../controller/topup_waffo.go)、[controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go) | Webhook 事件名、幂等 ID 和退款引用字段；回调重试是否仍返回可重试状态。 |
| 用户及管理员返利账本 | 用户只看脱敏后的受邀人标识；管理员有全站汇总、筛选和脱敏账本，不暴露订单号、支付引用或网关事件 ID。实付显示必须带 ISO 币种，例如 `USD 13.54`、`CNY 90.00`；返利额度继续显示为 `Ɍ`。 | [web/src/features/referral-rewards](../web/src/features/referral-rewards)、[web/src/features/admin-referral-rewards](../web/src/features/admin-referral-rewards)、[web/src/routes/_authenticated/referral-rewards/index.tsx](../web/src/routes/_authenticated/referral-rewards/index.tsx)、[web/src/routes/_authenticated/admin/referral-rewards/index.tsx](../web/src/routes/_authenticated/admin/referral-rewards/index.tsx) | 官方是否出现同名路由/API；合并时避免双菜单、双路由和重复 i18n key。 |
| 用户列表邀请投影 | `qualified_referral_invitees` 是 `referral_reward_claims` 中 `awarded + withheld` 的受邀用户去重数，`reversed` 不计入；旧 `qualified_referral_payments` 仅作兼容别名。它们是 `gorm:"-"` 非持久字段，列表、搜索和用户详情一次分组查询填充，避免 N+1。前端没有邀请人时留空，不显示占位文案。 | [model/user.go](../model/user.go)、[controller/user.go](../controller/user.go)、[web/src/features/users/components/users-columns.tsx](../web/src/features/users/components/users-columns.tsx)、[web/src/features/usage-logs/components/dialogs/user-info-dialog.tsx](../web/src/features/usage-logs/components/dialogs/user-info-dialog.tsx) | `aff_count` 不得重新作为权威统计；官方若新增返利用户统计，统一到一套语义后再删本投影。 |
| 用户可见管理员额度日志 | 管理员 add/subtract/override 额度时，日志归属受影响用户；管理员身份、来源 IP 等仍放在仅管理员可见的 `admin_info`，普通用户只能看到操作结果。 | [controller/audit.go](../controller/audit.go)、[controller/user.go](../controller/user.go)、[controller/user_manage_test.go](../controller/user_manage_test.go) | 官方审计日志是否已有“目标用户可见、操作者信息隐藏”的投影。 |

### 3.2 展示、品牌和兼容性定制

| 模块 | 当前状态 | 关键位置 | 升级注意 |
| --- | --- | --- | --- |
| RelayBases 公网分享元数据 | 在部署入口增加 RelayBases favicon、manifest、Open Graph、Telegram/X 卡片和说明文案。它只定制部署外观；不得删除或改写仓库内 new-api、QuantumNous、AGPL、版权和源码归属。 | [web/index.html](../web/index.html)、[web/public](../web/public) | 官方重构入口模板时仅重新应用部署元数据，不批量替换官方名称。 |
| VIP 海外渠道支付确认提醒 | 仅当用户分组精确为 `vip` 且选择 Stripe、Waffo 或 Waffo Pancake 时，在付款摘要内提示海外渠道手续费较高、VIP 8 折不会自动应用，并提供前往 RelayBases 官方 Telegram 客服或按当前显示金额继续付款两种选择。当前显示金额可能已包含公开充值优惠；本提示只说明 VIP 优惠，不改变支付、折扣或入账计算。 | [web/src/features/wallet/relaybases-vip-payment-warning-policy.ts](../web/src/features/wallet/relaybases-vip-payment-warning-policy.ts)、[web/src/features/wallet/components/relaybases-vip-payment-warning.tsx](../web/src/features/wallet/components/relaybases-vip-payment-warning.tsx)、[web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx](../web/src/features/wallet/components/dialogs/payment-confirm-dialog.tsx) | 官方若支持按用户分组与渠道配置确认提醒，迁移到官方能力后删除本地组件和单个布尔接线；保持客服地址与官网 canonical 入口一致。 |
| 原生 RelayBases 展示层与七语言 | RelayBases 自定义钱包、支付渠道说明、注册权益、法律同意文案、状态/无限画布导航、模型广场补充信息和通用日志导出入口均位于 `web/src/features/relaybases`；上游组件只保留窄接线点。自定义前端文案使用独立 `relaybases` i18next namespace，并且 en、zh-CN、zh-TW、fr、ja、ru、vi 七份资源必须具有完全相同的叶子键。静态文档暂只提供中英文时，其他界面语言明确回退英文。 | [web/src/features/relaybases](../web/src/features/relaybases)、[web/src/i18n/config.ts](../web/src/i18n/config.ts)、[web/index.html](../web/index.html) | 官方新增同等 slot、品牌配置或本地化能力时，优先换成官方入口并删除宿主补丁；每个新自定义键必须在同一 PR 补齐七语言并通过递归覆盖测试。 |
| 公告与部署内容本地化 | `/api/status` 中当前公告、FAQ、API 地址说明，`/api/notice` 以及用户可用分组说明按请求界面语言返回七语言内容。条目使用稳定 ID 与源内容 UTF-16 FNV 哈希绑定；管理员修改源内容后哈希不匹配即原样返回，旧翻译不得覆盖新公告。归档公告仅由明确 ID 清单过滤。后端业务报错仍使用官方 en/zh-CN/zh-TW bundle，fr/ja/ru/vi 回退英文。 | [relaybases/contenti18n](../relaybases/contenti18n)、[controller/misc.go](../controller/misc.go)、[controller/group.go](../controller/group.go)、[web/src/features/relaybases/content](../web/src/features/relaybases/content) | 新增或修改公告时，必须同步稳定 ID、最新源哈希和七语言正文；不得按正文模糊匹配。管理员临时编辑优先于仓库翻译。 |
| 按界面语言执行最低充值 | 服务端以登录用户保存的界面语言为准：zh-CN/zh-TW 最低 Ɍ20，en/fr/ja/ru/vi 最低 Ɍ100，并与各支付渠道配置的最低值取更严格者。GetTopUpInfo、预设选项、报价和实际下单入口共用同一策略；浏览器展示值不能绕过服务端。 | [controller/relaybases_topup_policy.go](../controller/relaybases_topup_policy.go)、[controller/topup.go](../controller/topup.go)、[controller/topup_stripe.go](../controller/topup_stripe.go)、[controller/topup_waffo.go](../controller/topup_waffo.go)、[controller/topup_waffo_pancake.go](../controller/topup_waffo_pancake.go) | 官方若提供服务端分层最低充值策略，迁移后删除本地 helper；支付入口、报价入口和展示数据必须始终使用同一结果。 |
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
| 统计与隐私 | 用户列表按 `invitee_id` 去重统计 `awarded + withheld`，排除 `reversed`；`aff_count` 不参与；普通用户仅见脱敏身份，管理员页面不泄露支付引用。 |
| 前端 | 中/英文桌面与移动端；`Ɍ` 额度与 `USD/CNY` 实付不混淆；返利表桌面/移动一致；移动侧栏首击导航有效；VIP 仅在 Stripe/Waffo/Waffo Pancake 确认页看到完整双选项，其他分组和渠道仍使用官方确认流程。 |
| 七语言与内容 | en、zh-CN、zh-TW、fr、ja、ru、vi 的 RelayBases namespace 叶子键完全一致且均非空；切换语言会重新请求 status/notice/groups；公告按 ID+源哈希本地化，管理员编辑后原样保留；fr/ja/ru/vi 的后端业务报错回退英文。 |
| 最低充值 | zh-CN/zh-TW 的 GetTopUpInfo、预设、报价、Stripe/Waffo/Waffo Pancake 下单均拒绝低于 Ɍ20；其他五种界面语言同样拒绝低于 Ɍ100；渠道设置更高时不得被语言策略降低；请求不得修改全局 PayMethods。 |
| Worker 边界 | Worker 旧 DOM/API 展示改写为 0；定价、模型和分组安全过滤继续生效；直连与代理页面金额、公告和模型集合一致。 |
| 构建 | 后端相关单测后运行 `go test ./...`；前端使用 Bun 执行 typecheck、测试和 production build；`relaykit` 有改动时额外执行 `cd relaykit && GOWORK=off go build ./...`。 |

## 8. 维护记录模板

每次新增定制时，在同一 PR 中追加一行，避免功能先上线、文档后遗忘：

| 日期 | 官方基线 | 定制/删除项 | 数据变更 | 外部依赖 | 验证与回滚 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-09 | `v1.0.0-rc.24` / `5c3abffe` | 新增订单实付快照、ISO 币种展示和有效受邀支付投影 | `top_ups.payment_amount`、`top_ups.payment_currency`；User 投影不落库 | 无新增 | 见第 4、7 节；回滚保留新增列 |
| 2026-08-09 | `v1.0.0-rc.24` / `88786a2b` | 推荐返利改为每位受邀用户仅首笔已验签正式付款可获返利，首笔不合格时不顺延；新增订单单位价快照、去重受邀用户投影、转余额缓存失效和精简的七语言界面 | `top_ups.referral_unit_price`；既有返利账本和用户返利余额不修改；User 投影不落库 | 无新增 | 见第 4、7 节；回滚保留新增列和全部历史返利 |
| 2026-08-09 | `v1.0.0-rc.24` / `5259a8e0` | 新增 VIP 海外渠道支付确认提醒和七语言双选项；支付与折扣计算不变 | 无 | RelayBases Telegram 客服 `https://t.me/relaybases` | 定向组件/交互/i18n 测试；回滚删除独立组件及确认弹窗的布尔接线 |
| 2026-08-10 | `v1.0.0-rc.24` / `fc5ab87f` | 将 Worker 中的 New API 展示迁入低耦合原生 feature；补齐七语言钱包、认证、导航、模型广场、公告/FAQ/notice/分组；按界面语言执行 Ɍ20/Ɍ100 最低充值 | 无 schema 变更；公告翻译仅为代码目录和源哈希映射 | `relaybases-site` Worker 仅保留安全与边缘服务 | 七语言递归覆盖、Go/前端全量测试、直连/代理差异；回滚应用不依赖 Worker 展示回退 |
| 2026-08-10 | `v1.0.0-rc.24` / `f087a738` | 以 feature-owned content/class slot 恢复 Infinite Canvas 顶栏胶囊、侧栏卡片、AI 标识、折叠态与移动端原样式；文档与 Canvas 链接透传七种语言和主题；登录/注册法律提示改为七语言完整句 | 无 | `site.relaybases.com`、`canvas.relaybases.com` | 前端 typecheck、10 项定向回归与 production build；回滚删除独立展示组件和窄 slot，不改导航数据或业务接口 |
| YYYY-MM-DD | tag + commit | 一句话说明 | 字段/迁移/无 | Worker/支付平台/无 | 测试命令、发布版本、回滚提交 |
