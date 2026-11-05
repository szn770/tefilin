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

  // ---- הדרכה: מניחים תפילין צעד אחר צעד ----
  { id: 'm_learn', voices: ['mendy'], text: 'בוא, נלמד ביחד להניח תפילין!', say: 'בּוֹא, נִלְמַד בְּיַחַד לְהָנִיחַ תְּפִלִּין!' },
  { id: 'm_repeat', voices: ['mendy'], text: 'תגיד אחריי את הברכה', say: 'תַּגִּיד אַחֲרַי אֶת הַבְּרָכָה' },
  { id: 'm_upper', voices: ['mendy'], text: 'שתי כריכות על הזרוע, ויחד עם הלולאה נוצרת האות שין', say: 'שְׁתֵּי כְּרִיכוֹת עַל הַזְּרוֹעַ, וְיַחַד עִם הַלּוּלָאָה נוֹצֶרֶת הָאוֹת שִׁין' },
  { id: 'm_wrap', voices: ['mendy'], text: 'עכשיו שבע כריכות!', say: 'עַכְשָׁו שֶׁבַע כְּרִיכוֹת!' },
  { id: 'm_rosh', voices: ['mendy'], text: 'עכשיו של ראש, מעל השיער. הקשר מאחורה במרכז, והתפילין מקדימה מונחות במקום צמיחת השיער וקדימה' },
  { id: 'm_palm', voices: ['mendy'], text: 'עכשיו על כף היד: חצי כריכה, וכריכה שלמה', say: 'עַכְשָׁו עַל כַּף הַיָּד: חֲצִי כְּרִיכָה, וּכְרִיכָה שְׁלֵמָה' },
  { id: 'm_finger', voices: ['mendy'], text: 'שלוש כריכות על האצבע האמצעית: למטה, באמצע, ושוב למטה', say: 'שָׁלוֹשׁ כְּרִיכוֹת עַל הָאֶצְבַּע הָאֶמְצָעִית: לְמַטָּה, בָּאֶמְצַע, וְשׁוּב לְמַטָּה' },
  { id: 'm_shema', voices: ['mendy'], text: 'יד על העיניים, ונגיד שמע ישראל', say: 'יָד עַל הָעֵינַיִם, וְנַגִּיד שְׁמַע יִשְׂרָאֵל' },
  { id: 'm_remove', voices: ['mendy'], text: 'חולצים בסדר הפוך!', say: 'חוֹלְצִים בְּסֵדֶר הָפוּךְ!' },
  { id: 'm_lechaim', voices: ['mendy'], text: 'לחיים! מה תרצה?', say: 'לְחַיִּים! מָה תִּרְצֶה?' },
  // הברכה ושמע ישראל מילה במילה (BRACHA, SHEMA למטה). כל מילה נשמעת רק כשהילד מקיש עליה.
  // בלי ניקוד: המנוע מקריא כך טבעי יותר. ניקוד רק במילה שהוא היה קורא לא נכון (אֲדוֹשֵׁם)
  { id: 'w_baruch', voices: ['mendy'], text: 'ברוך' },
  { id: 'w_ata', voices: ['mendy'], text: 'אתה' },
  { id: 'w_hashem', voices: ['mendy'], text: 'ה׳', say: 'אֲדוֹשֵׁם' },
  { id: 'w_elokeinu', voices: ['mendy'], text: 'אלוקינו' },
  { id: 'w_melech', voices: ['mendy'], text: 'מלך' },
  { id: 'w_haolam', voices: ['mendy'], text: 'העולם' },
  { id: 'w_asher', voices: ['mendy'], text: 'אשר' },
  { id: 'w_kidshanu', voices: ['mendy'], text: 'קדשנו' },
  { id: 'w_bemitzvotav', voices: ['mendy'], text: 'במצוותיו' },
  { id: 'w_vetzivanu', voices: ['mendy'], text: 'וציוונו' },
  { id: 'w_lehaniach', voices: ['mendy'], text: 'להניח' },
  { id: 'w_tefillin', voices: ['mendy'], text: 'תפילין' },
  { id: 'w_shema', voices: ['mendy'], text: 'שמע' },
  { id: 'w_yisrael', voices: ['mendy'], text: 'ישראל' },
  { id: 'w_echad', voices: ['mendy'], text: 'אחד' },

  // ---- הסברים במשחק הרגיל (guide): נשמעים גם כשהקולות כבויים, בשביל ילדים שעוד לא קוראים ----
  // פתיחת כל שלב, ומשפט קצר בפעם הראשונה בשלב שמגיעה הפרעה. בלי ניקוד
  { id: 'g_level1', guide: true, voices: ['mendy'], text: 'מתחילים! לוחצים על עוברים ושבים כדי לקרוא להם. מי שמדבר בטלפון צריך שלוש לחיצות. לא קוראים לנשים ולילדים.' },
  { id: 'g_level2', guide: true, voices: ['mendy'], text: 'חדש: קרקפתא! מי שמסומן בכוכב עוד לא הניח תפילין אף פעם. צריך ארבע לחיצות, אבל הוא שווה חמישים נחת!' },
  { id: 'g_level3', guide: true, voices: ['mendy'], text: 'חדש: לכלוך! כוסות ועטיפות נופלות ליד הדוכן. לחצו עליהן כדי לנקות. אם יש ארבע, אנשים לא רוצים לבוא!' },
  { id: 'g_level4', guide: true, voices: ['mendy'], text: 'חדש: פקח העירייה! פקח הולך לכיוון הדוכן כדי לתת קנס. לחצו עליו פעמיים כדי להראות רישיון, לפני שהוא מגיע!' },
  { id: 'g_level5', guide: true, voices: ['mendy'], text: 'חדש: יונים! יונה שנוחתת על השולחן עוצרת את השליח. לחצו עליה כדי לגרש אותה!' },
  { id: 'g_level6', guide: true, voices: ['mendy'], text: 'חדש: אוטובוסים! אוטובוס מוריד הרבה אנשים בבת אחת. ויש גם ממהרים מאוד, צריך חמש לחיצות!' },
  { id: 'g_level7', guide: true, voices: ['mendy'], text: 'לפני שבת! כולם ממהרים הביתה. כל מה שלמדתם, ביחד!' },
  { id: 'g_more', guide: true, voices: ['mendy'], text: 'עוד יותר מהר! יותר אנשים, יותר ממהרים, יותר הפרעות. בהצלחה!' },
  { id: 'h_trash', guide: true, voices: ['mendy'], text: 'לכלוך ליד הדוכן! לחצו עליו כדי לנקות' },
  { id: 'h_inspector', guide: true, voices: ['mendy'], text: 'פקח בדרך! לחצו עליו פעמיים, לפני שהוא מגיע' },
  { id: 'h_pigeon', guide: true, voices: ['mendy'], text: 'יונה על השולחן! לחצו עליה כדי לגרש אותה' },
  { id: 'h_bus', guide: true, voices: ['mendy'], text: 'אוטובוס! הרבה אנשים יורדים בבת אחת' },

  // ---- עוברים ושבים ----
  { id: 'c_ok', voices: MEN, text: 'יאללה, בסדר!', say: 'יַאללָה, בְּסֵדֶר!' },
  { id: 'c_thanks', voices: MEN, text: 'תודה רבה!', say: 'תּוֹדָה רַבָּה!' },
  { id: 'c_tired', voices: MEN, text: 'נמאס לי לחכות...', say: 'נִמְאַס לִי לְחַכּוֹת...' },
  { id: 'c_rush', voices: ['man2'], text: 'אני ממהר!', say: 'אֲנִי מְמַהֵר!' },
  { id: 'c_rush2', voices: ['man2'], text: 'נו טוב, רק דקה!', say: 'נוּ טוֹב, רַק דַּקָּה!' },
  { id: 's_sure', voices: ['man2'], text: 'בטח! זכות לחיילים!', say: 'בֶּטַח! זְכוּת לַחַיָּלִים!' },
  { id: 'g_long', voices: ['oldman'], text: 'לא הנחתי מאז הבר מצווה...', say: 'לֹא הִנַּחְתִּי מֵאָז הַבַּר מִצְוָה...' },
  { id: 'c_dirty', voices: MEN, text: 'איכס, מלוכלך פה!', say: 'אִיכְס, מְלֻכְלָךְ פֹּה!' },
  // המתלמד בהדרכה הוא תמיד 'man' – קול אחר משל מנדי
  { id: 'c_lefty', voices: ['man'], text: 'אני שמאלי!', say: 'אֲנִי שְׂמָאלִי!' },
  { id: 'c_righty', voices: ['man'], text: 'אני כותב ביד ימין', say: 'אֲנִי כּוֹתֵב בַּיָּד יָמִין' },
  { id: 'f_hmm', voices: ['man'], text: 'אני? אף פעם לא הנחתי...', say: 'אֲנִי? אַף פַּעַם לֹא הִנַּחְתִּי...' },
  { id: 'f_first', voices: ['man'], text: 'טוב... בוא ננסה!', say: 'טוֹב... בּוֹא נְנַסֶּה!' },
  { id: 'w_no', voices: ['woman'], text: 'אני אישה! 😄', say: 'אֲנִי אִשָּׁה!' },
  { id: 'k_young', voices: ['man'], text: 'אני רק בן 10!', say: 'אֲנִי רַק בֶּן עֶשֶׂר!' },
  { id: 'i_fine', voices: ['man2'], text: 'אין רישיון? קנס!', say: 'אֵין רִשָּׁיוֹן? קְנָס!' },
  { id: 'i_ok', voices: ['man2'], text: 'בסדר, יום טוב!', say: 'בְּסֵדֶר, יוֹם טוֹב!' },
];

export const LINE_BY_ID = Object.fromEntries(LINES.map((l) => [l.id, l]));

// המילים של הברכה ושל שמע ישראל, לפי הסדר (ה׳ ואלוקינו חוזרות על אותן הקלטות)
export const BRACHA = [
  'w_baruch', 'w_ata', 'w_hashem', 'w_elokeinu', 'w_melech', 'w_haolam',
  'w_asher', 'w_kidshanu', 'w_bemitzvotav', 'w_vetzivanu', 'w_lehaniach', 'w_tefillin',
];
export const SHEMA = ['w_shema', 'w_yisrael', 'w_hashem', 'w_elokeinu', 'w_hashem', 'w_echad'];

// מה שנשמע בהדרכה, לפי הסדר. npm run voices:training מקליט רק את אלה
// ההסברים שנשמעים במשחק הרגיל
export const GUIDE_LINE_IDS = LINES.filter((l) => l.guide).map((l) => l.id);

export const TRAINING_LINE_IDS = [
  'm_learn', 'c_righty', 'c_lefty', 'm_repeat', ...new Set([...BRACHA, ...SHEMA]),
  'm_upper', 'm_wrap', 'm_palm', 'm_rosh', 'm_finger', 'm_shema', 'm_remove', 'm_lechaim', 'c_thanks', 'm_mazal',
];
