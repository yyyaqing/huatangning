import crypto from 'node:crypto';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
export async function issueSession(db, userId, role) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = Date.now() + (role === 'admin' ? 8*60*60*1000 : 7*24*60*60*1000);
  (await db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()));
  (await db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(digest(token), String(userId), role, expires));
  return token;
}
