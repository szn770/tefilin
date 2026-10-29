import { describe, expect, it } from 'vitest';
import { shopCatalog, COSTS } from '../../src/game/shop.js';
import { firstLevelWith } from '../../src/data/levels.js';

const NONE = {
  booths: 0, pairs: 0, sets: 0, cake: 0, shade: 0, bin: 0, decor: 0, tank: 0,
  training: 0, cleaner: 0, permit: 0, net: 0, sign: 0, speaker: 0, flyers: 0, gift: 0,
};
const catalog = (over = {}, u = {}) => shopCatalog({
  u: { ...NONE, ...u }, score: 100000, nextLevel: 0, booths: 1, maxBooths: 3, spots: 2, spotsFull: false, ...over,
});
const item = (key, over, u) => catalog(over, u).find((it) => it.key === key);

describe('פריטים שנפתחים בשלב שלהם', () => {
  it.each([
    ['cleaner', 'trash'], ['bin', 'trash'], ['permit', 'inspector'], ['net', 'pigeon'], ['gift', 'first'],
  ])('%s: נעול עד החנות שלפני השלב של %s', (key, feature) => {
    const at = firstLevelWith(feature);
    expect(at).toBeGreaterThan(0);
    const before = item(key, { nextLevel: at - 1 });
    expect(before.locked).toBe(`🔒 נפתח בשלב ${at + 1}`);
    expect(before.can).toBe(false);
    expect(before.desc).toBe(before.locked);
    const open = item(key, { nextLevel: at });
    expect(open.locked).toBeNull();
    expect(open.can).toBe(true);
  });

  it('הבחור לניקיון נפתח לקראת שלב 3, שבו מתחיל הלכלוך', () => {
    expect(item('cleaner', { nextLevel: 1 }).locked).toBe('🔒 נפתח בשלב 3');
    expect(item('cleaner', { nextLevel: 2 }).locked).toBeNull();
  });

  it('השלט: כל רמה נפתחת רק כשהממהרים שלה מופיעים', () => {
    expect(item('sign', { nextLevel: 0 }).can).toBe(true);
    expect(item('sign', { nextLevel: 0 }, { sign: 1 }).locked).toBe('🔒 נפתח בשלב 2');
    expect(item('sign', { nextLevel: 1 }, { sign: 1 }).can).toBe(true);
    expect(item('sign', { nextLevel: 4 }, { sign: 2 }).locked).toBe(`🔒 נפתח בשלב ${firstLevelWith('runner') + 1}`);
    expect(item('sign', { nextLevel: 9 }, { sign: 3 }).maxed).toBe(true);
  });

  it('מה שנעול מופיע בסוף הרשימה', () => {
    const list = catalog({ nextLevel: 0 });
    const firstLocked = list.findIndex((it) => it.locked);
    expect(firstLocked).toBeGreaterThan(0);
    expect(list.slice(firstLocked).every((it) => it.locked)).toBe(true);
  });
});

describe('עמדות המתנה וזוגות תפילין', () => {
  it('עמדת המתנה (ולא "זוג תפילין") נחסמת כשכל הדוכנים מלאים', () => {
    expect(item('pairs').title).toBe('עמדת המתנה נוספת בדוכן');
    const full = item('pairs', { spotsFull: true });
    expect(full.can).toBe(false);
    expect(full.desc).toMatch(/קודם דוכן נוסף/);
  });

  it('זוג תפילין נוסף: אחד לכל דוכן', () => {
    expect(item('sets', { booths: 1 }).can).toBe(true);
    expect(item('sets', { booths: 1 }, { sets: 1 }).can).toBe(false);
    expect(item('sets', { booths: 2 }, { sets: 1 }).can).toBe(true);
    expect(item('sets', { booths: 3 }, { sets: 3 }).maxed).toBe(true);
  });
});

describe('מחירים', () => {
  it('המחיר לפי מספר הקניות, וכל רמה יקרה מהקודמת', () => {
    for (const [key, costs] of Object.entries(COSTS)) {
      for (let i = 1; i < costs.length; i++) expect(costs[i], key).toBeGreaterThan(costs[i - 1]);
    }
    expect(item('decor', {}, { decor: 1 }).cost).toBe(COSTS.decor[1]);
  });

  it('אי אפשר לקנות בלי מספיק נחת', () => {
    expect(item('booths', { score: COSTS.booths[0] - 1 }).can).toBe(false);
    expect(item('booths', { score: COSTS.booths[0] }).can).toBe(true);
  });

  it('עלונים: עד 9', () => {
    expect(item('flyers', {}, { flyers: 9 }).can).toBe(false);
    expect(item('flyers', {}, { flyers: 6 }).can).toBe(true);
  });
});
