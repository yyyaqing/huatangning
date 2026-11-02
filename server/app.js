import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { unpack } from './db.js';
import { openStorage } from './storage.js';
import { hashPassword, verifyPassword, digest, issueSession } from './security.js';
import { createWechat } from './wechat.js';
import { surveySchema, validateAnswers } from './validation.js';
import { exportWorkbook } from './export.js';
import {normalizePublicOrigin,trustedAdminOrigin} from './origin.js';

export async function createApp(config, adapters = {}) {
  const production = config.nodeEnv === 'production';
  if (production && config.enableDevLogin) throw new Error('生产环境禁止 ENABLE_DEV_LOGIN');
  const publicOrigin=normalizePublicOrigin(config.publicOrigin,production);
  const db = await openStorage(config);
  if(!(await db.prepare('SELECT id FROM admins LIMIT 1').get())) {
    if(!config.adminPassword || config.adminPassword.length < 12) throw new Error('首次启动请设置至少 12 位 ADMIN_PASSWORD');
    (await db.prepare('INSERT OR IGNORE INTO admins(username,password_hash) VALUES (?,?)').run(config.adminUsername || 'admin',hashPassword(config.adminPassword)));
  }
  const wechat = adapters.wechat || createWechat(config);
  const app = express();
  app.disable('x-powered-by');
  if(config.trustProxy) app.set('trust proxy',config.trustProxy);
  app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],fontSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"]}},strictTransportSecurity:production?undefined:false}));
  app.use(express.json({limit:'4500kb'}),cookieParser());
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'请求过于频繁，请稍后重试'}}));
  app.use('/api/admin',(req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && !trustedAdminOrigin(req,publicOrigin,production)) return res.status(403).json({error:'请求来源不受信任'});
    next();
  });
  const authLimiter = rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'登录尝试过多，请 15 分钟后重试'}});
  const fail = (status,message)=>{throw Object.assign(new Error(message),{status});};
  const audit = async (req,action,target)=>(await db.prepare('INSERT INTO audit_logs(actor,action,target,created_at) VALUES (?,?,?,?)').run(req.auth?.user_id || 'system',action,target,new Date().toISOString()));
  function auth(role, bound=false) {
    return async (req,res,next)=>{
      const token = role === 'admin' ? req.cookies.admin_session : req.headers.authorization?.replace(/^Bearer /,'');
      const session = token && (await db.prepare('SELECT * FROM sessions WHERE hash=? AND role=? AND expires_at>?').get(digest(token),role,Date.now()));
      if(!session) return res.status(401).json({error:'请先登录'});
      req.auth = session;
      if(role === 'user') {
        req.user = (await db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id));
        if(!req.user) return res.status(401).json({error:'用户不存在，请重新登录'});
        if(bound && !req.user.bound) return res.status(403).json({error:'请先完成微信绑定',code:'BIND_REQUIRED'});
      }
      next();
    };
  }
  const publicUser = u=>({id:u.id,nickname:u.nickname,avatar:u.avatar,bound:!!u.bound});
  async function loginUser(openid) {
    let user = (await db.prepare('SELECT * FROM users WHERE openid=?').get(openid));
    if(!user) {
      const id = crypto.randomUUID();
      (await db.prepare('INSERT OR IGNORE INTO users(id,openid,created_at) VALUES (?,?,?)').run(id,openid,new Date().toISOString()));
      user = (await db.prepare('SELECT * FROM users WHERE openid=?').get(openid));
    }
    return {token:(await issueSession(db,user.id,'user')),user:publicUser(user)};
  }
  app.get('/api/health',async (_req,res)=>{(await db.prepare('SELECT 1').get());res.json({ok:true});});
  app.get('/favicon.ico',(_req,res)=>res.status(204).end());
  app.get('/api/config',(_req,res)=>res.json({name:'华堂宁问卷调查',collectPhoneInSurvey:true,devLogin:!production && !!config.enableDevLogin,privacyVersion:'2026-11-02'}));
  app.post('/api/auth/wechat',authLimiter,async(req,res)=>{
    const {code} = z.object({code:z.string().min(1).max(512)}).parse(req.body);
    res.json((await loginUser(await wechat.login(code))));
  });
  app.post('/api/auth/dev',authLimiter,async (req,res)=>{
    if(production || !config.enableDevLogin) return res.status(404).json({error:'接口不存在'});
    const {deviceId} = z.object({deviceId:z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/)}).parse(req.body);
    res.json((await loginUser(`dev_${deviceId}`)));
  });
  app.get('/api/me',auth('user'),(req,res)=>res.json(publicUser(req.user)));
  app.post('/api/auth/logout',auth('user'),async (req,res)=>{(await db.prepare('DELETE FROM sessions WHERE hash=?').run(req.auth.hash));res.json({ok:true});});
  const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:3*1024*1024,files:1}});
  fs.mkdirSync(config.uploadDir,{recursive:true});
  app.post('/api/me/avatar',auth('user'),upload.single('avatar'),async(req,res)=>{
    if(!req.file && typeof req.body?.avatarData==='string'){
      if(req.body.avatarData.length>4*1024*1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(req.body.avatarData))fail(400,'头像数据无效或超过 3MB');
      req.file={buffer:Buffer.from(req.body.avatarData,'base64')};
    }
    if(!req.file || req.file.buffer.length>3*1024*1024) fail(400,'请选择不超过 3MB 的图片');
    const signature=req.file.buffer.subarray(0,8).toString('hex');
    if(!signature.startsWith('ffd8ff') && signature!=='89504e470d0a1a0a') fail(400,'请使用 JPG 或 PNG 格式头像');
    let bytes;
    try { bytes = await sharp(req.file.buffer,{limitInputPixels:20_000_000}).rotate().resize(256,256,{fit:'cover'}).png().toBuffer(); }
    catch { fail(400,'头像图片无法读取，请使用 JPG 或 PNG'); }
    const filename = `${crypto.randomUUID()}.png`;
    (await db.prepare('INSERT INTO avatars VALUES (?,?,?)').run(filename,bytes,new Date().toISOString()));
    const avatar = `/uploads/${filename}`;
    (await db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar,req.user.id));
    res.json({avatar});
  });
  app.post('/api/me/bind',auth('user'),async (req,res)=>{
    const body = z.object({nickname:z.string().trim().min(1).max(30),consentVersion:z.literal('2026-11-02')}).parse(req.body);
    (await db.prepare('UPDATE users SET nickname=?,bound=1,consent_version=?,bound_at=? WHERE id=?').run(body.nickname,body.consentVersion,new Date().toISOString(),req.user.id));
    res.json(publicUser((await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id))));
  });
  async function currentSurvey() {return unpack((await db.prepare("SELECT * FROM surveys WHERE status='published' ORDER BY updated_at DESC LIMIT 1").get()));}
  app.get('/api/surveys/current',auth('user',true),async (req,res)=>{
    const s = (await currentSurvey()); if(!s) fail(404,'当前暂无开放的问卷');
    const response = (await db.prepare('SELECT id,snapshot,submitted_at FROM responses WHERE survey_id=? AND user_id=?').get(s.id,req.user.id));
    res.json({survey:s,response:response?{id:response.id,submittedAt:response.submitted_at,completion:JSON.parse(response.snapshot).completion}:null});
  });
  app.post('/api/surveys/:id/start',auth('user',true),async (req,res)=>{
    const s = (await db.prepare('SELECT status FROM surveys WHERE id=?').get(req.params.id));
    if(!s || s.status !== 'published') fail(404,'问卷暂未开放');
    (await db.prepare('INSERT OR IGNORE INTO starts VALUES (?,?,?)').run(req.params.id,req.user.id,new Date().toISOString()));
    res.json({ok:true});
  });
  app.post('/api/surveys/:id/responses',auth('user',true),async (req,res)=>{
    const s = unpack((await db.prepare('SELECT * FROM surveys WHERE id=?').get(req.params.id)));
    if(!s || s.status !== 'published') fail(404,'问卷已结束或尚未开放');
    const existing = (await db.prepare('SELECT id,snapshot FROM responses WHERE survey_id=? AND user_id=?').get(s.id,req.user.id));
    if(existing) return res.json({id:existing.id,alreadySubmitted:true,completion:JSON.parse(existing.snapshot).completion});
    if(req.body.version !== s.version) fail(409,'问卷已更新，请刷新后重新核对答案');
    const error = validateAnswers(s.questions,req.body.answers); if(error) fail(400,error);
    const now = new Date().toISOString();
    const start = (await db.prepare('SELECT started_at FROM starts WHERE survey_id=? AND user_id=?').get(s.id,req.user.id));
    if(!start) fail(400,'请重新打开问卷后提交');
    const id = crypto.randomUUID();
    const phoneQuestion=s.questions.find(q=>q.type==='phone');
    if(!phoneQuestion || !phoneQuestion.required) fail(409,'问卷尚未配置必填手机号，请联系管理员');
    const phone=req.body.answers[phoneQuestion.id];
    const snapshot={...s,respondent:{nickname:req.user.nickname,avatar:req.user.avatar,openid:req.user.openid,phone}};
    try{
      await db.prepare('INSERT INTO responses VALUES (?,?,?,?,?,?,?,?,?)').run(id,s.id,req.user.id,s.version,JSON.stringify(snapshot),JSON.stringify(req.body.answers),start.started_at,now,Math.max(0,Math.floor((Date.parse(now)-Date.parse(start.started_at))/1000)));
    }catch(error){
      const duplicate=error.code==='ER_DUP_ENTRY' || String(error.code).startsWith('SQLITE_CONSTRAINT') || [1555,2067].includes(error.errcode);
      if(!duplicate)throw error;
      const previous=await db.prepare('SELECT id,snapshot FROM responses WHERE survey_id=? AND user_id=?').get(s.id,req.user.id);
      if(!previous)throw error;
      return res.json({id:previous.id,alreadySubmitted:true,completion:JSON.parse(previous.snapshot).completion});
    }
    (await db.prepare('UPDATE users SET phone=? WHERE id=?').run(phone,req.user.id));
    res.status(201).json({id,completion:s.completion});
  });
  app.post('/api/admin/login',authLimiter,async (req,res)=>{
    const body = z.object({username:z.string().max(100),password:z.string().max(200)}).parse(req.body);
    const admin = (await db.prepare('SELECT * FROM admins WHERE username=?').get(body.username));
    if(!verifyPassword(body.password,admin?.password_hash || hashPassword('invalid-placeholder-password')) || !admin) fail(401,'账号或密码错误');
    const token = (await issueSession(db,admin.id,'admin'));
    res.cookie('admin_session',token,{httpOnly:true,secure:production,sameSite:'strict',maxAge:8*60*60*1000,path:'/api/admin'});
    res.json({username:admin.username});
  });
  app.use('/api/admin',auth('admin'));
  app.get('/api/admin/me',async (req,res)=>res.json({username:(await db.prepare('SELECT username FROM admins WHERE id=?').get(req.auth.user_id))?.username}));
  app.post('/api/admin/logout',async (req,res)=>{(await db.prepare('DELETE FROM sessions WHERE hash=?').run(req.auth.hash));res.clearCookie('admin_session',{path:'/api/admin',httpOnly:true,secure:production,sameSite:'strict'});res.json({ok:true});});
  app.get('/api/admin/system',(_req,res)=>res.json({wechatReady:!!(config.wxAppId && config.wxAppSecret),production,devLogin:!!config.enableDevLogin,collectPhoneInSurvey:true,publicOrigin,originMode:publicOrigin?'configured':'same-origin',database:db.dialect || 'sqlite',avatarStorage:'database',cloudHosting:!!config.cloudHosting}));
  app.get('/api/admin/surveys',async (_req,res)=>res.json((await db.prepare('SELECT s.*, (SELECT count(*) FROM responses r WHERE r.survey_id=s.id) AS response_count FROM surveys s ORDER BY s.updated_at DESC').all()).map(unpack)));
  app.post('/api/admin/surveys',async (req,res)=>{
    const s=surveySchema.parse(req.body),id=crypto.randomUUID(),now=new Date().toISOString();
    (await db.prepare('INSERT INTO surveys VALUES (?,?,?,?,?,?,?,?,?)').run(id,s.title,s.description,s.status,1,JSON.stringify(s.questions),JSON.stringify(s.completion),now,now));
    (await audit(req,'create_survey',id));res.status(201).json({id});
  });
  app.put('/api/admin/surveys/:id',async (req,res)=>{
    const s=surveySchema.parse(req.body),old=unpack((await db.prepare('SELECT * FROM surveys WHERE id=?').get(req.params.id)));
    if(!old) fail(404,'问卷不存在');
    if(req.body.version !== old.version) fail(409,'其他管理员已更新问卷，请刷新后重试');
    const changed = s.title !== old.title || JSON.stringify(s.questions)!==JSON.stringify(old.questions) || JSON.stringify(s.completion)!==JSON.stringify(old.completion) || s.description !== old.description;
    const version = old.version + (changed?1:0);
    const result=await db.prepare('UPDATE surveys SET title=?,description=?,status=?,version=?,questions=?,completion=?,updated_at=? WHERE id=? AND version=?').run(s.title,s.description,s.status,version,JSON.stringify(s.questions),JSON.stringify(s.completion),new Date().toISOString(),req.params.id,old.version);
    if(!result.changes)fail(409,'其他管理员已更新问卷，请刷新后重试');
    (await audit(req,'update_survey',req.params.id));res.json({version});
  });
  async function getStats(surveyId,version) {
    const survey=unpack((await db.prepare('SELECT * FROM surveys WHERE id=?').get(surveyId)));if(!survey) fail(404,'问卷不存在');
    const selected=version || survey.version;
    const rows=(await db.prepare('SELECT * FROM responses WHERE survey_id=? AND version=?').all(surveyId,selected));
    const snapshot=rows.length?JSON.parse(rows[0].snapshot):survey;
    if(!rows.length && selected!==survey.version) fail(404,'未找到该版本的答卷');
    const questions=snapshot.questions.map(q=>({...q,answered:0,options:q.options.map(o=>({...o,count:0}))}));
    for(const row of rows){const answers=JSON.parse(row.answers);for(const q of questions){const a=answers[q.id];if(a!==undefined && a!=='' && (!Array.isArray(a)||a.length)){q.answered++;for(const o of q.options)if(Array.isArray(a)?a.includes(o.id):a===o.id)o.count++;}}}
    const totalAll=(await db.prepare('SELECT count(*) AS n FROM responses WHERE survey_id=?').get(surveyId)).n;
    const started=(await db.prepare('SELECT count(*) AS n FROM starts WHERE survey_id=?').get(surveyId)).n;
    const versions=(await db.prepare('SELECT version,count(*) AS count FROM responses WHERE survey_id=? GROUP BY version ORDER BY version DESC').all(surveyId));
    if(!versions.some(v=>v.version===survey.version)) versions.unshift({version:survey.version,count:0});
    const days=new Map();for(const row of rows){const day=new Date(Date.parse(row.submitted_at)+8*3600000).toISOString().slice(0,10);days.set(day,(days.get(day)||0)+1);}const trend=[...days].sort(([a],[b])=>a.localeCompare(b)).slice(-14).map(([day,count])=>({day,count}));
    return {version:selected,total:rows.length,totalAll,started,completionRate:started?Math.round(totalAll/started*100):0,averageDuration:rows.length?Math.round(rows.reduce((n,r)=>n+r.duration_seconds,0)/rows.length):0,questions,versions,trend};
  }
  const versionOf=req=>req.query.version?z.coerce.number().int().positive().parse(req.query.version):undefined;
  app.get('/api/admin/surveys/:id/stats',async (req,res)=>res.json((await getStats(req.params.id,versionOf(req)))));
  app.get('/api/admin/surveys/:id/responses',async (req,res)=>{
    const page=z.coerce.number().int().min(1).max(100000).parse(req.query.page || 1);
    const search=z.string().max(100).parse(req.query.search || '');
    const version=versionOf(req);
    const where='r.survey_id=?'+(version?' AND r.version=?':'')+" AND (COALESCE(json_extract(r.snapshot,'$.respondent.nickname'),u.nickname) LIKE ? ESCAPE '!' OR COALESCE(json_extract(r.snapshot,'$.respondent.phone'),u.phone) LIKE ? ESCAPE '!' OR u.openid LIKE ? ESCAPE '!')";
    const term='%'+search.replace(/[!%_]/g,'!$&')+'%';
    const args=[req.params.id,...(version?[version]:[]),term,term,term];
    const total=(await db.prepare(`SELECT count(*) AS n FROM responses r JOIN users u ON u.id=r.user_id WHERE ${where}`).get(...args)).n;
    const rows=(await db.prepare(`SELECT r.*,u.nickname,u.avatar,u.phone,u.openid FROM responses r JOIN users u ON u.id=r.user_id WHERE ${where} ORDER BY r.submitted_at DESC LIMIT 20 OFFSET ?`).all(...args,(page-1)*20));
    res.json({total,page,pageSize:20,rows:rows.map(r=>{const snapshot=JSON.parse(r.snapshot);return {...r,...snapshot.respondent,snapshot,answers:JSON.parse(r.answers)};})});
  });
  app.get('/api/admin/surveys/:id/export',async(req,res)=>{
    const s=unpack((await db.prepare('SELECT * FROM surveys WHERE id=?').get(req.params.id)));if(!s) fail(404,'问卷不存在');
    const version=versionOf(req), stats=(await getStats(s.id,version));
    const rows=(await db.prepare('SELECT r.*,u.nickname,u.phone,u.openid FROM responses r JOIN users u ON u.id=r.user_id WHERE r.survey_id=?'+(version?' AND r.version=?':'')+' ORDER BY r.submitted_at DESC').all(s.id,...(version?[version]:[])));
    const bytes=await exportWorkbook(s,rows,stats);
    (await audit(req,'export_responses',s.id));
    res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="survey-${s.id}.xlsx"`});res.send(Buffer.from(bytes));
  });
  app.get('/uploads/:filename',async(req,res,next)=>{
    if(!/^[a-f0-9-]{36}\.png$/.test(req.params.filename))return res.sendStatus(404);
    const avatar=await db.prepare('SELECT content FROM avatars WHERE id=?').get(req.params.filename);
    if(!avatar)return next();
    res.set({'Content-Type':'image/png','Cache-Control':'public, max-age=604800','Content-Security-Policy':"default-src 'none'"});res.send(Buffer.from(avatar.content));
  });
  app.use('/uploads',express.static(config.uploadDir,{maxAge:'7d',dotfiles:'deny',index:false,setHeaders:res=>res.set('Content-Security-Policy',"default-src 'none'")}));
  app.use('/assets',express.static(path.resolve('miniprogram/assets'),{maxAge:'7d'}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'接口不存在'}));
  app.use(express.static(path.resolve('dist'),{index:false}));
  app.get(['/','/admin','/admin/','/preview','/preview/'],(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
  app.use((error,_req,res,_next)=>{
    if(error instanceof z.ZodError) return res.status(400).json({error:'填写内容不符合要求',details:error.issues.map(i=>({path:i.path.join('.'),message:i.message}))});
    if(error instanceof multer.MulterError) return res.status(400).json({error:'头像不能超过 3MB，且只能上传一张图片'});
    const status=error.status || 500;
    if(status>=500) console.error('请求失败：',error.code || error.name);
    res.status(status).json({error:status===500?'服务暂时不可用，请稍后重试':error.message});
  });
  return {app,db};
}
