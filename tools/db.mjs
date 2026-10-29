// חיבור ישיר למסד הנתונים של Supabase. רק לכלים שרצים במחשב (בניית טבלאות ובדיקות), לעולם לא במשחק עצמו.
import pg from 'pg';

export function loadEnv() {
  try { process.loadEnvFile('.env'); } catch { /* אין .env: נשתמש במה שכבר בסביבה */ }
}

export function dbConfig(env = process.env) {
  const url = env.SUPABASE_DB_URL;
  const password = env.SUPABASE_DB_PASSWORD;
  if (!url || !password) {
    throw new Error('חסרים SUPABASE_DB_URL או SUPABASE_DB_PASSWORD בקובץ .env. ממלאים אותם באשף ההגדרות, בנושא Supabase.');
  }
  return {
    connectionString: url.replace('[YOUR-PASSWORD]', encodeURIComponent(password)),
    // החיבור מוצפן. התעודה של Supabase לא חתומה ע"י רשות מוכרת, ולכן לא מאמתים אותה.
    ssl: { rejectUnauthorized: false },
  };
}

export async function connect() {
  loadEnv();
  const client = new pg.Client(dbConfig());
  await client.connect();
  return client;
}
