import { describe, expect, it } from 'vitest';
import { nicknameKey, nicknameToEmail, normalizeNickname, validateNickname, validatePassword } from '../../src/online/nickname.js';
import { PLAYER_EMAIL_DOMAIN } from '../../src/online/rules.js';

describe('ניקוי כינוי', () => {
  it('מוריד רווחים מיותרים בהתחלה, בסוף ובאמצע', () => {
    expect(normalizeNickname('  דודי   כהן ')).toBe('דודי כהן');
  });
  it('מתמודד עם ערך ריק', () => {
    expect(normalizeNickname(undefined)).toBe('');
  });
  it('אותו כינוי באנגלית, באותיות גדולות או קטנות, נחשב אותו כינוי', () => {
    expect(nicknameKey(' Dudi ')).toBe(nicknameKey('dudi'));
  });
});

describe('בדיקת כינוי', () => {
  it.each(['דודי', 'Mendy770', 'יוסי הגיבור', 'אב', 'שנים עשר תו'])('מקבל "%s"', (nick) => {
    expect(validateNickname(nick)).toBeNull();
  });
  it('קצר מדי', () => expect(validateNickname('א')).toBe('nick_short'));
  it('רווחים בלבד נחשבים קצר מדי', () => expect(validateNickname('   ')).toBe('nick_short'));
  it('ארוך מדי', () => expect(validateNickname('שלושה עשר תווים')).toBe('nick_long'));
  it.each(['דודי!', 'a@b', 'מנדי_כהן', '😀😀'])('דוחה סימנים: "%s"', (nick) => {
    expect(validateNickname(nick)).toBe('nick_chars');
  });
});

describe('בדיקת סיסמה', () => {
  it('לפחות 6 תווים', () => {
    expect(validatePassword('12345')).toBe('password_short');
    expect(validatePassword('123456')).toBeNull();
  });
});

describe('אימייל פנימי מכינוי', () => {
  it('זהה לכינויים ששווים בהשוואה', () => {
    expect(nicknameToEmail('  Dudi  Cohen')).toBe(nicknameToEmail('dudi cohen'));
  });
  it('שונה לכינויים שונים', () => {
    expect(nicknameToEmail('דודי')).not.toBe(nicknameToEmail('דוד'));
  });
  it('בנוי רק מאותיות שמותרות באימייל', () => {
    const email = nicknameToEmail('יוסי הגיבור 7');
    expect(email).toMatch(new RegExp(`^p[0-9a-f]+@${PLAYER_EMAIL_DOMAIN.replaceAll('.', '\\.')}$`));
  });
  it('גם הכינוי הארוך ביותר נכנס במגבלה של 64 תווים לפני ה-@', () => {
    const local = nicknameToEmail('שששששששששששש').split('@')[0];
    expect(local.length).toBeLessThanOrEqual(64);
  });
});
