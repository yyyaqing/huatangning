import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { seedSurvey } from './seed.js';

export function openDatabase(directory) {
  fs.mkdirSync(directory, {recursive:true});
  const db = new DatabaseSync(path.join(directory, 'survey.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, openid TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', bound INTEGER NOT NULL DEFAULT 0, consent_version TEXT, bound_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS surveys (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, questions TEXT NOT NULL, completion TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, survey_id TEXT NOT NULL REFERENCES surveys(id), user_id TEXT NOT NULL REFERENCES users(id), version INTEGER NOT NULL, snapshot TEXT NOT NULL, answers TEXT NOT NULL, started_at TEXT NOT NULL, submitted_at TEXT NOT NULL, duration_seconds INTEGER NOT NULL, UNIQUE(survey_id, user_id));
    CREATE INDEX IF NOT EXISTS responses_survey ON responses(survey_id, version, submitted_at);
    CREATE TABLE IF NOT EXISTS starts (survey_id TEXT NOT NULL REFERENCES surveys(id), user_id TEXT NOT NULL REFERENCES users(id), started_at TEXT NOT NULL, PRIMARY KEY(survey_id,user_id));
    CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS avatars (id TEXT PRIMARY KEY, content BLOB NOT NULL, created_at TEXT NOT NULL);
  `);
  if (!db.prepare('SELECT id FROM surveys LIMIT 1').get()) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO surveys VALUES (?,?,?,?,?,?,?,?,?)').run('huatangning', seedSurvey.title, seedSurvey.description, seedSurvey.status, 1, JSON.stringify(seedSurvey.questions), JSON.stringify(seedSurvey.completion), now, now);
  }
  // 补齐早期开发数据的手机号字段；保留已有答卷对应版本。
  for(const row of db.prepare('SELECT id,questions FROM surveys').all()) {
    const questions=JSON.parse(row.questions);
    if(!questions.some(q=>q.type==='phone')) {
      questions.push({id:'phone',type:'phone',title:'手机号',required:true,options:[]});
      db.prepare('UPDATE surveys SET questions=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(questions),new Date().toISOString(),row.id);
    }
  }
  return db;
}

export function unpack(row) {
  return row && {...row, questions:JSON.parse(row.questions), completion:JSON.parse(row.completion)};
}
