// 发布前执行 node tools/check-release.js；AppSecret 只在服务器配置。
module.exports = {
  mode: 'http', // 云托管正式发布改为 cloud，填写下方环境 ID 和服务名。
  cloudEnv: '',
  cloudService: '',
  API_BASE: 'http://127.0.0.1:3000',
  allowDevLogin: true
};
