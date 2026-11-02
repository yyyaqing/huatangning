import mysql from 'mysql2/promise';
import {seedSurvey} from './seed.js';

export function mysqlSettings(env=process.env){
  const address=env.MYSQL_ADDRESS || '';
  const match=address.match(/^([^:]+)(?::(\d+))?$/);
  const host=env.MYSQL_HOST || match?.[1];
  const port=Number(env.MYSQL_PORT || match?.[2] || 3306);
  if(!host || !env.MYSQL_USERNAME || !env.MYSQL_PASSWORD)throw new Error('请配置云托管 MYSQL_ADDRESS、MYSQL_USERNAME、MYSQL_PASSWORD');
  const database=env.MYSQL_DATABASE || 'nodejs_demo';
  if(!/^[a-zA-Z0-9_]{1,64}$/.test(database) || !Number.isInteger(port) || port<1 || port>65535)throw new Error('MySQL 数据库名或端口不正确');
  return {host,port,user:env.MYSQL_USERNAME,password:env.MYSQL_PASSWORD,database,charset:'utf8mb4',connectionLimit:5,waitForConnections:true,queueLimit:50,connectTimeout:10000,multipleStatements:false,...(env.MYSQL_SSL==='true'?{ssl:{rejectUnauthorized:true}}:{})};
}
export function mysqlSql(sql){
  return sql.replace(/INSERT OR IGNORE INTO/gi,'INSERT IGNORE INTO')
    .replace(/json_extract\(([^,]+),('[^']+')\)/gi,'JSON_UNQUOTE(JSON_EXTRACT($1,$2))');
}
export function mysqlAdapter(pool){
  return {
    dialect:'mysql',
    prepare(sql){
      async function query(args){const [rows]=await pool.query(mysqlSql(sql),args);return rows;}
      return {async get(...args){return (await query(args))[0];},async all(...args){return query(args);},async run(...args){const result=await query(args);return {changes:result.affectedRows,lastInsertRowid:result.insertId};}};
    },
    async close(){await pool.end();}
  };
}
const tables=[
  `CREATE TABLE IF NOT EXISTS admins (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(200) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id VARCHAR(36) PRIMARY KEY, openid VARCHAR(128) NOT NULL UNIQUE, nickname VARCHAR(120) NOT NULL DEFAULT '', avatar VARCHAR(255) NOT NULL DEFAULT '', phone VARCHAR(32) NOT NULL DEFAULT '', bound TINYINT NOT NULL DEFAULT 0, consent_version VARCHAR(32), bound_at VARCHAR(32), created_at VARCHAR(32) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions (hash CHAR(64) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, role VARCHAR(16) NOT NULL, expires_at BIGINT NOT NULL, INDEX session_expiry(expires_at))`,
  `CREATE TABLE IF NOT EXISTS surveys (id VARCHAR(36) PRIMARY KEY, title VARCHAR(600) NOT NULL, description TEXT NOT NULL, status VARCHAR(16) NOT NULL, version INT NOT NULL, questions LONGTEXT NOT NULL, completion LONGTEXT NOT NULL, created_at VARCHAR(32) NOT NULL, updated_at VARCHAR(32) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS responses (id VARCHAR(36) PRIMARY KEY, survey_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, version INT NOT NULL, snapshot LONGTEXT NOT NULL, answers LONGTEXT NOT NULL, started_at VARCHAR(32) NOT NULL, submitted_at VARCHAR(32) NOT NULL, duration_seconds INT NOT NULL, UNIQUE KEY response_user(survey_id,user_id), INDEX responses_survey(survey_id,version,submitted_at), FOREIGN KEY(survey_id) REFERENCES surveys(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
  `CREATE TABLE IF NOT EXISTS starts (survey_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, started_at VARCHAR(32) NOT NULL, PRIMARY KEY(survey_id,user_id), FOREIGN KEY(survey_id) REFERENCES surveys(id), FOREIGN KEY(user_id) REFERENCES users(id))`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, actor VARCHAR(64) NOT NULL, action VARCHAR(64) NOT NULL, target VARCHAR(128) NOT NULL, created_at VARCHAR(32) NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS avatars (id VARCHAR(64) PRIMARY KEY, content MEDIUMBLOB NOT NULL, created_at VARCHAR(32) NOT NULL)`
];
export async function openMysql(settings){
  const pool=mysql.createPool(settings);
  const db=mysqlAdapter(pool);
  try{
    for(const sql of tables)await pool.query(sql+' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin');
    const now=new Date().toISOString();
    if(!await db.prepare('SELECT id FROM surveys LIMIT 1').get())await db.prepare('INSERT OR IGNORE INTO surveys VALUES (?,?,?,?,?,?,?,?,?)').run('huatangning',seedSurvey.title,seedSurvey.description,seedSurvey.status,1,JSON.stringify(seedSurvey.questions),JSON.stringify(seedSurvey.completion),now,now);
    return db;
  }catch(error){await pool.end();throw error;}
}
