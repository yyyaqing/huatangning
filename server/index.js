import {createApp} from './app.js';
import {configFromEnv} from './config.js';
const {app,db}=await createApp(configFromEnv());
const server=app.listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>console.log(`华堂宁问卷调查已启动，端口 ${server.address().port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(async ()=>{(await db.close());process.exit(0);}));
