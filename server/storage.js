import {openDatabase} from './db.js';
import {openMysql,mysqlSettings} from './mysql.js';
export async function openStorage(config){
  const driver=config.databaseDriver || (process.env.MYSQL_ADDRESS || process.env.MYSQL_HOST?'mysql':'sqlite');
  if(!['mysql','sqlite'].includes(driver))throw new Error('DATABASE_DRIVER 仅支持 mysql 或 sqlite');
  if(config.cloudHosting && driver!=='mysql')throw new Error('云托管必须使用 MySQL 持久化存储，禁止使用容器内 SQLite');
  return driver==='mysql'?openMysql(config.mysql || mysqlSettings()):openDatabase(config.dataDir);
}
