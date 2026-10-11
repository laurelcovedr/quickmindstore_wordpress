# Store1 浏览器验收准备与阻塞记录

日期：2026-10-11。GitHub 基线：`41d853fcd8d16d376454d0eaec85183e70e26b29`。

## 当前结论

**浏览器验收未完成，不能批准上线。** 本次未确认任何前端问题，未修改业务源码。生产 quickmindstore.com、私有预览访问权限和 noindex 均未修改。

Playwright 已安装（1.62.1），但本机缺少 Chromium 可执行文件。实际启动失败；官方浏览器下载连续返回无法解压的包。远程浏览器打开独立预览后显示 `Sign in required / Log in to access / Continue with ChatGPT`，没有进入 Store1 内容。另一个 CDP 连接尝试返回 502。以上都是环境/访问阻塞，不是已确认的网站错误。

## 前后对照与验收状态

| 项目 | 修改前 | 本次交付 | 实际状态 |
|---|---|---|---|
| 重复浏览器验收 | 只有静态/模拟脚本 | 新增 Playwright 浏览器脚本和 GitHub Actions | 语法检查通过；启动受阻，0 条浏览器用例通过 |
| 手机/平板/桌面 | 未实测 | 390×844、768×1024、1440×900 的布局、菜单和截图用例 | 待执行；视口模拟不代表实体设备或 Safari |
| 八种语言 | 静态/模拟检查 | 首页/产品/价格/FAQ/表单矩阵，以及切换保留 URL 参数和锚点 | 待执行 |
| IP 默认语言/货币 | 模拟检查 | 8 个国家响应、网络失败、手动覆盖及刷新持久化用例 | 待执行；固定响应为 fixture，不代表真实 IP |
| FAQ | 未实测 | 鼠标展开、键盘 Enter 收起 | 待执行 |
| 询盘 | 邮件草稿机制 | 必填验证、生成草稿、来源参数和 mailto 检查；只用虚构资料 | 待执行；不代表邮件送达 |
| PayPal | 未实测 | SDK 失败/重试及 fixture 渲染；另有不拦截 SDK 的 live 模式 | 待执行；fixture 不是 PayPal 验证 |
| 真付款/订单/折扣/结算/invoice | real_payment_test=false | 明确保留 false | 仍需支付及订单后台、webhook、测试账户和经授权的交易验收 |
| 前端修复 | 没有浏览器错误证据 | 未作推测性修复 | 取得失败记录后再修复并回归 |

## 运行和证据

从仓库的 `quickmindstore1` 目录运行：

```bash
npm install --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

不设置 `QA_BASE_URL` 时，脚本自动启动本地静态服务器，使用仓库 dist；每个用例新建浏览器上下文。输出 `browser-qa-artifacts/results.json` 和关键页面 PNG。失败保持非零退出码。截图是验收证据，仍需人工视觉检查，不能单凭无横向溢出断言排版美观。

GitHub Actions 在 PR 或手动运行时安装 Chromium，执行相同脚本，并保存结果与截图为 14 天的 workflow artifact。此配置尚未运行；不能把配置存在视为通过。

针对限制访问的预览，可在受信任执行环境通过环境变量传入短期 `QA_SITE_TOKEN`，只发送到精确的 Store1 域名；不要提交或打印令牌：

```bash
QA_BASE_URL=https://quickmind-store1.lawrence-wan-0405.chatgpt.site QA_LIVE=1 npm run test:browser
```

`QA_LIVE=1` 不拦截 IP 或 PayPal 请求，只验证 SDK 和 iframe 加载，不点击支付、不开订单、不发邮件。真实 IP 地区矩阵需要来自不同国家的实际网络结果；本次 fixture 用例不能替代。

## 复现阻塞

1. 在当前执行环境运行 `node tests/browser/run.cjs`：返回缺少 chromium_headless_shell-1234 的错误；结果文件记录 browser_qa=false、real_payment_test=false、cases=[]。
2. 打开独立预览：显示登录页，无法检查 Store1 的菜单和页面。

接下来需要可运行 Chromium 的执行环境（可用上述 Actions），以及已获授权登录的预览浏览器。完成后把实际失败、截图和修复回归追加到本报告，再将 PR 标为可审阅。
