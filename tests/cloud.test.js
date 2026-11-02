import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mysqlAdapter,mysqlSettings,mysqlSql} from '../server/mysql.js';

test('云托管沿用模板 MySQL 环境变量及默认数据库',()=>{
  const config=mysqlSettings({MYSQL_ADDRESS:'10.0.0.2:3307',MYSQL_USERNAME:'tester',MYSQL_PASSWORD:'fixture-only'});
  assert.equal(config.database,'nodejs_demo');assert.equal(config.host,'10.0.0.2');assert.equal(config.port,3307);assert.equal(config.multipleStatements,false);
  assert.throws(()=>mysqlSettings({MYSQL_ADDRESS:'10.0.0.2',MYSQL_USERNAME:'tester',MYSQL_PASSWORD:'fixture-only',MYSQL_DATABASE:'invalid;sql'}),/数据库名/);
});
test('MySQL 适配器保留参数绑定和不可重复插入语义',async()=>{
  const calls=[];const db=mysqlAdapter({async query(sql,args){calls.push({sql,args});return [sql.startsWith('SELECT')?[{n:2}]:{affectedRows:1,insertId:3}];},async end(){calls.push('closed');}});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM users WHERE nickname=?').get("' OR 1=1")).n,2);
  assert.deepEqual(calls[0].args,["' OR 1=1"]);
  assert.equal((await db.prepare('INSERT OR IGNORE INTO starts VALUES (?,?,?)').run('a','b','c')).changes,1);
  assert.match(calls[1].sql,/INSERT IGNORE/);
  assert.equal(mysqlSql("json_extract(r.snapshot,'$.respondent.phone')"),"JSON_UNQUOTE(JSON_EXTRACT(r.snapshot,'$.respondent.phone'))");await db.close();
});
test('原生云托管请求携带服务名、环境 ID 与会话，不走普通 wx.request',async()=>{
  const calls=[];const module={exports:{}};
  const wx={getStorageSync:()=> 'fixture-session',cloud:{callContainer(options){calls.push(options);options.success({statusCode:200,data:{ok:true}});}},request(){throw new Error('不应调用 wx.request');},getFileSystemManager(){return {readFile(o){o.success({data:'aGVsbG8='});}};}};
  vm.runInNewContext(fs.readFileSync('miniprogram/utils/api.js','utf8'),{require:()=>({mode:'cloud',cloudEnv:'fixture-env',cloudService:'fixture-service',allowDevLogin:false}),module,wx,console});
  assert.equal((await module.exports.request('/me')).ok,true);assert.equal(calls[0].path,'/api/me');assert.equal(calls[0].config.env,'fixture-env');assert.equal(calls[0].header['X-WX-SERVICE'],'fixture-service');assert.equal(calls[0].header.Authorization,'Bearer fixture-session');
  await module.exports.uploadAvatar('/tmp/avatar.png');assert.equal(calls[1].path,'/api/me/avatar');assert.equal(calls[1].data.avatarData,'aGVsbG8=');
});
