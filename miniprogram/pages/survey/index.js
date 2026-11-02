const api=require('../../utils/api');
Page({
  data:{survey:null,answers:{},selected:{},progress:0,busy:false,loading:true,error:'',defaultTitle:false},
  onLoad(){this.load();},
  async load(){
    this.setData({loading:true,error:''});
    try{
      const result=await api.request('/surveys/current');
      if(result.response){wx.setStorageSync('completion',result.response.completion);wx.redirectTo({url:'/pages/success/index'});return;}
      const survey=result.survey;
      const draft=wx.getStorageSync('draft-'+survey.id);
      const answers=draft && draft.version===survey.version?draft.answers:{};
      survey.questions=survey.questions.map(q=>({...q,options:q.options.map((o,i)=>({...o,letter:String.fromCharCode(65+i)}))}));
      this.setData({survey,answers,defaultTitle:survey.title==='华堂宁® (多格列艾汀)知多少'});this.refreshSelection();
      await api.request('/surveys/'+survey.id+'/start','POST');
    }catch(e){if(e.status===401||e.code==='BIND_REQUIRED'){wx.redirectTo({url:'/pages/bind/index'});return;}this.setData({error:e.message});}finally{this.setData({loading:false});}
  },
  answer(e){const id=e.currentTarget.dataset.qid;this.setData({['answers.'+id]:e.detail.value});this.refreshSelection();this.saveDraft();},
  refreshSelection(){const selected={};let progress=0;for(const q of this.data.survey.questions){const a=this.data.answers[q.id];if(Array.isArray(a)?a.length:typeof a==='string'&&a.trim())progress++;for(const o of q.options)selected[q.id+'_'+o.id]=Array.isArray(a)?a.includes(o.id):a===o.id;}this.setData({selected,progress});},
  saveDraft(){if(this.data.survey)wx.setStorageSync('draft-'+this.data.survey.id,{version:this.data.survey.version,answers:this.data.answers});},
  async submit(){
    if(this.data.busy||!this.data.survey)return;
    const missing=this.data.survey.questions.find(q=>{const a=this.data.answers[q.id];return q.required&&!(Array.isArray(a)?a.length:typeof a==='string'&&a.trim());});
    if(missing){this.setData({error:'请完成所有必填题目'});wx.pageScrollTo({selector:'#question-'+missing.id,duration:200});wx.showToast({title:'还有必填题未完成',icon:'none'});return;}
    const phone=this.data.survey.questions.find(q=>q.type==='phone');
    if(!phone || !/^1[3-9]\d{9}$/.test(this.data.answers[phone.id] || '')){this.setData({error:'请填写正确的 11 位中国大陆手机号'});if(phone)wx.pageScrollTo({selector:'#question-'+phone.id,duration:200});return;}
    this.setData({busy:true,error:''});
    try{const result=await api.request('/surveys/'+this.data.survey.id+'/responses','POST',{version:this.data.survey.version,answers:this.data.answers});wx.removeStorageSync('draft-'+this.data.survey.id);wx.setStorageSync('completion',result.completion);wx.redirectTo({url:'/pages/success/index'});}
    catch(e){this.setData({error:e.message});if(e.status===409)wx.showModal({title:'问卷已更新',content:'请重新加载最新问卷，核对后再提交。',confirmText:'重新加载',success:r=>{if(r.confirm)this.load();}});if(e.status===401)wx.redirectTo({url:'/pages/bind/index'});}
    finally{this.setData({busy:false});}
  },
  privacy(){wx.navigateTo({url:'/pages/privacy/index'});},
  retry(){this.load();}
});
