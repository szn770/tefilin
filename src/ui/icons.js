// תפילין של ראש: הבית עם האות ש' על התיתורא, והרצועה שמקיפה את הראש. בקואורדינטות של ריבוע 44×44.
// הצבע מגיע מהקבוצה שעוטפת (fill/stroke), והמשטחים הבהירים נותנים מראה של קובייה.
const HI = (o) => `style="fill:#fff;fill-opacity:${o};stroke:none"`;
export const TEFILLIN_SHAPES = `
  <path d="M8 31 C 2 22, 10 6, 22 6 C 34 6, 42 22, 36 31" fill="none" stroke-width="2.6"/>
  <polygon stroke-width="1" points="8,30 22,24 36,30 22,36"/>
  <polygon stroke-width="1" points="8,30 22,36 22,40 8,34"/>
  <polygon stroke-width="1" points="22,36 36,30 36,34 22,40"/>
  <polygon ${HI(0.16)} points="8,30 22,24 36,30 22,36"/>
  <polygon ${HI(0.07)} points="22,36 36,30 36,34 22,40"/>
  <polygon stroke-width="1" points="13,15 22,11 31,15 22,19"/>
  <polygon stroke-width="1" points="13,15 22,19 22,31 13,27"/>
  <polygon stroke-width="1" points="22,19 31,15 31,27 22,31"/>
  <polygon ${HI(0.25)} points="13,15 22,11 31,15 22,19"/>
  <polygon ${HI(0.1)} points="22,19 31,15 31,27 22,31"/>
  <text transform="matrix(1 .444 0 1 0 0)" x="17.6" y="14.9">ש</text>`;

// אותו סמל בגודל של אות, לשימוש בתוך טקסט: מונה ההנחות, סיכום השלב, החנות ולוח השיאים
export const TEFILLIN_ICON = `<svg class="tfl-ico" viewBox="1 4 42 39" aria-hidden="true"><g>${TEFILLIN_SHAPES}</g></svg>`;
