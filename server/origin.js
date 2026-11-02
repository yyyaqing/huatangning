export function normalizePublicOrigin(value,production=false){
  const text=String(value || '').trim();
  if(!text)return '';
  let url;
  try{url=new URL(text);}catch{throw new Error('PUBLIC_ORIGIN 格式不正确，请填写完整 HTTPS 域名，或留空自动匹配当前访问域名');}
  if(production && url.protocol!=='https:')throw new Error('生产环境 PUBLIC_ORIGIN 必须为 HTTPS，例如 https://你的实际访问域名；留空可自动匹配当前 HTTPS 域名');
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw new Error('PUBLIC_ORIGIN 只填写访问域名，例如 https://survey.example.com，不要包含账号、路径或参数');
  return url.origin;
}

export function trustedAdminOrigin(req,configuredOrigin,production=false){
  const origin=req.get('origin');
  // 非浏览器 API 客户端没有 Origin，仍需通过原有管理员鉴权。
  if(!origin)return true;
  try{
    const candidate=normalizePublicOrigin(origin,production);
    // Express req.host 只在已配置 trust proxy 时读取转发的 Host。
    const expected=configuredOrigin || normalizePublicOrigin(`${production?'https':req.protocol}://${req.host}`,production);
    return !!candidate && candidate===expected;
  }catch{return false;}
}
