import * as THREE from 'three';
import { Person, MENDY_LOOK } from '../characters/person.js';
import { makePedData, randomTypeId } from '../data/customers.js';
import { LINE_BY_ID } from '../data/lines.js';
import { getLevel, starsFor } from '../data/levels.js';
import { Booths, MAX_BOOTHS, MAX_SPOTS_PER_BOOTH } from './booths.js';
import { Hazards } from './hazards.js';
import { Perks, MAX_FLYERS } from './perks.js';
import { wait } from '../engine/tween.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LANE_Z = [0.1, 1.9];
const SAVE_KEY = 'hanachta-save-v1';
const FLYER_PACK = 3;

// מחירי שדרוגים (לפי מספר הקניות)
const COSTS = {
  booths: [180, 320],
  pairs: [50, 90, 140, 190, 250, 320, 400],
  cake: [100],
  decor: [150, 300, 600],
  tank: [1500],
  training: [200, 400, 700],
  cleaner: [250],
  permit: [200],
  net: [200],
  sign: [150, 300, 450],
  speaker: [120, 300],
};
const FLYER_COST = 60;
const SERVE_SPEED = [1, 1.2, 1.45, 1.75]; // לפי רמת הכשרת השלוחים
// שלט: כל רמה מורידה לחיצות לסוג אחר של ממהרים
const SIGN_RELIEF = { rushed: 1, first: 2, runner: 3 };

const CAM_OFFSET = V(0, 2.15, 10.8); // מהמטרה אל המצלמה
const CAM_TARGET_Y = 1.35;
const CAM_TARGET_Z = -1.2;

class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = camera.position.clone();
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.speed = 3;
  }
  set(pos, target, speed = 3) {
    this.pos.copy(pos);
    this.target.copy(target);
    this.speed = speed;
  }
  snap() {
    this.camera.position.copy(this.pos);
    this.look.copy(this.target);
    this.camera.lookAt(this.look);
  }
  update(dt) {
    const k = 1 - Math.exp(-dt * this.speed);
    this.camera.position.lerp(this.pos, k);
    this.look.lerp(this.target, k);
    this.camera.lookAt(this.look);
  }
}

export class Game {
  constructor({ scene, camera, ui, audio, world, fx, canvas }) {
    Object.assign(this, { scene, camera, ui, audio, world, fx, canvas });
    this.rig = new CameraRig(camera);
    this.raycaster = new THREE.Raycaster();
    this.peds = [];
    this.state = 'menu';
    this.time = 0;
    this.slowFactor = 1;

    this.mendy = new Person(MENDY_LOOK, { isMendy: true });
    this.scene.add(this.mendy.root);
    this.booths = new Booths(this);
    this.hazards = new Hazards(this);
    this.perks = new Perks(this);

    this.load();
    this.applyUpgrades();
    this.frameCamera(true);
  }

  // ---------- שמירה ----------
  load() {
    let save = null;
    try { save = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* אין גישה לאחסון */ }
    this.hasSave = !!save && save.levelIndex > 0;
    this.levelIndex = save?.levelIndex ?? 0;
    this.stars = save?.stars ?? [];
    this.score = save?.score ?? 0;
    this.upgrades = {
      booths: 0, pairs: 0, cake: 0, decor: 0, tank: 0, training: 0, cleaner: 0, permit: 0, net: 0, sign: 0, speaker: 0, flyers: 0,
      ...(save?.upgrades ?? {}),
    };
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        levelIndex: this.levelIndex, stars: this.stars, score: this.score, upgrades: this.upgrades,
      }));
    } catch { /* לא נורא */ }
  }
  resetProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* לא נורא */ }
    location.href = `${location.pathname}?quick`; // מתחילים מיד משלב 1
  }

  // בונים את הדוכנים לפי השדרוגים שנקנו
  applyUpgrades() {
    const u = this.upgrades;
    while (this.booths.booths.length < 1 + u.booths) this.booths.addBooth();
    const extra = () => this.booths.booths.reduce((s, b) => s + b.spots.length - 2, 0);
    while (extra() < u.pairs) {
      const b = this.booths.booths.find((x) => x.spots.length < MAX_SPOTS_PER_BOOTH);
      if (!b) break;
      this.booths.addSpot(b);
    }
    if (u.cake) this.booths.unlockLounge();
    this.frameCamera();
    this.perks.apply();
    this.perks.placeTank();
  }

  // ---------- מצלמה: מתרחקת כשיש עוד דוכנים ----------
  frameCamera(snap = false) {
    const xs = this.booths.allSpots.map((s) => s.pos.x).concat(this.booths.booths.flatMap((b) => [b.x - 1.3, b.x + 1.3]));
    const min = Math.min(...xs), max = Math.max(...xs);
    const cx = (min + max) / 2;
    const half = (max - min) / 2 + 0.8;
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    const needDist = half / tanH + 2.6; // + המרחק מקו המקומות אל הנתיב
    const dist = Math.max(1, needDist / CAM_OFFSET.length()) * CAM_OFFSET.length();
    // במסך גבוה מסתכלים יותר מלמעלה, כדי שהמדרכה תמלא את המסך במקום הכביש
    const basePitch = Math.atan2(CAM_OFFSET.y, CAM_OFFSET.z);
    const pitch = Math.min(0.62, basePitch + Math.max(0, 1.3 - this.camera.aspect) * 0.7);
    const target = V(cx, CAM_TARGET_Y, CAM_TARGET_Z);
    const offset = V(0, Math.sin(pitch), Math.cos(pitch)).multiplyScalar(dist);
    this.rig.set(target.clone().add(offset), target, 2);
    if (snap) this.rig.snap();
  }

  // גבולות הרחוב שרואים על המסך – עוברים ושבים נכנסים ויוצאים ממש בקצה
  edges() {
    const dist = this.rig.pos.z - 1;
    const half = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    return { left: this.rig.target.x - half - 1.2, right: this.rig.target.x + half + 1.2 };
  }
  edgeX() { return this.edges().right; }

  // ---------- כיול ----------
  patienceTime() { return 12; }
  loungePatience() { return 30; }
  serveTime() { return 6 / SERVE_SPEED[this.upgrades.training]; }
  decorBonus() { return 1 + 0.05 * this.upgrades.decor; }
  spawnInterval() { return this.level.spawnBase + Math.random() * 0.9; }
  multiplier() { return Math.min(2.5, 1 + 0.5 * Math.floor(this.combo / 5)); }

  // ---------- שלב ----------
  async beginLevel(index) {
    this.levelIndex = index;
    this.level = getLevel(index);
    this.state = 'intro';
    this.ui.showHud(false);
    await this.ui.showIntro(this.level);
    this.startDay();
  }

  startDay() {
    const L = this.level;
    this.time = 0;
    this.served = 0;
    this.dayScore = 0;
    this.missed = 0;
    this.wrongs = 0;
    this.fines = 0;
    this.firsts = 0;
    this.combo = 0;
    this.hearts = L.hearts;
    this.ending = false;
    this.state = 'day';
    this.spawnTimer = 0.3;
    this.hazards.reset(L);
    this.perks.reset();
    this.ui.showHud(true);
    this.ui.setHearts(this.hearts, L.hearts);
    this.ui.setLevel(L.number, L.name);
    this.ui.setGoal(0, L.goal);
    this.ui.setScore(this.score);
    this.ui.setCombo(1);
    this.ui.setSun(0);
    this.world.setDayProgress(0);
    const { left, right } = this.edges();
    for (const f of [0.15, 0.4, 0.6, 0.85]) this.spawnPed(left + (right - left) * f);
    this.say(this.mendy, 'm_day', { block: false });
  }

  // "שם טוב": טעות או קנס מורידים לב. בלי לבבות – השלב נכשל מיד
  loseHeart() {
    if (this.ending) return;
    this.hearts = Math.max(0, this.hearts - 1);
    this.ui.setHearts(this.hearts, this.level.hearts);
    this.audio.sfx('heart');
    if (this.hearts === 0) this.finishDay({ failed: true });
  }

  async finishDay({ failed = false } = {}) {
    if (this.ending) return;
    this.ending = true;
    this.hazards.calmDown();
    if (failed) {
      this.state = 'failing';
      this.ui.banner('💔 השם הטוב של הדוכן נפגע', 'יותר מדי טעויות – השלב נגמר', 2.5);
      this.booths.clearAll();
      await wait(2.4);
    } else {
      this.ui.banner('השמש שקעה 🌅', 'מסיימים עם מי שכבר בדוכן');
      while (!this.booths.isEmpty) await wait(0.3);
      await wait(0.8);
    }
    this.state = 'results';
    this.ui.hideBanner();
    const L = this.level;
    const stars = failed ? 0 : starsFor(L, this.served);
    const passed = stars > 0;
    this.audio.sfx(passed ? 'fanfare' : 'sad');
    if (passed) {
      this.stars[L.index] = Math.max(this.stars[L.index] ?? 0, stars);
      this.levelIndex = L.index + 1;
    }
    this.save();

    const lines = [
      `📿 <b>${this.served}</b> הנחות תפילין (היעד: ${L.goal})`,
      `💛 <b>${this.dayScore}</b> נחת בשלב`,
    ];
    if (this.firsts) lines.push(`⭐ ${this.firsts} הניחו בפעם הראשונה!`);
    if (this.missed) lines.push(`🚶 ${this.missed} עברו בלי שקראת להם`);
    if (this.wrongs) lines.push(`🙅 ${this.wrongs} קריאות בטעות`);
    if (this.fines) lines.push(`📋 ${this.fines} קנסות`);
    if (failed) lines.unshift('💔 נגמרו הלבבות – זהירות עם קריאות בטעות ועם הפקח!');
    await this.ui.showResults({
      title: passed ? `שלב ${L.number} – הצלחה!` : failed ? 'אוי, נגמרו הלבבות' : 'כמעט! ננסה שוב?',
      stars,
      summary: lines.join('<br/>'),
      items: () => this.shopItems(),
      score: () => this.score,
      nextLabel: passed ? 'לשלב הבא ←' : 'נסה שוב 🔁',
    });
    this.save();
    for (const p of this.peds) {
      p.tag?.remove();
      this.scene.remove(p.root);
    }
    this.peds = [];
    this.ui.clearOverlays();
    this.beginLevel(passed ? L.index + 1 : L.index);
  }

  // חנות בשלוש קטגוריות: דוכן, צוות, הסברה. כל פריט: {cat, icon, title, desc, level, cost, can, maxed, buy()}
  shopItems() {
    const u = this.upgrades;
    const lvl = (key) => `רמה ${u[key]} מתוך ${COSTS[key].length}`;
    const owned = (key) => (u[key] ? 'יש ✓' : 'אין');
    const make = (cat, key, icon, title, desc, level, { blocked = null } = {}) => {
      const costs = COSTS[key];
      const maxed = u[key] >= costs.length;
      const cost = maxed ? 0 : costs[u[key]];
      const can = !maxed && !blocked && this.score >= cost;
      return {
        cat, icon, title, desc: blocked ?? desc, level, cost, maxed, can,
        buy: () => {
          if (!can) return;
          this.score -= cost;
          u[key]++;
          this.applyUpgrades();
          this.ui.setScore(this.score);
          this.audio.sfx('coin');
          this.save();
        },
      };
    };
    const spotsFull = this.booths.booths.every((b) => b.spots.length >= MAX_SPOTS_PER_BOOTH);
    const signNext = ['📱 הממהרים בטלפון', '⭐ הקרקפתא', '⏰ הממהרים מאוד'][u.sign] ?? '';
    const flyersFull = u.flyers >= MAX_FLYERS;
    const flyers = {
      cat: 'outreach', icon: '📄', title: `חומרי הסברה – ${FLYER_PACK} חבילות עלונים`,
      desc: 'כפתור במשחק: כל הממהרים במסך צריכים רק לחיצה אחת',
      level: `יש ${u.flyers}`, cost: FLYER_COST, maxed: flyersFull,
      can: !flyersFull && this.score >= FLYER_COST,
      buy: () => {
        if (flyersFull || this.score < FLYER_COST) return;
        this.score -= FLYER_COST;
        u.flyers = Math.min(MAX_FLYERS, u.flyers + FLYER_PACK);
        this.ui.setScore(this.score);
        this.audio.sfx('coin');
        this.save();
      },
    };
    return [
      // ---- דוכן ----
      make('stand', 'booths', '🏪', 'דוכן נוסף + שליח', 'עוד שליח שמניח במקביל, ועוד 2 מקומות', `דוכנים: ${this.booths.booths.length} מתוך ${MAX_BOOTHS}`),
      make('stand', 'pairs', '📿', 'זוג תפילין נוסף', 'עוד מקום עמידה בדוכן', `מקומות: ${this.booths.boothSpots.length}`,
        { blocked: spotsFull ? 'כל הדוכנים מלאים – קודם דוכן נוסף' : null }),
      make('stand', 'cake', '🍰', 'פינת עוגה ולחיים', 'עוד 3 מקומות לחכות ליד הדוכן – בסבלנות', owned('cake')),
      make('stand', 'decor', '🎈', 'קישוטים לדוכן', 'בלונים, דגלונים ואורות. כל רמה: +5% נחת', lvl('decor')),
      make('stand', 'tank', '🚐', 'טנק המבצעים', 'חונה ברחוב וקורא לאנשים לבד, כל 9 שניות', owned('tank')),
      // ---- צוות ----
      make('team', 'training', '🎓', 'הכשרת שלוחים', 'השלוחים מניחים מהר יותר', lvl('training')),
      make('team', 'cleaner', '🧹', 'בחור לניקיון', 'אוסף לכלוך לבד, כל 5 שניות', owned('cleaner')),
      make('team', 'permit', '📜', 'רישיון ממוסגר', 'לפקח מספיקה לחיצה אחת', owned('permit')),
      make('team', 'net', '🕸️', 'רשת נגד יונים', 'יונים מגיעות בחצי מהתדירות', owned('net')),
      // ---- הסברה ----
      make('outreach', 'sign', '🪧', 'שילוט גדול', signNext ? `לחיצה פחות ל${signNext}` : 'כל השלטים כבר תלויים', lvl('sign')),
      flyers,
      make('outreach', 'speaker', '🎵', 'רמקול ניגונים', u.speaker ? 'רמה 2: הכפתור נטען מהר יותר (12 שניות)' : 'כפתור במשחק שמאט את כולם ל-5 שניות', lvl('speaker')),
    ];
  }

  // ---------- עוברים ושבים ----------
  spawnPed(x = null) {
    const data = makePedData(randomTypeId(this.level));
    const p = new Person(data.look, { scale: data.scale });
    p.data = data;
    p.dir = Math.random() < 0.5 ? 1 : -1;
    p.laneZ = LANE_Z[0] + Math.random() * (LANE_Z[1] - LANE_Z[0]);
    p.speed = data.speed * this.level.speedMult;
    const taps = data.type.taps || 0;
    const relief = this.upgrades.sign >= (SIGN_RELIEF[data.typeId] ?? 99) ? (data.typeId === 'runner' ? 2 : 1) : 0;
    p.tapsLeft = taps > 1 ? Math.max(2, taps - relief) : taps;
    const { left, right } = this.edges();
    p.root.position.set(x ?? (p.dir > 0 ? left : right), 0, p.laneZ);
    p.faceYaw(p.dir > 0 ? Math.PI / 2 : -Math.PI / 2, true);
    p.setWalking(true, p.speed / 1.3);
    if (data.type.pose) p.setPose(data.type.pose);
    p.mode = 'walk';
    if (p.tapsLeft > 1) p.tag = this.ui.tapsTag(() => this.headTop(p), data.type.icon, p.tapsLeft);
    this.scene.add(p.root);
    this.peds.push(p);
    return p;
  }

  // אנשים שיורדים מהאוטובוס: יוצאים מהדלת, עולים למדרכה וממשיכים ללכת
  spawnFromBus(x) {
    const p = this.spawnPed(x);
    p.root.position.set(x, 0, 3.4);
    p.fromBus = true;
    this.walkTo(p, V(x + p.dir * 0.8, 0, p.laneZ), p.speed).then(() => {
      if (p.called || p.mode !== 'stop') return;
      p.fromBus = false;
      p.mode = 'walk';
      p.faceYaw(p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      p.setWalking(true, p.speed / 1.3);
    });
  }

  headTop(p, up = 0.5) { return p.worldPoint(p.head, V(0, up, 0)); }

  walkTo(p, target, speed = 2.4) {
    return new Promise((resolve) => {
      p.mode = 'goto';
      p.goal = target.clone();
      p.goalSpeed = speed;
      p.onArrive = resolve;
      p.setWalking(true, speed / 1.3);
    });
  }

  async leave(p) {
    await this.walkTo(p, V(p.root.position.x + p.dir * 1.2, 0, p.laneZ), 1.8);
    p.mode = 'walk';
    p.faceYaw(p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    p.setWalking(true, p.speed / 1.3);
  }

  // ---------- דיבור ונקודות ----------
  async say(person, id, { block = true, voice = null } = {}) {
    const line = LINE_BY_ID[id];
    if (!line) return;
    const voiceKey = voice ?? (person.data ? person.data.type.voice : 'mendy');
    const dur = await this.audio.voice(id, voiceKey);
    this.ui.bubble(line.text, () => this.headTop(person, 0.55), {
      cls: person.isMendy ? 'mendy' : '',
      duration: Math.max(1.4, dur + 0.5),
    });
    person.talk(Math.min(dur, 3));
    if (block) await wait(Math.max(0.8, dur));
  }

  // מנדי מדבר רק אם הוא לא באמצע משפט – שלא יהיה רעש
  mendySay(id, force = false) {
    if (!force && this.mendy.talkTimer > 0) return;
    this.say(this.mendy, id, { block: false });
  }

  addScore(n, worldPos) {
    this.score = Math.max(0, this.score + n);
    this.dayScore += n;
    this.ui.setScore(this.score);
    if (worldPos) this.ui.popupAt(`${n > 0 ? '+' : ''}${n} 💛`, worldPos, n > 0 ? 'good' : 'bad');
  }

  breakCombo() {
    this.combo = 0;
    this.ui.setCombo(1);
  }

  // ---------- לחיצה על עובר ושב ----------
  tapPed(ped) {
    const T = ped.data.type;
    if (ped.called || ped.penalized || this.time >= this.level.time) return;

    if (T.penalty) {
      // קריאה בטעות: עולה הרבה נקודות (יותר בכל שלב) ולב אחד
      ped.penalized = true;
      ped.tag?.remove();
      this.wrongs++;
      this.breakCombo();
      this.addScore(-this.level.penalty.wrong, this.headTop(ped, 0.9));
      this.audio.sfx('wrong');
      this.say(ped, T.line, { block: false });
      this.mendySay('m_oops');
      ped.speed *= 1.3;
      this.loseHeart();
      return;
    }

    if (ped.tapsLeft > 1) {
      ped.tapsLeft--;
      ped.tag.set(ped.tapsLeft);
      ped.speed *= 0.9;
      this.audio.sfx('tap', (T.taps || 1) - ped.tapsLeft);
      if (!ped.saidRush) {
        ped.saidRush = true;
        this.say(ped, T.tapLine, { block: false });
      }
      return;
    }

    if (this.hazards.dirty) {
      if (!ped.saidDirty) {
        ped.saidDirty = true;
        this.say(ped, 'c_dirty', { block: false });
      }
      this.ui.popupAt('🗑️ מלוכלך!', this.headTop(ped, 0.9), 'bad');
      this.audio.sfx('buzz');
      return;
    }

    if (!this.booths.canAccept()) {
      this.ui.popupAt('הדוכן מלא!', this.headTop(ped, 0.9), 'bad');
      this.ui.flashSeats();
      this.audio.sfx('buzz');
      this.mendySay('m_full');
      return;
    }

    this.callPed(ped);
  }

  // הצלחנו לקרוא לו! (גם טנק המבצעים קורא כך, בלי רצף)
  callPed(ped, { auto = false } = {}) {
    const T = ped.data.type;
    ped.called = true;
    ped.fromBus = false;
    ped.tapsLeft = 0;
    ped.tag?.remove();
    ped.tag = null;
    if (!auto) {
      this.combo++;
      this.ui.setCombo(this.multiplier());
    }
    ped.mult = auto ? 1 : this.multiplier();
    this.audio.sfx('call');
    // לא כולם מדברים כל הזמן – שלא יהיו יותר מדי בועות
    if (!auto && Math.random() < 0.5) this.mendySay(Math.random() < 0.5 ? 'm_call' : 'm_call2');
    else if (T.firstTime || Math.random() < 0.5) this.say(ped, T.callLine, { block: false });
    ped.setPose('normal');
    const spot = this.booths.reserve(ped);
    ped.spot = spot;
    this.walkTo(ped, spot.pos).then(() => this.booths.arrive(spot));
  }

  onServed(spot) {
    const ped = spot.ped;
    const shliach = spot.booth.shliach;
    const T = ped.data.type;
    const gain = Math.round(T.points * (ped.mult || 1) * this.decorBonus());
    this.booths.release(spot);
    this.served++;
    this.ui.setGoal(this.served, this.level.goal);
    this.addScore(gain, this.headTop(ped, 0.9));
    this.audio.sfx('success');
    if (T.firstTime) {
      // קרקפתא – פעם ראשונה בחיים!
      this.firsts++;
      this.fx.confetti(this.headTop(ped, 0.3), 90, 2.4);
      this.ui.popupAt('⭐ פעם ראשונה! ⭐', this.headTop(ped, 1.4), 'good big');
      this.say(shliach, 'm_first', { block: false });
      this.audio.sfx('fanfare');
    } else {
      this.fx.confetti(this.headTop(ped, 0.3), 30, 1.8);
      if (shliach.talkTimer <= 0 && Math.random() < 0.4) this.say(shliach, 'm_mazal', { block: false });
    }
    if (this.served === this.level.goal) {
      this.ui.banner('🏆 עמדת ביעד!', 'כל הנחה נוספת – עוד כוכב', 2.5);
      this.audio.sfx('fanfare');
    }
    // כוס הלחיים נשארת על הרצפה...
    if (Math.random() < 0.4) this.hazards.dropTrash(spot.pos.x);
    ped.setPose('cheer');
    ped.happy();
    if (Math.random() < 0.4) this.say(ped, 'c_thanks', { block: false });
    wait(0.9).then(() => {
      ped.setPose('normal');
      this.leave(ped);
    });
  }

  onGiveUp(spot) {
    const ped = spot.ped;
    this.booths.release(spot);
    ped.setPose('normal');
    this.breakCombo();
    this.addScore(-this.level.penalty.giveUp, this.headTop(ped, 0.9));
    this.audio.sfx('sad');
    this.say(ped, 'c_tired', { block: false });
    this.leave(ped);
  }

  // ---------- קלט ----------
  pickPed(p) {
    const candidates = this.peds.filter((x) => (x.mode === 'walk' || x.fromBus) && !x.called && !x.penalized);
    this.raycaster.setFromCamera(p.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(candidates.map((x) => x.hitbox), false)[0];
    if (hit) return hit.object.userData.person;
    // לחיצה קרובה מספיק – נחשבת (נוח לילדים ולמסך מגע)
    let best = null, bestD = 45;
    for (const c of candidates) {
      const s = this.ui.project(c.worldPoint(c.root, V(0, 1.1, 0)));
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  onDown(p) {
    this.audio.init();
    if (this.state !== 'day') return;
    const hz = this.hazards.pick(p);
    if (hz) return this.hazards.handle(hz);
    const ped = this.pickPed(p);
    if (ped) this.tapPed(ped);
  }
  onMove(p) {
    if (this.state === 'day') this.canvas.style.cursor = this.hazards.pick(p) || this.pickPed(p) ? 'pointer' : 'default';
  }
  onUp() {}

  // ---------- לולאה ----------
  update(dt) {
    if (this.state === 'day') {
      const L = this.level;
      this.time = Math.min(L.time, this.time + dt);
      const prog = this.time / L.time;
      this.world.setDayProgress(prog);
      this.ui.setSun(prog);
      if (this.time < L.time) {
        this.spawnTimer -= dt;
        const walking = this.peds.filter((x) => x.mode === 'walk').length;
        if (this.spawnTimer <= 0 && walking < 13) {
          this.spawnPed();
          this.spawnTimer = this.spawnInterval();
        }
      } else if (!this.ending) {
        this.finishDay();
      }
      this.booths.update(dt);
      this.hazards.update(dt);
      this.perks.update(dt);
      this.ui.setSeats(this.booths.busyCount, this.booths.totalSpots);
    }

    const { left, right } = this.edges();
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.mode === 'walk') {
        p.root.position.x += p.dir * p.speed * this.slowFactor * dt;
        const x = p.root.position.x;
        if ((p.dir > 0 && x > right + 0.5) || (p.dir < 0 && x < left - 0.5)) {
          if (!p.called && !p.penalized && !p.data.type.penalty && this.state === 'day') this.missed++;
          p.tag?.remove();
          this.scene.remove(p.root);
          this.peds.splice(i, 1);
          continue;
        }
      } else if (p.mode === 'goto') {
        const to = p.goal.clone().sub(p.root.position);
        to.y = 0;
        const dist = to.length();
        if (dist < 0.04) {
          p.mode = 'stop';
          p.setWalking(false);
          const cb = p.onArrive;
          p.onArrive = null;
          cb?.();
        } else {
          p.root.position.addScaledVector(to.normalize(), Math.min(dist, p.goalSpeed * dt));
          p.faceYaw(Math.atan2(to.x, to.z));
        }
      }
      p.update(dt);
    }

    this.mendy.update(dt);
    this.rig.update(dt);
  }
}
