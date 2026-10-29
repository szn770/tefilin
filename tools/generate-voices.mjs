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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LINES, VOICE_KEYS, TRAINING_LINE_IDS } from '../src/data/lines.js';

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

main().catch((e) => {
  console.error(`\n✖ ${e.message}`);
  process.exit(1);
});

async function main() {
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

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
