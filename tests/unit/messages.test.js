import { describe, expect, it } from 'vitest';
import { errorCode, errorMessage } from '../../src/online/messages.js';
import { OnlineError } from '../../src/online/api.js';

describe('תרגום שגיאות להודעות לשחקן', () => {
  it('שגיאה שלנו', () => {
    expect(errorCode(new OnlineError('nick_short'))).toBe('nick_short');
  });
  it('שגיאה מהפונקציות במסד הנתונים', () => {
    expect(errorCode({ code: 'P0001', message: 'too_fast' })).toBe('too_fast');
  });
  it('כינוי תפוס בהרשמה', () => {
    expect(errorCode({ code: 'user_already_exists', message: 'User already registered' })).toBe('nickname_taken');
  });
  it('כינוי שנתפס באותו רגע ממש (שגיאה מהטריגר)', () => {
    expect(errorCode({ message: 'Database error saving new user', status: 500 })).toBe('nickname_taken');
  });
  it('כינוי או סיסמה לא נכונים', () => {
    expect(errorCode({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 })).toBe('wrong_login');
  });
  it('יותר מדי ניסיונות', () => {
    expect(errorCode({ code: 'over_request_rate_limit', status: 429, message: 'Request rate limit reached' })).toBe('too_many');
  });
  it('אין אינטרנט', () => {
    expect(errorCode({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe('offline');
    expect(errorCode(new TypeError('Failed to fetch'))).toBe('offline');
  });
  it('שגיאה לא מוכרת', () => {
    expect(errorCode(new Error('boom'))).toBe('unknown');
    expect(errorCode(null)).toBe('unknown');
  });
  it('כל קוד מחזיר הודעה בעברית', () => {
    expect(errorMessage({ message: 'nickname_taken' })).toBe('הכינוי הזה כבר תפוס, נסו כינוי אחר');
    expect(errorMessage(new Error('boom'))).toMatch(/[א-ת]/);
  });
});
