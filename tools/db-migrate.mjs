// בונה ומעדכן את הטבלאות ב-Supabase: מריץ לפי הסדר את קבצי ה-SQL שב-supabase/migrations שעוד לא רצו.
// כל קובץ רץ בטרנזקציה: אם משהו נכשל באמצע, שום דבר מהקובץ לא נשמר.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connect } from './db.mjs';

const DIR = 'supabase/migrations';

const client = await connect();
try {
  // רשימת הקבצים שכבר רצו, בסכמה פרטית שלא נגישה מהאינטרנט
  await client.query(`
    create schema if not exists private;
    create table if not exists private.migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const done = new Set((await client.query('select name from private.migrations')).rows.map((r) => r.name));
  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort();
  let ran = 0;
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = await readFile(join(DIR, name), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into private.migrations (name) values ($1)', [name]);
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw new Error(`${name}: ${err.message}`);
    }
    console.log(`✓ ${name}`);
    ran++;
  }
  console.log(ran ? `הסתיים: ${ran} קבצים חדשים.` : 'אין מה לעדכן: מסד הנתונים מעודכן.');
} finally {
  await client.end();
}
