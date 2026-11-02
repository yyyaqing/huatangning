import fs from 'node:fs';
import crypto from 'node:crypto';
if (fs.existsSync('.env')) { console.log('.env 已存在，未覆盖。'); process.exit(0); }
const password = crypto.randomBytes(15).toString('base64url');
fs.writeFileSync('.env', `NODE_ENV=development\nDATABASE_DRIVER=sqlite\nCLOUD_HOSTING=false\nHOST=127.0.0.1\nPORT=3000\nPUBLIC_ORIGIN=http://localhost:3000\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${password}\nENABLE_DEV_LOGIN=true\n`);
fs.writeFileSync('.local-start.txt', `仅本机开发账号\n后台：http://localhost:3000/admin/\n设计预览：http://localhost:3000/preview/\n账号：admin\n密码：${password}\n生产环境必须更换凭据并关闭 ENABLE_DEV_LOGIN。\n`);
console.log('本地配置已生成，账号见 .local-start.txt；运行 npm run build 和 npm start。');
