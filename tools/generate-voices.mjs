#!/usr/bin/env node
// יוצר הקלטות קול לכל משפטי המשחק בעזרת ElevenLabs.
//
// הכנה חד-פעמית:  מעתיקים את .env.example ל-.env ושמים בו את המפתח (ELEVENLABS_API_KEY).
// הרצה:            npm run voices
// אפשרויות:
//   --force           להקליט מחדש גם משפטים שכבר קיימים
//   --only=id1,id2    להקליט רק משפטים מסוימים
//   --training        להקליט רק את המשפטים של ההדרכה (npm run voices:training)
//   --sfx             ליצור גם רעשי רקע (רחוב)
//   --dry-run         רק להציג מה יוקלט, בלי לשלוח בקשות
//   --list-voices     להציג את הקולות שזמינים בחשבון (כדי לבחור קולות ב-tools/voices.json)
//   --review          רק לבנות את דף ההאזנה tools/review.html, בלי לפנות ל-ElevenLabs (npm run voices:review)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES, LINE_BY_ID, VOICE_KEYS, TRAINING_LINE_IDS, BRACHA, SHEMA } from '../src/data/lines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'audio');
const API = 'https://api.elevenlabs.io';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

loadEnv(path.join(ROOT, '.env'));
const KEY = process.env.ELEVENLABS_API_KEY;
let model = process.env.ELEVENLABS_MODEL || 'eleven_v3';

const SFX = [
  { name: 'street', duration: 20, loop: true, text: 'Gentle busy city street ambience in Jerusalem, distant chatter of people, light footsteps, birds, soft distant traffic, calm daytime' },
];

// לדף ההאזנה
const SPEAKERS = { mendy: 'מנדי', man: 'המתלמד', man2: 'עובר אורח', oldman: 'סבא', woman: 'אישה' };
// השמות של הקולות המוכנים ב-ElevenLabs, כדי שיהיה קל למצוא אותם שם
const VOICE_NAMES = {
  TX3LPaxmHKxFdv7VOQHJ: 'Liam', iP95p4xoKVk53GoZ742B: 'Chris', cjVigY5qzO86Huf0OWal: 'Eric',
  pqHfZKP75CvOlQylNhV4: 'Bill', EXAVITQu4vr4xnSDxMaL: 'Sarah',
};
const TRAINING_VOICES = ['mendy', 'man']; // בהדרכה המתלמד מדבר תמיד בקול man

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});

async function main() {
  if (flag('review')) return writeReview();
  if (!KEY && !flag('dry-run')) {
    throw new Error('חסר מפתח: העתיקו את .env.example לקובץ .env ושימו בו את ELEVENLABS_API_KEY');
  }
  if (flag('list-voices')) return listVoices();

  const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'voices.json'), 'utf8'));
  for (const k of VOICE_KEYS) {
    if (!voices[k]) throw new Error(`אין קול מוגדר עבור "${k}" ב-tools/voices.json`);
  }

  const only = flag('training') ? TRAINING_LINE_IDS : opt('only')?.split(',');
  const jobs = [];
  for (const line of LINES) {
    if (only && !only.includes(line.id)) continue;
    const multi = line.voices.length > 1;
    for (const v of line.voices) {
      const file = multi ? `${line.id}__${v}.mp3` : `${line.id}.mp3`;
      jobs.push({ line, voice: v, file: path.join(OUT, 'voice', file) });
    }
  }
  const todo = jobs.filter((j) => flag('force') || !fs.existsSync(j.file));
  console.log(`🎙️  ${todo.length} הקלטות לביצוע (מתוך ${jobs.length}), מודל: ${model}`);
  if (flag('dry-run')) {
    for (const j of todo) console.log(`  ${path.basename(j.file)}  [${j.voice}]  ${j.line.say ?? j.line.text}`);
    return;
  }

  fs.mkdirSync(path.join(OUT, 'voice'), { recursive: true });
  let i = 0;
  for (const j of todo) {
    i++;
    const text = j.line.say ?? j.line.text;
    process.stdout.write(`  [${i}/${todo.length}] ${path.basename(j.file)} … `);
    const audio = await tts(voices[j.voice], text);
    fs.writeFileSync(j.file, audio);
    console.log('✓');
  }

  if (flag('sfx')) {
    fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
    for (const s of SFX) {
      const file = path.join(OUT, 'sfx', `${s.name}.mp3`);
      if (fs.existsSync(file) && !flag('force')) continue;
      process.stdout.write(`  🔊 sfx/${s.name} … `);
      fs.writeFileSync(file, await soundEffect(s));
      console.log('✓');
    }
  }

  writeManifest();
  writeReview();
  console.log('\n✅ סיימנו! רעננו את המשחק בדפדפן כדי לשמוע את הקולות.');
}

// ---- ElevenLabs ----
async function tts(voiceId, text) {
  const body = {
    text,
    model_id: model,
    language_code: 'he',
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
  };
  const res = await request(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, body, 'audio/mpeg');
  if (res.ok) return Buffer.from(await res.arrayBuffer());
  const err = await res.text();
  // אם המודל לא זמין בחשבון – עוברים ל-eleven_v3
  if (model !== 'eleven_v3' && /model/i.test(err) && res.status < 500) {
    console.log(`\n  ⚠️  המודל ${model} לא זמין, עוברים ל-eleven_v3`);
    model = 'eleven_v3';
    return tts(voiceId, text);
  }
  throw new Error(`ElevenLabs החזיר ${res.status}: ${err.slice(0, 400)}`);
}

async function soundEffect({ text, duration, loop }) {
  const body = { text, duration_seconds: duration, prompt_influence: 0.4, loop, model_id: 'eleven_text_to_sound_v2' };
  const res = await request('/v1/sound-generation', body, 'audio/mpeg');
  if (!res.ok) throw new Error(`ElevenLabs (אפקטים) החזיר ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function request(url, body, accept, attempt = 1) {
  const res = await fetch(API + url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = 1500 * attempt;
    process.stdout.write(`(ממתין ${wait / 1000} ש') `);
    await new Promise((r) => setTimeout(r, wait));
    return request(url, body, accept, attempt + 1);
  }
  return res;
}

async function listVoices() {
  const res = await fetch(`${API}/v1/voices`, { headers: { 'xi-api-key': KEY } });
  if (!res.ok) throw new Error(`ElevenLabs החזיר ${res.status}: ${await res.text()}`);
  const { voices } = await res.json();
  console.log('הקולות בחשבון שלך (העתיקו voice_id ל-tools/voices.json):\n');
  for (const v of voices) {
    const labels = Object.values(v.labels || {}).join(', ');
    console.log(`  ${v.voice_id}  ${v.name}${labels ? `  (${labels})` : ''}`);
  }
}

// ---- עזר ----
function writeManifest() {
  const list = (dir) => (fs.existsSync(path.join(OUT, dir))
    ? fs.readdirSync(path.join(OUT, dir)).filter((f) => f.endsWith('.mp3')).map((f) => f.replace(/\.mp3$/, ''))
    : []);
  const manifest = { voices: list('voice'), sfx: list('sfx'), music: list('music') };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`📄 manifest.json: ${manifest.voices.length} קולות, ${manifest.sfx.length} אפקטים, ${manifest.music.length} מוזיקה`);
}

// ---- דף האזנה: כל ההקלטות לפי מקום במשחק, עם הטקסט להעתקה ושם הקובץ להחלפה ----
function writeReview() {
  const voices = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'voices.json'), 'utf8'));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const row = (line, v) => ({ text: line.text, say: line.say ?? line.text, voice: v, name: line.voices.length > 1 ? `${line.id}__${v}` : line.id, dir: 'voice' });
  const words = new Set([...BRACHA, ...SHEMA]);
  const groups = [
    {
      title: 'ההדרכה, לפי הסדר',
      rows: TRAINING_LINE_IDS.filter((id) => !words.has(id)).flatMap((id) => LINE_BY_ID[id].voices.filter((v) => TRAINING_VOICES.includes(v)).map((v) => row(LINE_BY_ID[id], v))),
    },
    { title: 'הברכה, מילה במילה', rows: BRACHA.map((id) => row(LINE_BY_ID[id], 'mendy')) },
    { title: 'שמע ישראל, מילה במילה (ה׳ ואלוקינו נשמעות מההקלטות של הברכה)', rows: SHEMA.filter((id) => !BRACHA.includes(id)).map((id) => row(LINE_BY_ID[id], 'mendy')) },
  ];
  const shown = new Set(groups.flatMap((g) => g.rows.map((r) => r.name)));
  groups.push({ title: 'מוקלטים, אבל לא נשמעים כרגע (במשחק הרגיל אין קולות)', rows: LINES.flatMap((l) => l.voices.map((v) => row(l, v))).filter((r) => !shown.has(r.name)) });
  groups.push({ title: 'מוזיקה', rows: [{ text: 'הניגון של כפתור הרמקול', say: '', voice: '', name: 'nigun', dir: 'sfx' }] });

  let n = 0;
  const body = groups.map((g) => {
    const rows = g.rows.filter((r) => fs.existsSync(path.join(OUT, r.dir, `${r.name}.mp3`)));
    if (!rows.length) return '';
    return `<tr class="g"><th colspan="7">${esc(g.title)}</th></tr>\n` + rows.map((r) => {
      const id = voices[r.voice];
      const who = r.voice ? `${SPEAKERS[r.voice]}<small>${esc(VOICE_NAMES[id] ?? id)}</small>` : '';
      return `<tr data-name="${r.name}.mp3"><td class="n">${++n}</td><td><input type="checkbox" class="mark" aria-label="נשמע מוזר"></td>`
        + `<td class="t">${esc(r.text)}</td><td class="say copy" title="לחיצה מעתיקה">${esc(r.say)}</td><td class="who">${who}</td>`
        + `<td><audio controls preload="none" src="../public/audio/${r.dir}/${r.name}.mp3"></audio></td>`
        + `<td><button class="name" title="העתקת שם הקובץ">${r.name}.mp3</button></td></tr>`;
    }).join('\n');
  }).join('\n');
  const speakers = TRAINING_VOICES.map((v) => `<li><b>${SPEAKERS[v]}</b>: הקול <b>${esc(VOICE_NAMES[voices[v]] ?? '')}</b> <button class="name" title="העתקת המזהה">${voices[v]}</button></li>`).join('');

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>כל ההקלטות – מבצע תפילין</title>
<style>
body{font-family:Arial,sans-serif;margin:0;background:#f4f7fb;color:#1f2d55}
header{position:sticky;top:0;z-index:2;background:#1f2d55;color:#fff;padding:12px 20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
header h1{margin:0 0 0 auto;font-size:22px}
header button{font:inherit;font-size:16px;padding:8px 16px;border:0;border-radius:999px;background:#fff;color:#1f2d55;cursor:pointer}
header .count{font-weight:700}
.help{margin:16px 20px;line-height:1.7;max-width:950px}
.help code{background:#fff;padding:1px 6px;border-radius:6px}
table{border-collapse:collapse;width:calc(100% - 40px);margin:0 20px 40px;background:#fff}
td,th{padding:8px 10px;border-bottom:1px solid #dde4ef;text-align:right;vertical-align:middle}
tr.g th{background:#dcefff;font-size:18px;padding:10px}
td.n{color:#5f6d96;width:2.5em}
td.t{font-size:24px;font-weight:700}
td.say{font-size:22px;cursor:copy}
td.who small{display:block;color:#5f6d96}
.mark{width:22px;height:22px;accent-color:#d94a6f}
tr.marked{background:#fde5ec}
tr.on{background:#fff3c4}
button.name{font-family:monospace;font-size:14px;padding:6px 10px;border:1px solid #c6d3ea;border-radius:8px;background:#f7faff;cursor:copy}
.copied{outline:3px solid #1d9a5c}
</style></head>
<body>
<header><h1>כל ההקלטות במשחק</h1>
  <button id="all">▶ הכול ברצף</button><button id="onlyMarked">▶ רק המסומנים</button><button id="stop">⏹ עצירה</button>
  <button id="copyList">העתקת רשימת המסומנים</button><span class="count" id="count"></span></header>
<div class="help">
  <p><b>מה עושים:</b> מאזינים ומסמנים ✓ ליד כל הקלטה שנשמעת מוזרה. הסימונים נשמרים בדפדפן הזה. "העתקת רשימת המסומנים" מעתיקה את כולם, ואפשר להדביק אותם לי.</p>
  <p><b>כדי להקליט בעצמכם ב-ElevenLabs:</b> לוחצים על הטקסט המנוקד (עמודת "מה מדביקים ב-ElevenLabs") והוא מועתק. מדביקים אותו ב-ElevenLabs ובוחרים את אותו קול שמדבר בשורה, כדי שכל דמות תישמע אותו דבר לאורך ההדרכה. שומרים את הקובץ בשם שבעמודה האחרונה (לחיצה מעתיקה, למשל <code>w_baruch.mp3</code>), בתיקייה <code>הקלטות להחלפה</code> שבתיקיית המשחק. כשתסיימו, תגידו לי: אשווה את העוצמה לשאר ההקלטות ואכניס אותן למשחק.</p>
  <p><b>הקולות בהדרכה</b> (מודל Eleven v3, שפה: עברית):</p>
  <ul>${speakers}</ul>
  <p>במקום ה׳ שולחים לקול "אֲדוֹשֵׁם".</p>
</div>
<table><tr><th>#</th><th>מוזר?</th><th>מה כתוב במשחק</th><th>מה מדביקים ב-ElevenLabs</th><th>מי מדבר</th><th>הקלטה</th><th>שם קובץ להחלפה</th></tr>
${body}
</table>
<script>
const KEY = "tefillin-review-marks";
let marks = {}; try{ marks = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
const rows = [...document.querySelectorAll("tr[data-name]")];
function paint(){
  rows.forEach(r => { const on = !!marks[r.dataset.name]; r.classList.toggle("marked", on); r.querySelector(".mark").checked = on; });
  document.getElementById("count").textContent = "מסומנים: " + rows.filter(r => marks[r.dataset.name]).length;
}
document.addEventListener("change", e => {
  if(!e.target.classList.contains("mark")) return;
  const name = e.target.closest("tr").dataset.name;
  if(e.target.checked) marks[name] = 1; else delete marks[name];
  try{ localStorage.setItem(KEY, JSON.stringify(marks)); }catch(err){}
  paint();
});
async function copy(text, el){
  try{ await navigator.clipboard.writeText(text); }
  catch(e){ const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
  el.classList.add("copied"); setTimeout(() => el.classList.remove("copied"), 700);
}
document.addEventListener("click", e => {
  const b = e.target.closest("button.name, td.copy");
  if(b && b.textContent.trim()) copy(b.textContent.trim(), b);
});
let playing = 0;
async function playRows(list){
  const run = ++playing;
  for(const r of list){
    if(run !== playing) return;
    const a = r.querySelector("audio");
    r.classList.add("on"); r.scrollIntoView({block:"center"});
    await new Promise(res => { a.onended = res; a.onerror = res; a.play().catch(res); });
    r.classList.remove("on"); await new Promise(res => setTimeout(res, 350));
  }
}
document.getElementById("all").onclick = () => playRows(rows);
document.getElementById("onlyMarked").onclick = () => playRows(rows.filter(r => marks[r.dataset.name]));
document.getElementById("stop").onclick = () => { playing++; document.querySelectorAll("audio").forEach(a => a.pause()); rows.forEach(r => r.classList.remove("on")); };
document.getElementById("copyList").onclick = e => copy(rows.filter(r => marks[r.dataset.name])
  .map(r => r.querySelector(".n").textContent + ". " + r.querySelector(".t").textContent + " = " + r.dataset.name).join("\\n") || "(אין מסומנים)", e.target);
paint();
</script></body></html>
`;
  const file = path.join(ROOT, 'tools', 'review.html');
  fs.writeFileSync(file, html);
  fs.mkdirSync(path.join(ROOT, 'הקלטות להחלפה'), { recursive: true });
  console.log(`🎧 דף ההאזנה: ${n} הקלטות ב-${file}`);
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
