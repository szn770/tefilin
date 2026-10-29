import { firstLevelWith } from '../data/levels.js';
import { TEFILLIN_ICON } from '../ui/icons.js';

// הקטלוג של החנות: מה אפשר לקנות, במחיר כמה, ומתי זה נפתח. בלי השפעות על המשחק: את הקנייה עצמה עושה game.js.

// מחירי שדרוגים (לפי מספר הקניות)
export const COSTS = {
  booths: [300, 600],
  pairs: [80, 150, 250], // עמדות המתנה (השם נשאר מהגרסה הקודמת, בשביל ההתקדמות השמורה)
  sets: [400, 700, 1000], // זוג תפילין שני בדוכן
  cake: [150],
  shade: [200, 450],
  bin: [150],
  decor: [200, 450, 800],
  tank: [1500, 2500],
  training: [250, 550, 900],
  cleaner: [300],
  permit: [300],
  net: [300],
  sign: [200, 400, 650],
  speaker: [200, 450],
  gift: [350],
};
export const FLYER_PACK = 3;
export const FLYER_COST = 90;
export const MAX_FLYERS = 9;

// פריטים שקשורים למשהו שמופיע רק בשלבים מתקדמים: נפתחים בחנות שלפני השלב הזה
const NEEDS = { cleaner: 'trash', bin: 'trash', permit: 'inspector', net: 'pigeon', gift: 'first' };
// השלט: כל רמה מקלה על סוג אחר של ממהרים
const SIGN_STEPS = [
  { text: '📱 הממהרים בטלפון', needs: null },
  { text: '⭐ הקרקפתא', needs: 'first' },
  { text: '⏰ הממהרים מאוד', needs: 'runner' },
];

// state: { u (השדרוגים), score, nextLevel (השלב הבא, מ-0), booths, maxBooths, spots (עמדות בדוכנים), spotsFull }
// כל פריט: { cat, key, icon, title, desc, level, cost, maxed, can, locked }
export function shopCatalog(state) {
  const { u, score, nextLevel, booths, maxBooths, spots, spotsFull } = state;
  const lockedUntil = (feature) => {
    const at = feature ? firstLevelWith(feature) : 0;
    return nextLevel < at ? `🔒 נפתח בשלב ${at + 1}` : null;
  };
  const lvl = (key) => `רמה ${u[key]} מתוך ${COSTS[key].length}`;
  const owned = (key) => (u[key] ? 'יש ✓' : 'אין');
  const make = (cat, key, icon, title, desc, level, { blocked = null, locked = lockedUntil(NEEDS[key]) } = {}) => {
    const costs = COSTS[key];
    const maxed = u[key] >= costs.length;
    const cost = maxed ? 0 : costs[u[key]];
    return {
      cat, key, icon, title, desc: locked ?? blocked ?? desc, level, cost, maxed, locked,
      can: !maxed && !blocked && !locked && score >= cost,
    };
  };

  const sign = SIGN_STEPS[u.sign];
  const flyersFull = u.flyers >= MAX_FLYERS;
  const items = [
    // ---- דוכן ----
    make('stand', 'booths', '🏪', 'דוכן נוסף + שליח', 'עוד שליח שמניח במקביל, ועוד 2 עמדות המתנה', `דוכנים: ${booths} מתוך ${maxBooths}`),
    make('stand', 'pairs', '🧍', 'עמדת המתנה נוספת בדוכן', 'עוד מקום לחכות ליד הדוכן, עד שהשליח מתפנה', `עמדות: ${spots}`,
      { blocked: spotsFull ? 'בכל הדוכנים כבר יש 3 עמדות – קודם דוכן נוסף' : null }),
    make('stand', 'sets', TEFILLIN_ICON, 'זוג תפילין נוסף', 'השליח מניח לשני אנשים בבת אחת', `דוכנים עם 2 זוגות: ${u.sets} מתוך ${booths}`,
      { blocked: u.sets >= booths ? 'בכל הדוכנים כבר יש 2 זוגות – קודם דוכן נוסף' : null }),
    make('stand', 'cake', '🍰', 'פינת עוגה ולחיים', 'עוד 3 מקומות לחכות ליד הדוכן – בסבלנות', owned('cake')),
    make('stand', 'shade', '⛱️', 'שמשייה ומים קרים', u.shade ? 'עוד 4 שניות של סבלנות' : 'מי שמחכה בדוכן מחכה 4 שניות יותר בסבלנות', lvl('shade')),
    make('stand', 'bin', '🗑️', 'פח אשפה ליד הדוכן', 'פחות לכלוך נופל על הרצפה', owned('bin')),
    make('stand', 'decor', '🎈', 'קישוטים לדוכן', 'בלונים, דגלונים ואורות. כל רמה: +5% נחת', lvl('decor')),
    make('stand', 'tank', '🚐', 'טנק המבצעים', u.tank ? 'רמקול חזק לטנק: קורא לאנשים כל 6 שניות' : 'חונה ברחוב וקורא לאנשים לבד, כל 9 שניות', lvl('tank')),
    // ---- צוות ----
    make('team', 'training', '🎓', 'הכשרת שלוחים', 'השלוחים מניחים מהר יותר', lvl('training')),
    make('team', 'cleaner', '🧹', 'בחור לניקיון', 'אוסף לכלוך לבד, כל 5 שניות', owned('cleaner')),
    make('team', 'permit', '📜', 'רישיון ממוסגר', 'לפקח מספיקה לחיצה אחת', owned('permit')),
    make('team', 'net', '🕸️', 'רשת נגד יונים', 'יונים מגיעות בחצי מהתדירות', owned('net')),
    // ---- הסברה ----
    make('outreach', 'sign', '🪧', 'שילוט גדול', sign ? `לחיצה פחות ל${sign.text}` : 'כל השלטים כבר תלויים', lvl('sign'),
      { locked: sign ? lockedUntil(sign.needs) : null }),
    {
      cat: 'outreach', key: 'flyers', icon: '📄', title: `חומרי הסברה – ${FLYER_PACK} חבילות עלונים`,
      desc: 'כפתור במשחק: כל הממהרים במסך צריכים רק לחיצה אחת',
      level: `יש ${u.flyers}`, cost: FLYER_COST, maxed: flyersFull, locked: null,
      can: !flyersFull && score >= FLYER_COST,
    },
    make('outreach', 'speaker', '🎵', 'רמקול ניגונים', u.speaker ? 'רמה 2: הכפתור נטען מהר יותר (12 שניות)' : 'כפתור במשחק שמאט את כולם ל-5 שניות', lvl('speaker')),
    make('outreach', 'gift', '📖', 'סידור במתנה לקרקפתא', 'מי שמניח בפעם הראשונה מקבל סידור: ⭐ שווה פי 1.5 נחת', owned('gift')),
  ];
  // מה שעוד נעול – בסוף הרשימה
  return [...items.filter((it) => !it.locked), ...items.filter((it) => it.locked)];
}
