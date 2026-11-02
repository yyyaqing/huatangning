const api=require('../../utils/api');
Page({
  data:{config:null,nickname:'',avatar:'',consent:false,busy:false,error:'',needPrivacy:false,showPrivacy:false},
  async onLoad(){
    try{
      const serverConfig=await api.request('/config');const config={...serverConfig,devLogin:api.isDev(serverConfig)};this.setData({config});
      if(wx.getPrivacySetting)wx.getPrivacySetting({success:res=>this.setData({needPrivacy:res.needAuthorization})});
      if(wx.getStorageSync('token')){
        try{const user=await api.request('/me');if(user.bound){wx.redirectTo({url:'/pages/survey/index'});return;}this.setData({nickname:user.nickname,avatar:await api.resolveAvatar(user.avatar)});}catch(e){if(e.status!==401)throw e;}
      }
    }catch(e){this.setData({error:e.message});}
  },
  nicknameInput(e){this.setData({nickname:e.detail.value});},
  chooseAvatar(e){this.setData({avatar:e.detail.avatarUrl});},
  consentChanged(e){this.setData({consent:e.detail.value.includes('agree')});},
  privacy(){wx.navigateTo({url:'/pages/privacy/index'});},
  async openPrivacyContract(){if(wx.openPrivacyContract)wx.openPrivacyContract({fail:()=>wx.navigateTo({url:'/pages/privacy/index'})});else this.privacy();},
  agreePrivacy(){const resolve=getApp().globalData.privacyResolve;if(resolve){resolve({buttonId:'agree-privacy',event:'agree'});getApp().globalData.privacyResolve=null;}this.setData({needPrivacy:false,showPrivacy:false});},
  async bind(e){
    if(this.data.busy)return;
    if(!this.data.config){this.setData({error:'配置加载失败，请重新进入'});return;}
    if(!this.data.consent){this.setData({error:'请先阅读并同意隐私说明'});return;}
    if(this.data.needPrivacy){this.setData({showPrivacy:true});return;}
    if(!this.data.nickname.trim()){this.setData({error:'请填写您的昵称'});return;}
    this.setData({busy:true,error:''});
    try{
      await api.login(this.data.config);
      if(this.data.avatar && !this.data.avatar.startsWith(api.base))await api.uploadAvatar(this.data.avatar);
      await api.request('/me/bind','POST',{nickname:this.data.nickname.trim(),consentVersion:this.data.config.privacyVersion});
      wx.redirectTo({url:'/pages/survey/index'});
    }catch(error){this.setData({error:error.message || '绑定失败，请重试'});}finally{this.setData({busy:false});}
  },
  privacyPrompt(){this.setData({showPrivacy:true});},
  closePrivacy(){this.setData({showPrivacy:false});}
});
