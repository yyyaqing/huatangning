export function createWechat(config) {
  async function request(url, options) {
    let response;
    try { response = await fetch(url, {...options, signal:AbortSignal.timeout(10000)}); }
    catch { throw Object.assign(new Error('微信服务暂不可用，请稍后重试'), {status:502}); }
    if (!response.ok) throw Object.assign(new Error('微信服务暂不可用'), {status:502});
    const result = await response.json();
    if (result.errcode) throw Object.assign(new Error('微信授权未成功或已过期，请重新授权'), {status:400});
    return result;
  }
  function configured() {
    if (!config.wxAppId || !config.wxAppSecret) throw Object.assign(new Error('尚未配置微信小程序 AppID 和 AppSecret'), {status:503});
  }
  return {
    async login(code) {
      configured();
      const query = new URLSearchParams({appid:config.wxAppId, secret:config.wxAppSecret, js_code:code, grant_type:'authorization_code'});
      const result = await request(`https://api.weixin.qq.com/sns/jscode2session?${query}`);
      if (!result.openid) throw Object.assign(new Error('微信登录失败，请重试'), {status:502});
      return result.openid;
    }
  };
}
