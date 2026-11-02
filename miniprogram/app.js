App({
  globalData: { privacyResolve:null },
  onLaunch() {
    const config=require('./config');
    if(config.mode==='cloud' && wx.cloud)wx.cloud.init({env:config.cloudEnv,traceUser:false});
    if(wx.onNeedPrivacyAuthorization) wx.onNeedPrivacyAuthorization(resolve=>{
      this.globalData.privacyResolve=resolve;
      const pages=getCurrentPages();
      const page=pages[pages.length-1];
      if(page && page.route==='pages/bind/index')page.setData({needPrivacy:true});
    });
  }
});
