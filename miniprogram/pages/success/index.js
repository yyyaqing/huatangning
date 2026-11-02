Page({data:{completion:null},onLoad(){const completion=wx.getStorageSync('completion');if(!completion){wx.redirectTo({url:'/pages/survey/index'});return;}this.setData({completion});}});
