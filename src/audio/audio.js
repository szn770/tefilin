import { LINE_BY_ID } from '../data/lines.js';

// אפקטים מסונתזים + קולות מוקלטים (נוצרים עם ElevenLabs ע"י npm run voices).
// אם אין קבצי קול, המשחק עובד עם בועות טקסט בלבד.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.available = new Set();
    this.buffers = new Map();
    this.loops = [];
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.5;
    this.sfxBus.connect(this.master);
    this.voiceBus = this.ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voiceBus.connect(this.master);
    this.bgBus = this.ctx.createGain();
    this.bgBus.gain.value = 0.25;
    this.bgBus.connect(this.master);

    try {
      const res = await fetch('/audio/manifest.json', { cache: 'no-store' });
      if (res.ok) {
        const m = await res.json();
        for (const v of m.voices || []) this.available.add(`voice/${v}`);
        for (const s of m.sfx || []) this.available.add(`sfx/${s}`);
        for (const s of m.music || []) this.available.add(`music/${s}`);
      }
    } catch { /* אין הקלטות עדיין */ }
    // טעינה מוקדמת ברקע
    for (const key of this.available) this.load(key);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  async load(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const p = fetch(`/audio/${key}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((ab) => this.ctx.decodeAudioData(ab))
      .catch(() => null);
    this.buffers.set(key, p);
    return p;
  }

  // מנגן משפט. מחזיר את משך המשפט בשניות (או הערכה לפי אורך הטקסט כשאין הקלטה).
  async voice(id, voiceKey) {
    const line = LINE_BY_ID[id];
    const estimate = line ? Math.max(1.1, line.text.length * 0.07) : 1.2;
    if (!this.ctx) return estimate;
    const candidates = [`voice/${id}__${voiceKey}`, `voice/${id}`];
    const key = candidates.find((k) => this.available.has(k));
    if (!key) return estimate;
    const buf = await this.load(key);
    if (!buf) return estimate;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voiceBus);
    src.start();
    return buf.duration;
  }

  hasRecorded(name) { return this.available.has(name); }

  // מנגן הקלטה פעם אחת. כשאין הקלטה כזו (או שהיא לא נטענה) מנגנים את fallback
  play(key, fallback, gain = 1) {
    if (!this.available.has(key)) return fallback();
    this.load(key).then((buf) => {
      if (!buf) return fallback();
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(this.sfxBus);
      src.start();
    });
  }

  async loop(key, gain = 0.25) {
    if (!this.ctx || !this.available.has(key)) return;
    const buf = await this.load(key);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.bgBus);
    src.start();
    this.loops.push(src);
  }

  // ---- אפקטים מסונתזים ----
  tone(freq, dur, { type = 'sine', vol = 0.4, slide = null, delay = 0, attack = 0.005 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.3, from = 800, to = 3000, q = 1.2, delay = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
  }

  sfx(name, arg = 0) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'pop': this.tone(520, 0.1, { slide: 1100, vol: 0.35 }); break;
      case 'tap': this.tone(500 + arg * 120, 0.09, { type: 'square', vol: 0.12, slide: 700 + arg * 140 }); break;
      case 'call': this.tone(660, 0.1, { type: 'triangle', vol: 0.3 }); this.tone(990, 0.18, { type: 'triangle', vol: 0.3, delay: 0.08 }); break;
      case 'wrong': this.tone(300, 0.12, { type: 'square', vol: 0.12, slide: 200 }); this.tone(180, 0.3, { type: 'sawtooth', vol: 0.1, delay: 0.1, slide: 120 }); break;
      case 'click': this.tone(900, 0.05, { type: 'triangle', vol: 0.25 }); break;
      case 'word': this.tone(660 + arg * 45, 0.14, { type: 'triangle', vol: 0.3 }); break;
      case 'wrap': this.tone(380 + arg * 70, 0.18, { slide: 520 + arg * 90, vol: 0.32 }); this.noise(0.12, { vol: 0.08, from: 2000, to: 5000 }); break;
      case 'snap': this.noise(0.08, { vol: 0.35, from: 1500, to: 600, q: 3 }); this.tone(220, 0.08, { type: 'square', vol: 0.08 }); break;
      case 'whoosh': this.noise(0.35, { vol: 0.18, from: 400, to: 2400 }); break;
      case 'ding': this.tone(880, 0.6, { vol: 0.3 }); this.tone(1320, 0.5, { vol: 0.18, delay: 0.02 }); break;
      case 'coin': this.tone(988, 0.08, { type: 'square', vol: 0.12 }); this.tone(1319, 0.25, { type: 'square', vol: 0.12, delay: 0.08 }); break;
      case 'buzz': this.tone(150, 0.25, { type: 'sawtooth', vol: 0.12, slide: 110 }); break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.08 }));
        break;
      case 'fanfare':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.3, delay: i * 0.11 }));
        break;
      case 'sad': this.tone(392, 0.25, { type: 'triangle', vol: 0.25 }); this.tone(330, 0.4, { type: 'triangle', vol: 0.25, delay: 0.22 }); break;
      case 'tick': this.tone(1200, 0.03, { type: 'square', vol: 0.06 }); break;
      case 'heart': this.tone(520, 0.15, { type: 'triangle', vol: 0.3, slide: 260 }); this.tone(200, 0.4, { type: 'sawtooth', vol: 0.08, delay: 0.12, slide: 90 }); break;
      case 'pickup': this.tone(700, 0.08, { type: 'triangle', vol: 0.25, slide: 1400 }); break;
      case 'whistle': this.tone(2100, 0.12, { vol: 0.12 }); this.tone(2100, 0.35, { vol: 0.12, delay: 0.16, slide: 1800 }); break;
      case 'fine': [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.1, delay: i * 0.12 })); break;
      case 'flap': for (let i = 0; i < 4; i++) this.noise(0.06, { vol: 0.2, from: 900, to: 400, q: 2, delay: i * 0.07 }); break;
      case 'coo': this.tone(420, 0.25, { vol: 0.15, slide: 360 }); this.tone(380, 0.35, { vol: 0.15, delay: 0.28, slide: 320 }); break;
      case 'megaphone': // הרמקול של הטנק
        this.tone(620, 0.1, { type: 'square', vol: 0.09 });
        this.tone(830, 0.1, { type: 'square', vol: 0.09, delay: 0.11 });
        this.tone(1040, 0.22, { type: 'square', vol: 0.09, delay: 0.22, slide: 980 });
        break;
      case 'horn':this.tone(330, 0.3, { type: 'square', vol: 0.12 }); this.tone(415, 0.3, { type: 'square', vol: 0.12 }); this.tone(330, 0.4, { type: 'square', vol: 0.12, delay: 0.4 }); this.tone(415, 0.4, { type: 'square', vol: 0.12, delay: 0.4 }); break;
      case 'nigun':
        // public/audio/sfx/nigun.mp3 – באורך ההאטה (5 שניות). בלעדיו: ניגון קצר בסולם "אהבה רבה"
        this.play('sfx/nigun', () => {
          [294, 311, 370, 392, 440, 392, 370, 311, 294, 370, 440, 587].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', vol: 0.25, delay: i * 0.2 }));
        });
        break;
    }
  }
}
