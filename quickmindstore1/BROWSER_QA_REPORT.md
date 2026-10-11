# Store1 浏览器验收报告

日期：2026-10-12（北京时间）。PR #1；通过测试的源码提交：`d98037709a4e90f63ed529a62df368586dabe50e`。

## 结论

**GitHub Actions 对仓库源码的 Chromium 验收：37 个分组用例通过，0 失败。** 运行于 Ubuntu，Chromium 151.0.7922.34。共访问 120 个关键页面/视口组合（5 类页面 × 8 种语言 × 3 种视口），生成 74 张 PNG。此范围不是全部 244 个页面的逐页视觉验收，也不代表实体设备、Safari 或其他浏览器通过。

本次未确认需要修复的业务前端缺陷，业务源码保持不变。修改的是测试路径与截图方法。未部署、未合并 PR、未修改生产 quickmindstore.com、访问权限或 noindex。

- [成功运行与日志](https://github.com/laurelcovedr/quickmindstore_wordpress/actions/runs/38173050177)
- [74 张截图和完整 JSON 结果](https://github.com/laurelcovedr/quickmindstore_wordpress/actions/runs/38173050177/artifacts/11714542769)（需要仓库访问权限；Actions 附件保留至 2026-10-25 20:40 UTC）
- 永久结果记录：`browser-qa-artifacts/results.json`。截图附件摘要 SHA-256：`4e620a111fef61e975e0f6038652763fc4eb8b2e2c329569e3640ff110e194d0`。

## 验收与修改前后对照

| 项目 | 修改前/首次结果 | 本次处理及结果 | 验证边界 |
|---|---|---|---|
| 浏览器环境 | 本地缺少 Chromium，下载受阻 | GitHub Actions 成功安装并启动 Chromium | 仓库 dist 通过本地 HTTP 服务运行；不是已部署预览 |
| 手机/平板/桌面 | 未实测 | 390×844、768×1024、1440×900 三种视口通过页面宽度、导航及关键交互检查 | 视口模拟，不是实体设备；导航展开/收起仅在折叠按钮可见时执行 |
| 八种语言 | 静态/模拟检查 | en、zh-CN、es、fr、de、ja、ko、id 的首页、产品、价格、FAQ、联系页通过 | 不代表母语文案质量通过 |
| 语言切换 | 未实测 | 八语言切换保留 UTM 和锚点，通过 | 真实浏览器，使用确定的 IP 响应 |
| 主要购买入口 | 首轮错误地要求七种非英语产品页直接有 PayPal，21 个分组失败 | 按实际流程检查产品页可见询价入口及归因、价格页支付组件，全部通过 | 先询价流程；未提交订单 |
| 来源链接 | 第二轮精确 href 定位遗漏自动附加的 qm_source 参数 | 改为按路径前缀定位并检查归因标签；全部通过 | 测试定位修复，不是业务代码修复 |
| IP 默认值/手动覆盖 | 模拟检查 | 8 个国家响应、语言/货币默认值、手动覆盖、新 IP 情况、货币刷新持久化、网络失败回退通过 | ipapi 请求被 fixture 替代；不代表真实 IP 服务可用性 |
| FAQ | 未实测 | 鼠标展开、Enter 收起通过 | Chromium 键盘交互；未做屏幕阅读器验收 |
| 询盘表单 | 未实测 | 必填校验、虚构资料生成草稿、UTM 来源和 mailto 地址通过 | 未发送邮件、未验证送达或服务器线索入库 |
| PayPal 失败/重试 | 未实测 | 请求失败时错误提示与重试通过；fixture 渲染通过 | SDK 被阻断或替换；不是实际 PayPal 加载验证 |
| 截图 | 首轮全页截图可能尚未加载视口外图片 | 滚动可见图片、等待解码、再截图；生成 74 张 | 已查看中文手机产品、英文平板首页及英文桌面草稿等代表截图；未逐张完成人工审美评审 |
| 页面错误/noindex | 没有真实浏览器结果 | 所有页面分组无未捕获 JS 异常，关键页面 noindex 检查通过 | 不代表第三方 console/network 警告全部消除 |
| 真实付款/订单/webhook | real_payment_test=false | 继续保持 false | 需实际支付环境、订单后台、webhook、退款/优惠/代理结算/invoice 验收 |

## 复现和证据

首轮 Actions `38127083561`：16 通过、21 失败。任一非英语 `/home-product/` 页无直接 PayPal 组件，脚本报 `Payment entry absent`。读取实际流程后确认产品页提供询价，PayPal 在价格页，此为测试假设不适配。

第二轮 `38172950400`：16 通过、21 失败。询盘按钮 href 自动附加归因参数，精确 URL 选择器报 `Visible quotation entry absent`。修改选择器保留对路径和来源标签的验证。

最终运行 `38173050177`：37 通过、0 失败，2026-10-12 04:38:59–04:40:02（北京时间）。原有交互、归因、IP 和货币源码回归脚本也通过；这些模拟检查与真实浏览器结果分开记录。

从仓库 `quickmindstore1` 目录运行：

```bash
npm install --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

默认自动启动本地 dist 静态服务器；每组新建浏览器上下文。Geo 和 PayPal fixture 有明确标识，无真实支付、邮件发送或订单动作。输出到 `browser-qa-artifacts/`，失败返回非零退出码。Actions 在 PR 更新时运行，并保存 PNG/JSON 附件。

## 尚未验证

限制访问的已部署预览仍未完成登录验收；本次未改变其权限。原 `site-scan-validation.json` 保留此前静态扫描记录，本次新结果单独保存，不把它改写成已部署预览或真实付款通过。

实际 IP 国家矩阵需来自不同国家的网络实测。实际 PayPal SDK/hosted iframe 加载可在受信任环境设置 `QA_BASE_URL`、`QA_LIVE=1` 运行；私有预览的短期 `QA_SITE_TOKEN` 仅由环境变量传入且仅发往精确 Store1 域名，不提交、不打印。该模式不点击付款，仍不能替代真实支付/订单验收。
