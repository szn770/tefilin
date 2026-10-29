import { describe, expect, it } from 'vitest';
import { contactPayload } from '../../src/ui/contact.js';

describe('צור קשר', () => {
  it('בונה הודעה עם נושא, שם המשחק והמפתח', () => {
    const p = contactPayload({ name: ' דודי ', email: '', topic: 'רעיון / הארה', message: ' כדאי להוסיף שלב! ' }, 'key-123');
    expect(p).toEqual({
      name: 'דודי',
      email: '',
      topic: 'רעיון / הארה',
      message: 'כדאי להוסיף שלב!',
      access_key: 'key-123',
      subject: 'מבצע תפילין · רעיון / הארה',
      from_name: 'הנחת?! – מבצע תפילין',
    });
  });
  it('בלי נושא: "אחר"', () => {
    expect(contactPayload({ message: 'שלום' }, 'k').subject).toBe('מבצע תפילין · אחר');
  });
  it('מלכודת הבוטים מסומנת: לא שולחים כלום', () => {
    expect(contactPayload({ botcheck: 'on', message: 'ספאם' }, 'k')).toBeNull();
  });
});
