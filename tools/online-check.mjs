// בדיקה מקצה לקצה דרך האינטרנט, בדיוק כמו המשחק: הרשמה, כניסה, שליחת שלב וקריאת הלוח.
// בסוף מוחקים את שחקן הבדיקה ישירות ממסד הנתונים, כדי שלא יישאר בלוח.
import { createClient } from '@supabase/supabase-js';
import { createOnlineApi } from '../src/online/api.js';
import { errorCode } from '../src/online/messages.js';
import { connect, loadEnv } from './db.mjs';

loadEnv();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('חסרים VITE_SUPABASE_URL או VITE_SUPABASE_PUBLISHABLE_KEY בקובץ .env');

const newClient = () => createClient(url, key, { auth: { persistSession: false } });
const nickname = `בדיקה${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
const password = `t-${crypto.randomUUID()}`;

let failed = 0;
async function step(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${name}: ${err.message} (${errorCode(err)})`);
  }
}
function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

const player = createOnlineApi(async () => player.sb);
player.sb = newClient();
let userId = null;

await step('הרשמה עם כינוי וסיסמה', async () => {
  const p = await player.signUp(nickname, password);
  check(p?.nickname === nickname, `ציפינו לשחקן ${nickname}, קיבלנו ${JSON.stringify(p)}`);
  userId = p.id;
});

await step('הרשמה שנייה עם אותו כינוי נדחית', async () => {
  const other = createOnlineApi(async () => newClient());
  const err = await other.signUp(nickname, password).then(() => null, (e) => e);
  check(errorCode(err) === 'nickname_taken', `ציפינו ל-nickname_taken, קיבלנו ${errorCode(err)}`);
});

await step('כניסה עם סיסמה שגויה נדחית', async () => {
  const other = createOnlineApi(async () => newClient());
  const err = await other.signIn(nickname, 'wrong-password').then(() => null, (e) => e);
  check(errorCode(err) === 'wrong_login', `ציפינו ל-wrong_login, קיבלנו ${errorCode(err)}`);
});

await step('כניסה מ"מכשיר אחר" עם הכינוי והסיסמה', async () => {
  const other = createOnlineApi(async () => other.sb);
  other.sb = newClient();
  const p = await other.signIn(nickname, password);
  check(p?.id === userId, 'נכנסנו לשחקן אחר');
});

await step('שליחת שלב מוסיפה לסכום', async () => {
  const r = await player.submitLevel(0, 5);
  check(r.total === 5 && r.level === 1 && r.rank >= 1, `תשובה לא צפויה: ${JSON.stringify(r)}`);
});

await step('שליחה מהירה מדי נדחית', async () => {
  const err = await player.submitLevel(1, 5).then(() => null, (e) => e);
  check(errorCode(err) === 'too_fast', `ציפינו ל-too_fast, קיבלנו ${errorCode(err)}`);
});

await step('השחקן מופיע בלוח (או במקום שלו)', async () => {
  const guest = createOnlineApi(async () => newClient());
  const rows = await guest.fetchBoard();
  const rank = await guest.rankOf(5);
  check(rows.some((r) => r.id === userId) || rank > rows.length, 'השחקן לא נמצא');
});

await step('אורח לא יכול לשלוח תוצאה', async () => {
  const guest = createOnlineApi(async () => newClient());
  const err = await guest.submitLevel(0, 5).then(() => null, (e) => e);
  check(err, 'אורח הצליח לשלוח תוצאה!');
});

// ניקוי
if (userId) {
  const db = await connect();
  try {
    await db.query('delete from auth.users where id = $1', [userId]);
    console.log('✓ שחקן הבדיקה נמחק');
  } finally {
    await db.end();
  }
}

console.log(failed ? `\n${failed} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(failed ? 1 : 0);
