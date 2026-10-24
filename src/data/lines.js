// כל משפטי הדיבור במשחק – מקור אחד גם למשחק וגם לסקריפט ההקלטות (tools/generate-voices.mjs).
// text = מה שמוצג בבועה. say = מה שנשלח להקראה (עם ניקוד לשיפור ההגייה).
// voices = אילו קולות מקליטים. משפט עם כמה קולות נשמר כ-<id>__<voice>.mp3.

export const VOICE_KEYS = ['mendy', 'man', 'man2', 'oldman', 'woman'];

const MEN = ['man', 'man2', 'oldman'];

export const LINES = [
  // ---- מנדי והשלוחים ----
  { id: 'm_call', voices: ['mendy'], text: 'יהודי! הנחת היום תפילין?', say: 'יְהוּדִי! הִנַּחְתָּ הַיּוֹם תְּפִילִּין?' },
  { id: 'm_call2', voices: ['mendy'], text: 'בוא, רק דקה!', say: 'בּוֹא, רַק דַּקָּה!' },
  { id: 'm_full', voices: ['mendy'], text: 'רגע, הדוכן מלא!', say: 'רֶגַע, הַדּוּכָן מָלֵא!' },
  { id: 'm_mazal', voices: ['mendy'], text: 'מזל טוב! יישר כח!', say: 'מַזָּל טוֹב! יִישַׁר כֹּחַ!' },
  { id: 'm_oops', voices: ['mendy'], text: 'אופס, סליחה!', say: 'אוּפְּס, סְלִיחָה!' },
  { id: 'm_day', voices: ['mendy'], text: 'יאללה, יום חדש של מבצעים!', say: 'יַאללָה, יוֹם חָדָשׁ שֶׁל מִבְצָעִים!' },
  { id: 'm_first', voices: ['mendy'], text: 'מזל טוב! פעם ראשונה!', say: 'מַזָּל טוֹב! פַּעַם רִאשׁוֹנָה!' },
  { id: 'm_permit', voices: ['mendy'], text: 'הנה הרישיון!', say: 'הִנֵּה הָרִשָּׁיוֹן!' },
  { id: 'm_shoo', voices: ['mendy'], text: 'קישטה, יונה!', say: 'קִישְׁטָה, יוֹנָה!' },

  // ---- עוברים ושבים ----
  { id: 'c_ok', voices: MEN, text: 'יאללה, בסדר!', say: 'יַאללָה, בְּסֵדֶר!' },
  { id: 'c_thanks', voices: MEN, text: 'תודה רבה!', say: 'תּוֹדָה רַבָּה!' },
  { id: 'c_tired', voices: MEN, text: 'נמאס לי לחכות...', say: 'נִמְאַס לִי לְחַכּוֹת...' },
  { id: 'c_rush', voices: ['man2'], text: 'אני ממהר!', say: 'אֲנִי מְמַהֵר!' },
  { id: 'c_rush2', voices: ['man2'], text: 'נו טוב, רק דקה!', say: 'נוּ טוֹב, רַק דַּקָּה!' },
  { id: 's_sure', voices: ['man2'], text: 'בטח! זכות לחיילים!', say: 'בֶּטַח! זְכוּת לַחַיָּלִים!' },
  { id: 'g_long', voices: ['oldman'], text: 'לא הנחתי מאז הבר מצווה...', say: 'לֹא הִנַּחְתִּי מֵאָז הַבַּר מִצְוָה...' },
  { id: 'c_dirty', voices: MEN, text: 'איכס, מלוכלך פה!', say: 'אִיכְס, מְלֻכְלָךְ פֹּה!' },
  { id: 'f_hmm', voices: ['man'], text: 'אני? אף פעם לא הנחתי...', say: 'אֲנִי? אַף פַּעַם לֹא הִנַּחְתִּי...' },
  { id: 'f_first', voices: ['man'], text: 'טוב... בוא ננסה!', say: 'טוֹב... בּוֹא נְנַסֶּה!' },
  { id: 'w_no', voices: ['woman'], text: 'אני אישה! 😄', say: 'אֲנִי אִשָּׁה!' },
  { id: 'k_young', voices: ['man'], text: 'אני רק בן 10!', say: 'אֲנִי רַק בֶּן עֶשֶׂר!' },
  { id: 'i_fine', voices: ['man2'], text: 'אין רישיון? קנס!', say: 'אֵין רִשָּׁיוֹן? קְנָס!' },
  { id: 'i_ok', voices: ['man2'], text: 'בסדר, יום טוב!', say: 'בְּסֵדֶר, יוֹם טוֹב!' },
];

export const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l]));
