import fs from 'node:fs';
import path from 'node:path';
import {zipSync} from 'fflate';
const files={};
function collect(relative){const item=fs.statSync(relative);if(item.isDirectory())for(const name of fs.readdirSync(relative))collect(path.join(relative,name));else files[relative.replaceAll('\\','/')]=new Uint8Array(fs.readFileSync(relative));}
for(const file of ['LICENSE','.gitattributes','container.config.json','package.json','package-lock.json','.env.example','.gitignore','.dockerignore','Dockerfile','compose.yaml','README.md'])collect(file);
for(const dir of ['server','web','miniprogram','deploy','tools','tests','dist'])collect(dir);
collect('design/IMPLEMENTATION.md');
collect('design/VERIFICATION.md');
fs.mkdirSync('releases',{recursive:true});
const target='releases/huatangning-survey.zip';
fs.writeFileSync(target,zipSync(files,{level:6}));
console.log(`部署包：${path.resolve(target)}（${Object.keys(files).length} 个文件）`);
