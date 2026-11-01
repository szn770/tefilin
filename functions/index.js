// הכתובת הזו עברה לאתר ילד שעשועים. רק האתר, שמביא מכאן את המשחק ומזדהה עם HUB_KEY, מקבל את המשחק.
// כל מי שנכנס ישירות מקבל דף שלוקח איתו את ההתקדמות מהדפדפן ומעביר אותו לאתר.
// רק הדף הראשי עובר כאן, כדי שקובצי המשחק לא ייספרו כבקשות לשרת.
const TARGET = 'https://yeledshaashuim.com/';

const PAGE = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>הנחת?! עבר לילד שעשועים</title>
<link rel="canonical" href="https://yeledshaashuim.com/">
<link rel="icon" href="https://yeledshaashuim.com/_hub/assets/logo.svg" type="image/svg+xml">
<noscript><meta http-equiv="refresh" content="0; url=${TARGET}"></noscript>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #d9f2ff; color: #1d2a5b; font: 18px/1.6 Arial, sans-serif; text-align: center; padding: 16px; box-sizing: border-box; }
  a { color: inherit; font-weight: 700; }
</style>
</head>
<body>
<p>המשחק עבר לאתר ילד שעשועים:<br><a id="go" href="${TARGET}">yeledshaashuim.com</a></p>
<script>
  // כולם נוחתים בדף הבית ובוחרים שם משחק. השלב, הניקוד והשדרוגים מגיעים איתם ומחכים לפתיחת המשחק
  (function () {
    var url = '${TARGET}';
    try {
      var save = JSON.parse(localStorage.getItem('hanachta-save-v1') || 'null');
      if (save) {
        var keep = { levelIndex: save.levelIndex, stars: save.stars, score: save.score, upgrades: save.upgrades };
        url += '?from=hanachat#carry=' + encodeURIComponent(JSON.stringify(keep));
      }
    } catch (e) { /* אין גישה לאחסון: פשוט עוברים */ }
    document.getElementById('go').href = url;
    location.replace(url);
  })();
</script>
</body>
</html>`;

export function onRequest({ request, next, env }) {
  if (!env.HUB_KEY || request.headers.get('x-hub-key') === env.HUB_KEY) return next();
  return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
