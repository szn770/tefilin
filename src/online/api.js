import { nicknameToEmail, normalizeNickname, validateNickname, validatePassword } from './nickname.js';
import { BOARD_SIZE, MAX_SERVED_PER_LEVEL } from './rules.js';

// שגיאה עם קוד מ-messages.js
export class OnlineError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OnlineError';
  }
}

const PLAYER_COLUMNS = 'id,nickname,total_served,best_level';

const toPlayer = (row) => ({ id: row.id, nickname: row.nickname, total: row.total_served, level: row.best_level });

// כל הפעולות מול Supabase. getClient מחזיר (Promise של) לקוח Supabase, כדי שבבדיקות אפשר להחליף אותו.
export function createOnlineApi(getClient) {
  // השחקן המחובר, או null. למי שנכנס עם Google ועוד לא בחר כינוי: nickname הוא null
  async function currentPlayer() {
    const sb = await getClient();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('profiles').select(PLAYER_COLUMNS).eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : { id: session.user.id, nickname: null, total: 0, level: 0 };
  }

  // 'ok', 'taken' (תפוס) או 'blocked' (מכיל מילה אסורה). הבדיקה עצמה נעשית במסד הנתונים.
  async function nicknameStatus(nickname) {
    const sb = await getClient();
    const { data, error } = await sb.rpc('nickname_status', { p_nickname: normalizeNickname(nickname) });
    if (error) throw error;
    return data;
  }

  async function signUp(nickname, password) {
    const bad = validateNickname(nickname) ?? validatePassword(password);
    if (bad) throw new OnlineError(bad);
    const status = await nicknameStatus(nickname);
    if (status === 'taken') throw new OnlineError('nickname_taken');
    if (status === 'blocked') throw new OnlineError('nickname_blocked');
    const sb = await getClient();
    const { data, error } = await sb.auth.signUp({
      email: nicknameToEmail(nickname),
      password,
      options: { data: { nickname: normalizeNickname(nickname) } },
    });
    if (error) throw error;
    if (!data.session) {
      // קורה רק כש-Confirm email דלוק ב-Supabase
      console.warn('Supabase: צריך לכבות את Confirm email (Authentication ← Sign In / Providers)');
      throw new OnlineError('unknown');
    }
    return currentPlayer();
  }

  async function signIn(nickname, password) {
    if (validateNickname(nickname) || !password) throw new OnlineError('wrong_login');
    const sb = await getClient();
    const { error } = await sb.auth.signInWithPassword({ email: nicknameToEmail(nickname), password });
    if (error) throw error;
    return currentPlayer();
  }

  async function signOut() {
    const sb = await getClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  // למי שנכנס עם Google: בחירת כינוי בפעם הראשונה
  async function claimNickname(nickname) {
    const bad = validateNickname(nickname);
    if (bad) throw new OnlineError(bad);
    const sb = await getClient();
    const { error } = await sb.rpc('claim_nickname', { p_nickname: normalizeNickname(nickname) });
    if (error) throw error;
    return currentPlayer();
  }

  // levelIndex: מספר השלב מ-0. מחזיר { total, level, rank }
  async function submitLevel(levelIndex, served) {
    if (!Number.isInteger(served) || served < 0 || served > MAX_SERVED_PER_LEVEL) throw new OnlineError('bad_served');
    const sb = await getClient();
    const { data, error } = await sb.rpc('submit_level', { p_level: levelIndex, p_served: served });
    if (error) throw error;
    return { total: data.total, level: data.best_level, rank: data.rank };
  }

  // השחקנים המובילים, רק מי שהניח לפחות פעם אחת
  async function fetchBoard() {
    const sb = await getClient();
    const { data, error } = await sb
      .from('profiles')
      .select(PLAYER_COLUMNS)
      .gt('total_served', 0)
      .order('total_served', { ascending: false })
      .order('best_level', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BOARD_SIZE);
    if (error) throw error;
    return data;
  }

  // המקום של שחקן לפי הסכום שלו: כמה שחקנים הניחו יותר, ועוד 1
  async function rankOf(total) {
    const sb = await getClient();
    const { count, error } = await sb.from('profiles').select('id', { count: 'exact', head: true }).gt('total_served', total);
    if (error) throw error;
    return count + 1;
  }

  return { currentPlayer, nicknameStatus, signUp, signIn, signOut, claimNickname, submitLevel, fetchBoard, rankOf };
}
