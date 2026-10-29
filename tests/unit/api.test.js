import { describe, expect, it } from 'vitest';
import { createOnlineApi, OnlineError } from '../../src/online/api.js';
import { nicknameToEmail } from '../../src/online/nickname.js';
import { errorCode } from '../../src/online/messages.js';

// Supabase מדומה: שומר מה ביקשו ממנו, ומחזיר תשובות מוכנות מראש
function fakeSupabase({ session = null, profiles = [], count = 0, rpcResult = {}, signUpResult, signInError = null } = {}) {
  const log = { queries: [], auth: [], rpc: [] };
  const answer = (q, single) => {
    if (q.opts?.head) return { count, error: null };
    const rows = profiles.filter((p) => q.filters.every(([op, col, v]) => (op === 'eq' ? p[col] === v : p[col] > v)));
    return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null };
  };
  const from = (table) => {
    const q = { table, filters: [], order: [] };
    const chain = {
      select(cols, opts) { Object.assign(q, { cols, opts }); return chain; },
      eq(col, v) { q.filters.push(['eq', col, v]); return chain; },
      gt(col, v) { q.filters.push(['gt', col, v]); return chain; },
      order(col, o) { q.order.push([col, o.ascending]); return chain; },
      limit(n) { q.limit = n; return chain; },
      maybeSingle() { log.queries.push(q); return Promise.resolve(answer(q, true)); },
      then(ok, fail) { log.queries.push(q); return Promise.resolve(answer(q, false)).then(ok, fail); },
    };
    return chain;
  };
  const sb = {
    from,
    auth: {
      getSession: async () => ({ data: { session } }),
      signUp: async (args) => {
        log.auth.push(['signUp', args]);
        return signUpResult ?? { data: { session: { user: { id: 'u1' } } }, error: null };
      },
      signInWithPassword: async (args) => {
        log.auth.push(['signIn', args]);
        return { error: signInError };
      },
      signOut: async () => ({ error: null }),
    },
    rpc: async (name, args) => {
      log.rpc.push([name, args]);
      return rpcResult[name] ?? { data: null, error: null };
    },
  };
  return { sb, log, api: createOnlineApi(async () => sb) };
}

const DUDI = { id: 'u1', nickname: 'דודי', nickname_key: 'דודי', total_served: 12, best_level: 3 };

describe('השחקן המחובר', () => {
  it('אין חיבור: null', async () => {
    const { api } = fakeSupabase();
    expect(await api.currentPlayer()).toBeNull();
  });
  it('מחובר עם כינוי', async () => {
    const { api } = fakeSupabase({ session: { user: { id: 'u1' } }, profiles: [DUDI] });
    expect(await api.currentPlayer()).toEqual({ id: 'u1', nickname: 'דודי', total: 12, level: 3 });
  });
  it('נכנס עם Google ועוד לא בחר כינוי', async () => {
    const { api } = fakeSupabase({ session: { user: { id: 'g1' } } });
    expect(await api.currentPlayer()).toMatchObject({ id: 'g1', nickname: null });
  });
});

describe('הרשמה', () => {
  it('כינוי לא תקין: לא פונים ל-Supabase בכלל', async () => {
    const { api, log } = fakeSupabase();
    await expect(api.signUp('א', '123456')).rejects.toThrow('nick_short');
    expect(log.auth).toHaveLength(0);
  });
  it('סיסמה קצרה', async () => {
    const { api } = fakeSupabase();
    await expect(api.signUp('דודי', '123')).rejects.toThrow('password_short');
  });
  it('כינוי תפוס (גם באותיות אחרות): לא נרשמים', async () => {
    const { api, log } = fakeSupabase({ profiles: [{ id: 'x', nickname_key: 'dudi' }] });
    await expect(api.signUp(' Dudi ', '123456')).rejects.toThrow('nickname_taken');
    expect(log.auth).toHaveLength(0);
  });
  it('נרשמים עם האימייל הפנימי והכינוי הנקי', async () => {
    const { api, log } = fakeSupabase({ session: { user: { id: 'u1' } } });
    await api.signUp('  דודי ', 'secret1');
    expect(log.auth[0]).toEqual(['signUp', {
      email: nicknameToEmail('דודי'),
      password: 'secret1',
      options: { data: { nickname: 'דודי' } },
    }]);
  });
  it('כש-Confirm email דלוק ב-Supabase (אין חיבור אחרי ההרשמה): שגיאה', async () => {
    const { api } = fakeSupabase({ signUpResult: { data: { session: null }, error: null } });
    const warn = console.warn;
    console.warn = () => {};
    await expect(api.signUp('דודי', '123456')).rejects.toBeInstanceOf(OnlineError);
    console.warn = warn;
  });
});

describe('כניסה', () => {
  it('כינוי בפורמט לא אפשרי: "כינוי או סיסמה לא נכונים" בלי לפנות ל-Supabase', async () => {
    const { api, log } = fakeSupabase();
    await expect(api.signIn('!!', '123456')).rejects.toThrow('wrong_login');
    expect(log.auth).toHaveLength(0);
  });
  it('נכנסים עם האימייל הפנימי', async () => {
    const { api, log } = fakeSupabase({ session: { user: { id: 'u1' } }, profiles: [DUDI] });
    expect(await api.signIn('דודי', 'secret1')).toMatchObject({ nickname: 'דודי' });
    expect(log.auth[0][1]).toEqual({ email: nicknameToEmail('דודי'), password: 'secret1' });
  });
  it('סיסמה שגויה מגיעה כשגיאה מתאימה', async () => {
    const { api } = fakeSupabase({ signInError: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    const err = await api.signIn('דודי', 'wrong!!').catch((e) => e);
    expect(errorCode(err)).toBe('wrong_login');
  });
});

describe('שליחת תוצאה', () => {
  it.each([-1, 101, 2.5, NaN])('מספר הנחות לא אפשרי (%s): לא נשלח', async (served) => {
    const { api, log } = fakeSupabase();
    await expect(api.submitLevel(0, served)).rejects.toThrow('bad_served');
    expect(log.rpc).toHaveLength(0);
  });
  it('שולחים לפונקציה submit_level ומחזירים סכום, שלב ומקום', async () => {
    const { api, log } = fakeSupabase({ rpcResult: { submit_level: { data: { total: 30, best_level: 4, rank: 2 }, error: null } } });
    expect(await api.submitLevel(3, 18)).toEqual({ total: 30, level: 4, rank: 2 });
    expect(log.rpc[0]).toEqual(['submit_level', { p_level: 3, p_served: 18 }]);
  });
  it('דחייה של Supabase מגיעה עם הקוד שלה', async () => {
    const { api } = fakeSupabase({ rpcResult: { submit_level: { data: null, error: { code: 'P0001', message: 'too_fast' } } } });
    const err = await api.submitLevel(3, 18).catch((e) => e);
    expect(errorCode(err)).toBe('too_fast');
  });
});

describe('לוח השיאים', () => {
  it('רק מי שהניח לפחות פעם אחת, מהגדול לקטן, 20 שורות', async () => {
    const { api, log } = fakeSupabase({ profiles: [DUDI, { ...DUDI, id: 'u2', total_served: 0 }] });
    const rows = await api.fetchBoard();
    expect(rows.map((r) => r.id)).toEqual(['u1']);
    const q = log.queries[0];
    expect(q.filters).toContainEqual(['gt', 'total_served', 0]);
    expect(q.order[0]).toEqual(['total_served', false]);
    expect(q.limit).toBe(20);
  });
  it('המקום של שחקן: כמה הניחו יותר ממנו, ועוד 1', async () => {
    const { api, log } = fakeSupabase({ count: 33 });
    expect(await api.rankOf(5)).toBe(34);
    expect(log.queries[0].filters).toEqual([['gt', 'total_served', 5]]);
  });
});
