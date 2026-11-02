# 华堂宁问卷调查 · 微信云托管

微信原生小程序 + Vue 3 管理后台 + Node.js 24 / Express + 云托管 MySQL。由微信云托管 Express 模板二次开发，沿用 `master` 分支及控制台已创建的 CI/CD，Push 后由原流水线构建、部署。

## 云托管上线配置

控制台服务设置：**容器端口保持 `80`**，代码目录为仓库根目录，Dockerfile 为根目录 `Dockerfile`。控制台实际设置优先；`container.config.json` 仅用于模板初始化，修改它不会更新现有服务。

在控制台配置环境变量，密码及 AppSecret 不要写入仓库：

| 变量 | 填写内容 |
|---|---|
| `PUBLIC_ORIGIN` | 可留空，自动匹配当前 HTTPS 访问域名；也可固定填写实际 HTTPS 服务地址 |
| `ADMIN_USERNAME` | 管理员账号，默认 `admin` |
| `ADMIN_PASSWORD` | 首次初始化管理员的独立随机密码，至少 12 位 |
| `MYSQL_ADDRESS` | 沿用模板已注入的云 MySQL 地址，格式 `主机:端口` |
| `MYSQL_USERNAME` | 沿用模板的云 MySQL 用户名 |
| `MYSQL_PASSWORD` | 沿用模板的云 MySQL 密码 |
| `MYSQL_DATABASE` | 默认 `nodejs_demo`，与原模板一致；可指定已存在的专用数据库 |
| `WX_APP_ID` | 真实个人微信小程序 AppID |
| `WX_APP_SECRET` | 对应 AppSecret，仅保存在服务端 |

Dockerfile 已设置 `NODE_ENV=production`、`HOST=0.0.0.0`、`PORT=80`、`DATABASE_DRIVER=mysql`、`CLOUD_HOSTING=true`、`TRUST_PROXY=1`、`ENABLE_DEV_LOGIN=false`。控制台如存在同名变量，请设置相同值。云模式禁止使用 SQLite 保存线上数据。

- 首次启动创建业务表和初始问卷，不删除模板计数器表，不清空已有问卷、答卷或管理员。
- `PUBLIC_ORIGIN` 留空时生产服务可正常启动，后台写请求按当前 HTTPS 访问域名校验来源；显式填写 HTTP、路径或错误 URL 时仍拒绝启动。首次管理员密码缺失、数据库配置缺失或连接失败仍会拒绝启动。
- AppID / AppSecret 尚未填写时可使用后台，真实微信登录返回明确的未配置错误。
- 管理后台需要在控制台开启受支持的 HTTPS 公网访问方式。访问权限及小程序调用方按实际主体设置。
- 部署后先检查 `/api/health` 返回 `{"ok":true}`，再访问 `/admin/` 登录。

## 小程序配置

微信开发者工具导入 `miniprogram/`，把 `project.config.json` 中游客 AppID 改为真实 AppID，修改 `config.js`：

```js
module.exports = {
  mode: 'cloud',
  cloudEnv: '填写云托管环境ID',
  cloudService: '填写云托管服务名',
  API_BASE: '', // cloud 模式接口、头像均通过 callContainer
  allowDevLogin: false
};
```

1. 控制台允许对应小程序访问服务，跨主体／跨环境授权按控制台提示完成。
2. 小程序使用 `wx.cloud.init`、`wx.cloud.callContainer`，携带 `X-WX-SERVICE`。服务端通过 `code2Session` 验证登录，不信任客户端伪造的 OpenID 请求头。
3. 云模式头像通过 JSON / Base64 上传，服务端验证 JPG/PNG、缩放为 256×256 PNG 后存入 MySQL。头像不依赖容器文件系统，扩缩容和重启后仍可访问。
4. 微信后台配置隐私保护指引，填写实际主体、联系方式、保存期限，声明 OpenID、主动提供的昵称头像、手填手机号、答案及用途。
5. 个人小程序不调用微信手机号授权；手机号在问卷中手动填写、必填并校验大陆 11 位号码格式，格式校验不等于短信验证或号码归属验证。
6. 执行 `node tools/check-release.js`，完成微信开发者工具真机测试后上传、提审、发布。

仓库保留本地开发配置（游客 AppID、HTTP 本机接口），便于验收。真实环境 ID、服务名和 AppID 尚未提供，发布前必须填写，不能直接上传游客配置。

## 功能

- 按两份 PSD 实现青绿色问卷与会议邀请成功页，复用品牌和科学视觉素材，原五题后增加必填手机号。
- 微信身份、昵称输入、头像选择、隐私同意及绑定门槛。
- 单选、多选、文本、必填手机号；题目增删排序、问卷复制、发布与结束。
- 草稿、答案校验、一人一份答卷、并发提交幂等。
- 内容修改递增版本，历史答卷保留原题与参与者资料快照。
- 记录查询、分页、答案详情、按版本分布、完成率、用时趋势。
- 真正 `.xlsx` 导出，含答题明细、选项统计、逐题完整答案、手机号和 OpenID；用户文字不作为公式执行。
- scrypt 密码散列、HttpOnly 管理会话、来源校验、请求限流、编辑及导出审计。

## 本地开发与测试

需要 Node.js 24+：

```powershell
npm ci
npm run setup:local
npm run build
npm start
```

后台 <http://localhost:3000/admin/>，预览 <http://localhost:3000/preview/>。随机账号见 `.local-start.txt`。本地默认 SQLite，无需安装 MySQL；云托管使用 MySQL，两者共用业务代码。

```powershell
npm test
npm run test:browser
```

浏览器默认使用本机 Chrome，可通过 `CHROME_PATH` 指定路径。截图位于 `design/verification/`。测试使用独立数据库及微信模拟服务，不能替代真实微信／云托管验收。

如已有独立 MySQL 测试实例，设置 `MYSQL_ADDRESS`、`MYSQL_USERNAME`、`MYSQL_PASSWORD`，再运行：

```powershell
$env:HTN_TEST_MYSQL='true'
node --test tests/api.test.js
```

该模式会创建随机命名的 `htn_test_*` 临时数据库，结束后只删除这个临时库，需要测试账户具备建库权限。不要用业务生产账号执行自动化测试。

## 后续更新

```sh
git pull --ff-only origin master
# 修改、测试后提交
git add <要提交的文件>
git commit -m "更新问卷功能"
git push origin master
```

推送后到微信云托管控制台查看原流水线构建日志及部署状态。GitHub 推送成功不代表云部署成功，也不代表小程序已审核发布。

## 数据、账号和备份

云数据位于 MySQL：`surveys`、`users`、`responses`、`starts`、`sessions`、`avatars`、`admins`、`audit_logs`。新镜像不会清空这些表。请启用数据库备份，按照隐私政策处理保留及删除请求。头像是压缩后的缩略图；大量用户或更大媒体可迁移对象存储。

首次启动后的 `ADMIN_PASSWORD` 不覆盖数据库密码。重置时在云托管终端通过 `NEW_ADMIN_PASSWORD` 环境变量提供至少 12 位新密码，执行 `node tools/reset-admin.js`，所有旧管理员会话会失效。

本地 SQLite 与云 MySQL 相互独立，部署代码不会上传本地测试数据；已有真实数据需要单独备份和迁移。`.env`、本地账号、数据库、上传资料、PSD 原件、node_modules 均已排除。

## 目录

```text
server/        微信、数据库适配、API、Excel
web/           Vue 管理后台及网页预览
miniprogram/   原生小程序、云调用、设计素材
tests/         API、云适配、原生逻辑及浏览器测试
tools/         本地配置、发布检查、密码维护及素材导出
design/        设计和验收说明
Dockerfile     云托管构建入口，监听 80
```

`compose.yaml` / `deploy/` 仅供另选自建服务器使用，不是微信云托管所必需。PSD 原字体未安装，动态文字采用系统字体，不能声明逐像素一致。
