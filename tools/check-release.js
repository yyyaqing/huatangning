import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const config=require('../miniprogram/config.js');
const project=JSON.parse(fs.readFileSync('miniprogram/project.config.json','utf8'));
const problems=[];
if(!/^wx[a-zA-Z0-9]{16}$/.test(project.appid))problems.push('请填写真实微信小程序 AppID');
if(config.mode==='cloud'){
  if(!config.cloudEnv || !config.cloudService)problems.push('请填写 cloudEnv 环境 ID 和 cloudService 服务名');
}else if(!/^https:\/\/[a-zA-Z0-9.-]+(?::443)?\/?$/.test(config.API_BASE))problems.push('API_BASE 必须是已配置证书的 HTTPS 域名（不含 /api）');
if(config.allowDevLogin)problems.push('将 miniprogram/config.js 的 allowDevLogin 设为 false');
const bytes=fs.readdirSync('miniprogram/assets').reduce((n,f)=>n+fs.statSync('miniprogram/assets/'+f).size,0);
if(bytes>1.8*1024*1024)problems.push('静态素材接近或超过小程序主包限制，请压缩');
if(problems.length){console.error('发布前待完成：\n'+problems.map(s=>' - '+s).join('\n'));process.exitCode=1;}else console.log('静态发布检查通过；仍需微信开发者工具编译、真机测试和审核。');
