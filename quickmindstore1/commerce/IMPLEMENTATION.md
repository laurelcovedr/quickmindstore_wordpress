# QuickMind 折扣、代理商与 Invoice 体系 V1.0

状态：可操作设计预览，未启用真实优惠、支付验证、佣金付款或邮件发送。现有商店及 PayPal Hosted Button 不变。本方案直接对接现有管理平台，不迁移 Shopify。

## 1. 折扣规则草案

90%、80%、50%指支付原价的90%、80%、50%，即9折、8折、5折。首年租赁 USD499 + 年订阅 USD1,999。按项目以美分保存和计算，数量采用整数。折扣作用于首次租赁及首年订阅，不作用于运费、税费或下一年续订。不可叠加。

| 草案代码 | 支付比例 | 租赁 USD | 首年订阅 USD | 首年产品合计 USD |
|---|---:|---:|---:|---:|
| QM90 | 90% | 449.10 | 1,799.10 | 2,248.20 |
| QM80 | 80% | 399.20 | 1,599.20 | 1,998.40 |
| QM50 | 50% | 249.50 | 999.50 | 1,249.00 |

正式代码由后台生成，以上仅为私有预览样例。每张券保存：ID、展示代码、活动、支付比例、适用SKU、有效期、时区、总额度、每客户限额、绑定代理商（可空）、指定客户、状态和创建/审核人。建议9折公开促销、8折限定渠道、5折邀请制绑定客户、单次使用；以上均待业务确认。不得在公开源码中放入有效5折码。

价格API只接收SKU、数量、coupon_code及签名推荐令牌；不接受浏览器报价作为付款金额。服务器验证用户/券/市场/配置/库存，按已批准的税运费计算最终价格，生成15分钟有效的报价快照与随机ID。创建订单时原子预占券额度；付款完成后核销，取消/过期则释放。重复支付回调不得再次核销。有效5折码须后台校验，即使客户修改网页也不能获得未授权优惠。

汇率只用于本地参考展示，沿用站点的已标注日期汇率。折扣先在美元项目金额计算，再换算当地显示金额，并由显示项目求和。真实订单和invoice以收款USD金额为准。退款针对已付款的净项目金额，不按原价退款。

## 2. 代理商归属与结算草案

后台登记代理商ID、法定名称、国家、审核状态、合同版本、佣金比例、适用产品、起止日期、收款资料以及结算币种。US-A001为格式示例；本预览DEMO-US-A001不是获批代理商。佣金比例未设定，须按实际合同录入。

后台生成专属推荐链接、二维码和可选的绑定代理商优惠码。正式链接例如 `/?ref=<server-signed-referral-token>`；签名载荷包含代理商ID、渠道、有效期和nonce，不含客户身份信息。

客户访问时服务器验证签名及代理商ACTIVE状态并保存30天推荐归属。建议规则：结算前客户明确输入并通过验证的代理商推荐码优先；否则采用30天内首个有效推荐。直接访问不清除已有归属，后来的普通广告参数不覆盖代理商；普通优惠码也不覆盖推荐。归属在下单时写入订单并锁定，付款后改归属须后台审批留痕。不根据客户所在美国自动认定美国代理商，不把浏览器localStorage当结算凭证。

跨设备通过登录账号或确认邮件绑定订单；无法验证则标记未归属，交后台审核。冲突、异常自购及合同过期进入人工审核，不能无记录覆盖。

佣金基数 = 实收折后产品金额 − 产品退款；不含税费、运费。支付平台手续费是否扣减另在代理商合同约定，当前草案不扣减。佣金比例及规则在订单中快照保存；折扣与佣金分别计算。

佣金账本状态：待付款 → 冻结期 → 可结算 → 已进入结算单 → 已支付。建议付款完成后30天且退款/争议窗口结束、无争议才可结算；冻结期须按最终退货合同调整。按月生成USD结算单，列订单号、原价、折扣、实收、退款、基数、合同佣金率、佣金、状态。管理员复核后付款并记录付款凭证；同一账本行只能进入一个有效结算单。退款自动产生负调整；已结算则抵扣下一期，不修改已关闭历史账本。拒付或争议冻结相关佣金。

代理商登录只能查看自己的订单匿名汇总及结算单。后台财务可查看完整订单与审核记录；导出文件不得暴露不必要的客户健康/联系方式。

## 3. 付款后自动Invoice

继续使用PayPal；正式动态折扣结算改用服务端Orders API创建与Capture，与已确认的本地订单关联。Hosted Button目前没有已接通的订单金额与回调，不能仅更改网页数字就宣布真实折扣生效。

服务器通过PayPal验证Webhook签名；核对受款商户、关联订单、Capture状态COMPLETED、USD币种和应付金额。APPROVED、PENDING、浏览器“成功”页或截图不能触发已付款invoice。Capture API结果与Webhook统一进入幂等付款处理，并定期核对遗漏交易。

在数据库事务中：记录付款 → 核销折扣 → 锁定代理商 → 生成冻结佣金条目 → 分配唯一invoice号 → 写入发送队列。任何一步失败可重试，不能重复建账。

编号建议 `YIWEI-INV-2026-000001`，由数据库按年唯一序列生成；禁止使用浏览器时间戳计数。Invoice注明PAID和余额0，展示发行方YIWEI USA INC及既有地址/联系邮箱、客户确认的抬头/账单地址、invoice日期、订单号、付款参考号、设备租赁/订阅项目、数量、原价、折扣、税、运费、实付币种金额和服务期间。税号、税率及订阅起止日期须取后台真实资料，不编造或假定免税。这里的商业invoice不自动等同于中国税务发票或所有国家的税票。

自动邮件采用客户结算时明确填写的invoice_email，不盲目用不同的PayPal账户邮箱。收款成功后立即入队，目标5分钟内送达（设计目标）。发送PDF附件和带有效期的安全下载链接；语言跟随客户，美元金额保持不变。推荐从经域名验证的 `billing@quickmindstore.com` 发送，Reply-To为yiweiinc99@gmail.com；未验证域名时不冒用发件人。

队列状态：queued → generating → sending → sent/delivered；记录供应商message_id。失败按1分钟、5分钟、30分钟、2小时、24小时重试，退信及超限进入人工处理。发送幂等键为invoice_id+版本+收件人；供应商不支持幂等时，超时不得盲目重新发送，先查发送状态。客户可申请重发同一invoice，不重新计佣金。退款新增Credit Note并重新计算账本，不改写历史已付款invoice。

下载invoice使用不可枚举的、限时签名链接或客户登录鉴权；不部署客户invoice到公开静态路径。API密钥、PayPal Secret和邮件服务密钥只放服务端Secret。

## 4. 接口及后台表

| 接口 | 作用 | 安全边界 |
|---|---|---|
| POST /api/quotes | 校验SKU/折扣/签名归属，返回价格快照 | 服务端重算；不信任前端金额 |
| POST /api/orders | 确认客户、地址与报价；创建PayPal订单 | 报价未过期；原子预占优惠额度 |
| POST /api/orders/:id/capture | Capture并读取付款状态 | 订单所有者验证，幂等请求 |
| POST /api/webhooks/paypal | 验签、确认付款或退款 | 事件去重，金额/币种/商户核对 |
| GET /api/invoices/:id | 安全获取Invoice | 客户鉴权/限时签名 |
| POST /api/invoices/:id/resend | 同一Invoice重发 | 验证客户、限流、留痕 |
| GET /api/dealer/settlements | 代理商自己的结算单 | 代理商角色隔离 |
| POST /api/admin/settlements | 生成/审核结算批次 | 财务权限，不自动发起付款 |

最小表：products、coupons、coupon_reservations、coupon_redemptions、dealers、dealer_contracts、referrals、quotes、orders、order_lines、payment_events、payments、refunds、commission_ledger、settlements、settlement_lines、invoices、credit_notes、email_outbox、audit_log。

唯一约束：payment_events.provider_event_id；payments.capture_id；invoices.order_id；coupon_redemptions(coupon_id,order_id)；commission_ledger(payment_id,dealer_id,entry_kind,source_id)；settlement_lines.ledger_entry_id；email_outbox(invoice_id,version,recipient,purpose)。订单、合同、汇率和报价快照不可事后随当前配置改变。

## 5. 验收与接入

验收必须覆盖：9/8/5折，非法/过期码，5折绑定客户，不叠加，多设备，竞态限额，折后跨币种项目合计，代理商冲突和过期，跨设备关联，未付款/待付款不发Invoice，错误金额/币种/商户拒绝，重复/乱序回调不重复发票计佣金，部分退款/全额退款/拒付，结算后负调整，邮件失败重试和安全下载。

现有后台地址及API/开发接入方式尚未提供。启用真实自动化还需：PayPal REST应用的服务端凭据及Webhook配置、订单存储和队列、可用邮件发送服务及验证域名、获批代理商资料和合同佣金、折扣码有效期/额度/适用范围、已确认税运费与租赁退还政策。凭据通过受控Secret配置，不在聊天或源码中填写。

官方接入参考：
- https://developer.paypal.com/platforms/checkout/standard/integrate
- https://developer.paypal.com/api/rest/webhooks/rest/

本次交付的 commerce-engine.js 用于可测试价格与佣金规则，不能替代服务器价格校验、代理商认证、支付验签或Invoice邮件队列。
