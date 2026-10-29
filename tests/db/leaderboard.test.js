// בודק את הטבלאות, ההרשאות והפונקציות במסד הנתונים האמיתי ב-Supabase.
// כל בדיקה רצה בתוך טרנזקציה שמתבטלת בסוף, ולכן לא נשאר שום שחקן או תוצאה.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connect } from '../../tools/db.mjs';

let db;
beforeAll(async () => { db = await connect(); });
afterAll(async () => { await db?.end(); });
beforeEach(async () => { await db.query('begin'); });
afterEach(async () => { await db.query('rollback'); });

// משתמש חדש, כמו שהרשמה ב-Supabase Auth יוצרת אותו
async function newUser(nickname) {
  const id = randomUUID();
  const meta = nickname === undefined ? {} : { nickname };
  await asAdmin(
    `insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
     values ($1, 'authenticated', 'authenticated', $2, $3, '{}', now(), now())`,
    [id, `${id}@test.invalid`, meta],
  );
  return id;
}

// מריצים שאילתה בתור אורח או בתור שחקן מחובר, וחוזרים לתפקיד המנהל אחריה
async function as(who, sql, params = []) {
  await db.query('savepoint q');
  try {
    if (who === 'anon') {
      await db.query(`set local role anon; select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
    } else {
      await db.query('set local role authenticated');
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who, role: 'authenticated' })]);
    }
    const res = await db.query(sql, params);
    await db.query('reset role');
    await db.query('release savepoint q');
    return res;
  } catch (err) {
    await db.query('rollback to savepoint q');
    await db.query('reset role');
    throw err;
  }
}

// שגיאה צפויה, בלי להפיל את הטרנזקציה
async function fails(promise, pattern) {
  const err = await promise.then(() => null, (e) => e);
  expect(err, 'ציפינו לשגיאה').not.toBeNull();
  expect(err.message).toMatch(pattern);
}

async function asAdmin(sql, params = []) {
  await db.query('savepoint a');
  try {
    const res = await db.query(sql, params);
    await db.query('release savepoint a');
    return res;
  } catch (err) {
    await db.query('rollback to savepoint a');
    throw err;
  }
}

// כינוי שלא קיים בלוח האמיתי: הבדיקות רצות על מסד הנתונים של המשחק
const uniq = (base) => `${base}${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;

const submit = (uid, level, served) => as(uid, 'select public.submit_level($1, $2) as r', [level, served]).then((res) => res.rows[0].r);
const profile = (uid) => db.query('select * from public.profiles where id = $1', [uid]).then((r) => r.rows[0]);
// "עכשיו" בטרנזקציה קבוע, ולכן מזיזים אחורה את התוצאה הקודמת כדי שלא תיחשב "מהר מדי"
const waitABit = (uid) => db.query(`update public.profiles set last_submit_at = now() - interval '1 minute' where id = $1`, [uid]);

describe('הרשמה וכינוי', () => {
  it('הרשמה עם כינוי יוצרת שחקן, עם כינוי נקי', async () => {
    const name = uniq('ד');
    const uid = await newUser(`  ${name}   כהן `);
    expect(await profile(uid)).toMatchObject({ nickname: `${name} כהן`, total_served: 0, best_level: 0 });
  });

  it('כינוי תפוס, גם באותיות אחרות באנגלית, מבטל את ההרשמה', async () => {
    const name = uniq('Dudi');
    await newUser(name);
    await fails(newUser(name.toLowerCase()), /nickname_key_unique/);
  });

  it('כינוי עם סימנים מבטל את ההרשמה', async () => {
    await fails(newUser('<script>'), /nickname_format/);
  });

  it('מי שנכנס עם Google (בלי כינוי) מקבל שחקן רק כשהוא בוחר כינוי', async () => {
    const uid = await newUser();
    expect(await profile(uid)).toBeUndefined();
    const name = uniq('מנדי');
    await as(uid, 'select public.claim_nickname($1)', [`  ${name}  `]);
    expect((await profile(uid)).nickname).toBe(name);
    await fails(as(uid, 'select public.claim_nickname($1)', [uniq('מנדי')]), /already_has_profile/);
  });

  it('בחירת כינוי: תפוס או לא תקין', async () => {
    const name = uniq('יוסי');
    await newUser(name);
    const uid = await newUser();
    await fails(as(uid, 'select public.claim_nickname($1)', [name]), /nickname_taken/);
    await fails(as(uid, `select public.claim_nickname('!')`), /nickname_invalid/);
  });

  it('השחקן נמחק יחד עם המשתמש', async () => {
    const uid = await newUser(uniq('לבדיקה'));
    await db.query('delete from auth.users where id = $1', [uid]);
    expect(await profile(uid)).toBeUndefined();
  });
});

describe('המנעול: מי רשאי לעשות מה', () => {
  it('אורח רואה את לוח השיאים', async () => {
    const name = uniq('גלוי');
    await newUser(name);
    const { rows } = await as('anon', 'select nickname, total_served from public.profiles where nickname = $1', [name]);
    expect(rows).toHaveLength(1);
  });

  it('אורח לא יכול לשלוח תוצאה', async () => {
    await fails(as('anon', 'select public.submit_level(0, 5)'), /permission denied/);
  });

  it('אורח לא יכול ליצור שחקן או לשנות אותו', async () => {
    const uid = await newUser(uniq('קיים'));
    await fails(as('anon', `insert into public.profiles (id, nickname) values ($1, 'פורץ')`, [randomUUID()]), /permission denied/);
    await fails(as('anon', 'update public.profiles set total_served = 999 where id = $1', [uid]), /permission denied/);
  });

  it('שחקן לא יכול לשנות את הסכום שלו ישירות', async () => {
    const uid = await newUser(uniq('רמאי'));
    await fails(as(uid, 'update public.profiles set total_served = 999 where id = $1', [uid]), /permission denied/);
    await fails(as(uid, 'delete from public.profiles where id = $1', [uid]), /permission denied/);
  });

  it('אף שחקן לא רואה את יומן התוצאות', async () => {
    const uid = await newUser(uniq('סקרן'));
    await fails(as(uid, 'select * from public.level_results'), /permission denied/);
  });
});

describe('שליחת תוצאה', () => {
  it('מוסיפה לסכום, מעדכנת שלב, ונרשמת ביומן', async () => {
    const uid = await newUser(uniq('שולח'));
    expect(await submit(uid, 2, 12)).toMatchObject({ total: 12, best_level: 3, rank: expect.any(Number) });
    await waitABit(uid);
    expect(await submit(uid, 3, 15)).toMatchObject({ total: 27, best_level: 4 });
    const { rows } = await db.query('select level_index, served from public.level_results where user_id = $1 order by id', [uid]);
    expect(rows).toEqual([{ level_index: 2, served: 12 }, { level_index: 3, served: 15 }]);
  });

  it('שלב קודם (אחרי שנכשלו) לא מוריד את השלב הכי גבוה', async () => {
    const uid = await newUser(uniq('חוזר'));
    await submit(uid, 4, 10);
    await waitABit(uid);
    expect(await submit(uid, 2, 8)).toMatchObject({ total: 18, best_level: 5 });
  });

  it('המקום בלוח לפי הסכום', async () => {
    const a = await newUser(uniq('ראשון'));
    const b = await newUser(uniq('שני'));
    await db.query('update public.profiles set total_served = 1000000 where id = $1', [a]);
    expect((await submit(b, 0, 5)).rank).toBeGreaterThanOrEqual(2);
  });

  it('יותר מ-100 הנחות בשלב: נדחה', async () => {
    const uid = await newUser(uniq('מגזים'));
    await fails(submit(uid, 0, 101), /bad_served/);
    await fails(submit(uid, 0, -1), /bad_served/);
    expect((await profile(uid)).total_served).toBe(0);
  });

  it('קפיצה של יותר משלב אחד קדימה: נדחית', async () => {
    const uid = await newUser(uniq('קופץ'));
    await submit(uid, 2, 10);
    await waitABit(uid);
    await fails(submit(uid, 4, 10), /bad_level/);
    await submit(uid, 3, 10);
  });

  it('בתוצאה הראשונה מותר עד שלב 30', async () => {
    const a = await newUser(uniq('ותיק'));
    await submit(a, 29, 10);
    const b = await newUser(uniq('חשוד'));
    await fails(submit(b, 30, 10), /bad_level/);
  });

  it('שתי תוצאות בהפרש של פחות מ-20 שניות: השנייה נדחית', async () => {
    const uid = await newUser(uniq('מהיר'));
    await submit(uid, 0, 5);
    await fails(submit(uid, 1, 5), /too_fast/);
    expect((await profile(uid)).total_served).toBe(5);
  });

  it('משתמש בלי כינוי עדיין לא יכול לשלוח', async () => {
    const uid = await newUser();
    await fails(submit(uid, 0, 5), /no_profile/);
  });
});

describe('מסנן הכינויים', () => {
  it('כינוי עם מילה אסורה מבטל את ההרשמה', async () => {
    await fails(newUser('אחזונה'), /nickname_blocked/);
  });

  it('תופס גם רווחים בין האותיות, אותיות סופיות, ספרות ואותיות כפולות', async () => {
    await fails(newUser('ז ו נ ה'), /nickname_blocked/);
    await fails(newUser('sh1t'), /nickname_blocked/);
    await fails(newUser('fuuuck'), /nickname_blocked/);
    await fails(newUser('ערום'), /nickname_blocked/); // ברשימה: "ערומ"
  });

  it('מילה שלמה בלבד: חסומה לבד, מותרת בתוך מילה רגילה', async () => {
    await fails(newUser('כוס'), /nickname_blocked/);
    await fails(newUser('אבא כוס'), /nickname_blocked/);
    await newUser(uniq('כוסמת'));
    await newUser(uniq('ציצית'));
    await newUser(uniq('מתחת'));
  });

  it('בחירת כינוי (Google) נבדקת גם היא', async () => {
    const uid = await newUser();
    await fails(as(uid, `select public.claim_nickname('שרמוטה')`), /nickname_blocked/);
  });

  it('לפני ההרשמה: ok, taken או blocked, גם לאורח', async () => {
    const name = uniq('בודק');
    await newUser(name);
    const status = (nick) => as('anon', 'select public.nickname_status($1) as s', [nick]).then((r) => r.rows[0].s);
    expect(await status(uniq('חדש'))).toBe('ok');
    expect(await status(` ${name} `)).toBe('taken');
    expect(await status('sex')).toBe('blocked');
  });

  it('מילה שנוספה אחר כך: השחקן נעלם מהלוח לאחרים, אבל רואה את עצמו', async () => {
    const name = uniq('נעלם');
    const uid = await newUser(name);
    await db.query('insert into public.blocked_words (word) values ($1)', [name]);
    const query = 'select id from public.profiles where id = $1';
    expect((await as('anon', query, [uid])).rows).toHaveLength(0);
    expect((await as(await newUser(uniq('אחר')), query, [uid])).rows).toHaveLength(0);
    expect((await as(uid, query, [uid])).rows).toHaveLength(1);
  });

  it('אף שחקן לא רואה את רשימת המילים', async () => {
    const uid = await newUser(uniq('סקרן'));
    await fails(as('anon', 'select * from public.blocked_words'), /permission denied/);
    await fails(as(uid, 'select * from public.blocked_words'), /permission denied/);
  });
});
