import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import {seedSurvey} from '../server/seed.js';
function loadPage(file,api,storage=new Map()){
  let definition;const events=[];
  const wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),redirectTo:o=>events.push(o.url),pageScrollTo:o=>events.push(o.selector),showToast:o=>events.push(o.title),showModal:()=>{}};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:()=>api,Page:d=>{definition=d;},wx,getApp:()=>({globalData:{}}),console});
  const page={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(update){for(const [key,value] of Object.entries(update)){const parts=key.split('.');let target=this.data;for(const p of parts.slice(0,-1))target=target[p] ??= {};target[parts.at(-1)]=value;}}};
  return {page,storage,events};
}
test('原生小程序：手机格式错误不能提交，完成后保存成功信息',async()=>{
  const calls=[];const survey={...JSON.parse(JSON.stringify(seedSurvey)),id:'huatangning',version:1};
  const api={async request(route,method,body){calls.push({route,method,body});if(route==='/surveys/current')return {survey,response:null};if(route.endsWith('/responses'))return {completion:survey.completion};return {ok:true};}};
  const {page,events,storage}=loadPage('miniprogram/pages/survey/index.js',api);
  await page.load();
  for(const [qid,value] of Object.entries({q1:'o2',q2:'o3',q3:'o4',q4:['o1','o2'],q5:'o3',phone:'123'}))page.answer({currentTarget:{dataset:{qid}},detail:{value}});
  await page.submit();assert.equal(calls.filter(c=>c.route.endsWith('/responses')).length,0);assert.match(page.data.error,/11 位/);
  page.answer({currentTarget:{dataset:{qid:'phone'}},detail:{value:'13800138000'}});await page.submit();
  assert.equal(calls.filter(c=>c.route.endsWith('/responses')).length,1);assert.equal(storage.has('draft-huatangning'),false);assert.ok(storage.get('completion'));assert.ok(events.includes('/pages/success/index'));
});
test('原生小程序：刷新恢复同版本草稿，更新后不复用过期答案',async()=>{
  const survey={...JSON.parse(JSON.stringify(seedSurvey)),id:'huatangning',version:2};
  const api={async request(route){return route==='/surveys/current'?{survey}:{};}};
  const storage=new Map([['draft-huatangning',{version:1,answers:{q1:'o2',phone:'13800138000'}}]]);
  const {page}=loadPage('miniprogram/pages/survey/index.js',api,storage);await page.load();assert.equal(Object.keys(page.data.answers).length,0);
  page.answer({currentTarget:{dataset:{qid:'q4'}},detail:{value:['o1','o2']}});await page.load();assert.equal(page.data.answers.q4.length,2);assert.equal(page.data.progress,1);
});
test('原生个人小程序绑定只调用微信登录与资料绑定',async()=>{
  const calls=[];const api={login:async()=>calls.push('login'),request:async route=>{calls.push(route);return {};},base:'https://example.com'};
  const {page,events}=loadPage('miniprogram/pages/bind/index.js',api);
  page.setData({config:{devLogin:false,privacyVersion:'2026-11-02'},consent:true,nickname:'参与者'});await page.bind({detail:{code:'should-not-use-phone-code'}});
  assert.deepEqual(calls,['login','/me/bind']);assert.ok(events.includes('/pages/survey/index'));
});
test('原生小程序配置可读取、页面完整且素材低于主包限制',()=>{
  const app=JSON.parse(fs.readFileSync('miniprogram/app.json','utf8'));for(const page of app.pages)for(const extension of ['js','json','wxml','wxss'])assert.ok(fs.existsSync(path.join('miniprogram',page+'.'+extension)));
  const bytes=fs.readdirSync('miniprogram/assets').reduce((n,f)=>n+fs.statSync('miniprogram/assets/'+f).size,0);assert.ok(bytes<1.8*1024*1024);
  assert.equal(app.__usePrivacyCheck__,true);
});
