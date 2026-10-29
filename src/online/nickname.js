import { NICK_MIN, NICK_MAX, PASSWORD_MIN, PLAYER_EMAIL_DOMAIN } from './rules.js';

const ALLOWED = /^[א-תa-zA-Z0-9]+( [א-תa-zA-Z0-9]+)*$/;

// "  דודי   כהן " → "דודי כהן"
export function normalizeNickname(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

// לצורך השוואה: "Dudi" ו-"dudi" הם אותו כינוי (כמו nickname_key במסד הנתונים)
export function nicknameKey(raw) {
  return normalizeNickname(raw).toLowerCase();
}

// מחזיר קוד שגיאה, או null כשהכינוי תקין
export function validateNickname(raw) {
  const nick = normalizeNickname(raw);
  if (nick.length < NICK_MIN) return 'nick_short';
  if (nick.length > NICK_MAX) return 'nick_long';
  if (!ALLOWED.test(nick)) return 'nick_chars';
  return null;
}

export function validatePassword(password) {
  return String(password ?? '').length < PASSWORD_MIN ? 'password_short' : null;
}

// כל כינוי מקבל אימייל פנימי קבוע: האותיות שלו כמספרים הקסדצימליים (עברית לא מותרת באימייל)
export function nicknameToEmail(raw) {
  const bytes = new TextEncoder().encode(nicknameKey(raw));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `p${hex}@${PLAYER_EMAIL_DOMAIN}`;
}
