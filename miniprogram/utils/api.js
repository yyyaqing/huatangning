const config=require('../config');
function request(path, method='GET', data) {
  return send('/api'+path,method,data);
}
function send(path,method='GET',data,responseType='text'){
  return new Promise((resolve,reject)=>{
    const cloud=config.mode==='cloud';
    if(cloud && (!config.cloudEnv || !config.cloudService || !wx.cloud?.callContainer))return reject({message:'请先配置云托管环境 ID 和服务名'});
    const options={method,data,responseType,header:{'Content-Type':'application/json',Authorization:'Bearer '+(wx.getStorageSync('token') || ''),...(cloud?{'X-WX-SERVICE':config.cloudService}:{})},timeout:15000,
    success(res){if(res.statusCode>=200&&res.statusCode<300)resolve(res.data);else{if(res.statusCode===401)wx.removeStorageSync('token');reject({message:res.data.error || '请求失败',status:res.statusCode,code:res.data.code});}},
    fail(){reject({message:'网络连接失败，请检查网络后重试'});}
    };
    if(cloud)wx.cloud.callContainer({...options,config:{env:config.cloudEnv},path});
    else wx.request({...options,url:config.API_BASE+path});
  });
}
function loginCode(){return new Promise((resolve,reject)=>wx.login({success:res=>res.code?resolve(res.code):reject({message:'微信登录失败，请重试'}),fail:()=>reject({message:'微信登录失败，请重试'})}));}
async function login(serverConfig) {
  if(wx.getStorageSync('token')){
    try {return await request('/me');}catch(e){if(e.status!==401)throw e;}
  }
  let result;
  // 两端必须同时明确开启，仅在服务端非生产环境提供接口。
  if(config.mode!=='cloud' && config.allowDevLogin && serverConfig.devLogin){
    let id=wx.getStorageSync('dev-device');
    if(!id){id='wxdev_'+Date.now()+'_'+Math.random().toString(36).slice(2);wx.setStorageSync('dev-device',id);}
    result=await request('/auth/dev','POST',{deviceId:id});
  }else result=await request('/auth/wechat','POST',{code:await loginCode()});
  wx.setStorageSync('token',result.token);
  return result.user;
}
async function uploadAvatar(filePath){
  if(config.mode==='cloud'){
    const data=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath,encoding:'base64',success:r=>resolve(r.data),fail:()=>reject({message:'头像读取失败，请重新选择'})}));
    return request('/me/avatar','POST',{avatarData:data});
  }
  return new Promise((resolve,reject)=>wx.uploadFile({url:config.API_BASE+'/api/me/avatar',filePath,name:'avatar',header:{Authorization:'Bearer '+wx.getStorageSync('token')},timeout:20000,success(res){let data;try{data=JSON.parse(res.data);}catch{return reject({message:'头像上传失败'});}if(res.statusCode===200)resolve(data);else reject({message:data.error || '头像上传失败'});},fail(){reject({message:'头像上传失败，请重试'});}}));
}
async function resolveAvatar(avatar){
  if(!avatar)return '';
  if(config.mode!=='cloud')return config.API_BASE+avatar;
  try{
    const data=await send(avatar,'GET',undefined,'arraybuffer');
    const filePath=wx.env.USER_DATA_PATH+'/htn-'+avatar.split('/').pop();
    await new Promise((resolve,reject)=>wx.getFileSystemManager().writeFile({filePath,data,success:resolve,fail:reject}));
    return filePath;
  }catch{return '';}
}
module.exports={request,login,uploadAvatar,resolveAvatar,base:config.API_BASE,isDev:serverConfig=>config.mode!=='cloud' && config.allowDevLogin && serverConfig.devLogin};
