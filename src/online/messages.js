// הודעות שגיאה לשחקנים, בעברית פשוטה
const MESSAGES = {
  nick_short: 'הכינוי קצר מדי: לפחות 2 אותיות',
  nick_long: 'הכינוי ארוך מדי: עד 12 תווים',
  nick_chars: 'בכינוי מותר רק אותיות (עברית או אנגלית), ספרות ורווח',
  password_short: 'הסיסמה קצרה מדי: לפחות 6 תווים',
  nickname_taken: 'הכינוי הזה כבר תפוס, נסו כינוי אחר',
  nickname_invalid: 'בכינוי מותר רק אותיות (עברית או אנגלית), ספרות ורווח',
  wrong_login: 'הכינוי או הסיסמה לא נכונים',
  too_many: 'יותר מדי ניסיונות. חכו כמה דקות ונסו שוב',
  offline: 'אין חיבור כרגע. בדקו את האינטרנט ונסו שוב',
  too_fast: 'התוצאה הקודמת נשמרה ממש עכשיו',
  bad_served: 'התוצאה לא נראית אמיתית, ולכן לא נשמרה',
  bad_level: 'התוצאה לא נראית אמיתית, ולכן לא נשמרה',
  not_signed_in: 'צריך להתחבר קודם',
  no_profile: 'צריך לבחור כינוי קודם',
  already_has_profile: 'כבר יש לך כינוי',
  unknown: 'משהו השתבש. נסו שוב עוד רגע',
};

// מתרגם שגיאה (שלנו, של Supabase Auth או של מסד הנתונים) לקוד אחיד
export function errorCode(err) {
  if (!err) return 'unknown';
  if (typeof err === 'string') return MESSAGES[err] ? err : 'unknown';
  const code = err.code ?? '';
  const msg = String(err.message ?? '');
  if (MESSAGES[msg]) return msg; // השגיאות של הפונקציות שלנו ב-Supabase
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'nickname_taken';
  if (/database error saving new user/i.test(msg)) return 'nickname_taken';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'wrong_login';
  if (code === 'weak_password') return 'password_short';
  if (err.status === 429 || /rate limit/i.test(code + msg)) return 'too_many';
  if (err.name === 'AuthRetryableFetchError' || /failed to fetch|network|load failed/i.test(msg)) return 'offline';
  return 'unknown';
}

export function errorMessage(err) {
  return MESSAGES[errorCode(err)];
}
