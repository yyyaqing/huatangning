import path from 'node:path';
export function configFromEnv(env=process.env){
  return {nodeEnv:env.NODE_ENV || 'development',publicOrigin:env.PUBLIC_ORIGIN || 'http://localhost:3000',trustProxy:Number(env.TRUST_PROXY || 0),dataDir:path.resolve(env.DATA_DIR || 'data'),uploadDir:path.resolve(env.UPLOAD_DIR || 'uploads'),adminUsername:env.ADMIN_USERNAME,adminPassword:env.ADMIN_PASSWORD,wxAppId:env.WX_APP_ID,wxAppSecret:env.WX_APP_SECRET,enableDevLogin:env.ENABLE_DEV_LOGIN==='true',databaseDriver:env.DATABASE_DRIVER,cloudHosting:env.CLOUD_HOSTING==='true'};
}
