// שלבי המשחק. כל שלב מוסיף משהו חדש, ואחרי השלב האחרון ממשיכים לשלבים שהולכים ונהיים קשים.
// features: first (קרקפתא ⭐), trash (לכלוך), inspector (פקח), pigeon (יונים), bus (אוטובוס), runner (⏰)

const BASE = [
  {
    name: 'הרחוב השכונתי', goal: 8, time: 75, features: [],
    intro: { icon: '👋', title: 'מתחילים!', text: 'לוחצים על עוברים ושבים כדי לקרוא להם. מי שמדבר בטלפון 📱 צריך 3 לחיצות. לא קוראים לנשים ולילדים.' },
  },
  {
    name: 'פעם ראשונה', goal: 10, time: 80, features: ['first'],
    intro: { icon: '⭐', title: 'חדש: קרקפתא!', text: 'מי שמסומן בכוכב עוד לא הניח תפילין אף פעם. צריך 4 לחיצות – אבל הוא שווה 50 נחת!' },
  },
  {
    name: 'יום חם', goal: 12, time: 80, features: ['first', 'trash'],
    intro: { icon: '🗑️', title: 'חדש: לכלוך!', text: 'כוסות ועטיפות נופלות ליד הדוכן. לחצו עליהן כדי לנקות. אם יש 4 – אנשים לא רוצים לבוא!' },
  },
  {
    name: 'הפקח מגיע', goal: 14, time: 85, features: ['first', 'trash', 'inspector'],
    intro: { icon: '📋', title: 'חדש: פקח העירייה!', text: 'פקח הולך לכיוון הדוכן כדי לתת קנס. לחצו עליו פעמיים כדי להראות רישיון – לפני שהוא מגיע!' },
  },
  {
    name: 'יונים בכיכר', goal: 16, time: 85, features: ['first', 'trash', 'inspector', 'pigeon'],
    intro: { icon: '🐦', title: 'חדש: יונים!', text: 'יונה שנוחתת על השולחן עוצרת את השליח. לחצו עליה כדי לגרש אותה!' },
  },
  {
    name: 'שעת העומס', goal: 18, time: 90, features: ['first', 'trash', 'inspector', 'pigeon', 'bus', 'runner'],
    intro: { icon: '🚌', title: 'חדש: אוטובוסים!', text: 'אוטובוס מוריד הרבה אנשים בבת אחת. ויש גם ממהרים מאוד ⏰ – 5 לחיצות!' },
  },
  {
    name: 'ערב שבת', goal: 20, time: 90, features: ['first', 'trash', 'inspector', 'pigeon', 'bus', 'runner'],
    intro: { icon: '🕯️', title: 'לפני שבת!', text: 'כולם ממהרים הביתה. כל מה שלמדתם – ביחד!' },
  },
];

const ALL = ['first', 'trash', 'inspector', 'pigeon', 'bus', 'runner'];

export function getLevel(index) {
  const base = BASE[index] ?? {
    name: `מבצע גדול ${index - BASE.length + 2}`,
    goal: 20 + (index - BASE.length + 1) * 2,
    time: 90,
    features: ALL,
    intro: { icon: '🔥', title: 'עוד יותר מהר!', text: 'יותר אנשים, יותר ממהרים, יותר הפרעות. בהצלחה!' },
  };
  const features = new Set(base.features);
  return {
    ...base,
    index,
    number: index + 1,
    has: (f) => features.has(f),
    // הקושי עולה משלב לשלב
    speedMult: Math.min(1.45, 1 + index * 0.06),
    spawnBase: Math.max(0.5, 1.5 - index * 0.12),
    hazardRate: Math.min(2, 1 + index * 0.12),
    // וגם ההפסדים: בשלבים מתקדמים טעות עולה הרבה יותר
    penalty: {
      wrong: 10 + index * 8, // קריאה לאישה / לילד
      fine: 30 + index * 15, // קנס מהפקח
      giveUp: 5 + index * 3, // לקוח שנמאס לו לחכות
    },
    hearts: 3, // "שם טוב" – כל טעות או קנס מורידים לב, ובלי לבבות השלב נגמר
  };
}

// כוכבים לפי מספר ההנחות ביחס ליעד
export function starsFor(level, served) {
  if (served >= Math.ceil(level.goal * 1.5)) return 3;
  if (served >= Math.ceil(level.goal * 1.25)) return 2;
  if (served >= level.goal) return 1;
  return 0;
}
