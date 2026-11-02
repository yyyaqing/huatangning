import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.js';
import {configFromEnv} from '../server/config.js';
import {normalizePublicOrigin,trustedAdminOrigin} from '../server/origin.js';

test('生产环境未填写域名时不再回落到 localhost，显式域名会规范化',()=>{
  assert.equal(configFromEnv({NODE_ENV:'production'}).publicOrigin,'');
  assert.equal(configFromEnv({NODE_ENV:'development'}).publicOrigin,'http://localhost:3000');
  assert.equal(normalizePublicOrigin(' https://Example.COM/ ',true),'https://example.com');
  assert.throws(()=>normalizePublicOrigin('http://example.com',true),/必须为 HTTPS/);
  for(const origin of ['https://example.com/admin','https://user:password@example.com','https://example.com?x=1'])assert.throws(()=>normalizePublicOrigin(origin,true),/只填写访问域名/);
});

test('自动域名仍拒绝跨站、HTTP、null Origin，显式域名仍优先生效',()=>{
  const req=origin=>({get:()=>origin,host:'survey.example.com',protocol:'http'});
  assert.equal(trustedAdminOrigin(req('https://survey.example.com'),'',true),true);
  for(const origin of ['https://evil.example','http://survey.example.com','null'])assert.equal(trustedAdminOrigin(req(origin),'',true),false);
  assert.equal(trustedAdminOrigin(req('https://survey.example.com'),'https://configured.example',true),false);
  assert.equal(trustedAdminOrigin(req('https://configured.example'),'https://configured.example',true),true);
});

test('生产首次部署可健康启动，代理同源登录成功且跨站登录被拒绝',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'htn-origin-'));
  const {app,db}=await createApp({...configFromEnv({NODE_ENV:'production',TRUST_PROXY:'1'}),databaseDriver:'sqlite',dataDir:path.join(directory,'data'),uploadDir:path.join(directory,'uploads'),adminPassword:'origin-test-password'});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    assert.equal((await fetch(base+'/api/health')).status,200);
    const login=origin=>fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Host:'internal-service:80','X-Forwarded-Host':'survey.example.com','X-Forwarded-Proto':'https',Origin:origin},body:JSON.stringify({username:'admin',password:'origin-test-password'})});
    const good=await login('https://survey.example.com');assert.equal(good.status,200);assert.match(good.headers.get('set-cookie'),/Secure/);
    assert.equal((await login('https://evil.example')).status,403);
    assert.equal((await login('http://survey.example.com')).status,403);
    app.set('trust proxy',0);
    assert.equal((await login('https://survey.example.com')).status,403);
  }finally{
    await new Promise(resolve=>server.close(resolve));await db.close();assert.equal(path.dirname(directory),os.tmpdir());fs.rmSync(directory,{recursive:true,force:true});
  }
});
