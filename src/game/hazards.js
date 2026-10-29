import * as THREE from 'three';
import { Person } from '../characters/person.js';
import { INSPECTOR_LOOK } from '../data/customers.js';
import { buildTrash, buildPigeon, buildBus, buildBusStop } from '../world/props.js';
import { tween, ease, wait } from '../engine/tween.js';

// הפרעות שצריך לטפל בהן תוך כדי: לכלוך, פקח, יונים, אוטובוס.

export const DIRTY_AT = 4; // מכמה פריטי לכלוך אנשים לא רוצים לבוא
const CLOSED_SECONDS = 8; // אחרי קנס הדוכן נסגר לכמה שניות
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rand = (a, b) => a + Math.random() * (b - a);

export class Hazards {
  constructor(game) {
    this.g = game;
    this.trash = [];
    this.pigeons = [];
    this.inspector = null;
    this.busStop = null;
    this.time = 0;
  }

  get dirty() { return this.trash.length >= DIRTY_AT; }

  reset(level) {
    this.level = level;
    for (const t of this.trash) this.g.scene.remove(t.obj);
    this.trash = [];
    for (const p of this.pigeons) this.removePigeon(p);
    if (this.inspector) this.removeInspector();
    const r = level.hazardRate;
    this.timers = { trash: rand(6, 9) / r, inspector: rand(12, 16) / r, pigeon: rand(9, 13) / r, bus: rand(14, 18) / r };
    if (level.has('bus')) {
      // התחנה בקצה המסך, כדי שהאוטובוס לא יסתיר את הדוכנים
      this.doorX = this.g.edges().right - 2.8;
      if (!this.busStop) {
        this.busStop = buildBusStop(0);
        this.g.scene.add(this.busStop);
      }
      this.busStop.position.x = this.doorX - 0.9;
    }
    this.g.ui.setTrash(0, false);
  }

  // בשקיעה: היונים עפות והפקח הולך, כדי שהדוכן יוכל לסיים
  calmDown() {
    for (const p of [...this.pigeons]) this.shooPigeon(p, false);
    if (this.inspector && !this.inspector.done) this.inspectorLeave();
  }

  // ---------- לכלוך ----------
  dropTrash(nearX = null) {
    if (!this.level.has('trash')) return;
    const x = nearX !== null ? nearX + rand(-0.6, 0.6) : rand(-2.4, 3.4);
    const obj = buildTrash();
    obj.position.set(x, 0, rand(-0.85, -0.15));
    obj.scale.setScalar(0.01);
    this.g.scene.add(obj);
    tween(0.3, (k) => obj.scale.setScalar(Math.max(0.01, k)), ease.back);
    const wasDirty = this.dirty;
    this.trash.push({ obj });
    this.g.ui.setTrash(this.trash.length, this.dirty);
    if (this.dirty && !wasDirty) {
      this.g.ui.banner('🗑️ הדוכן מלוכלך!', 'אנשים לא רוצים לבוא – לחצו על הלכלוך כדי לנקות', 2.5);
    }
  }

  pickUpTrash(t, reward = true) {
    this.trash = this.trash.filter((x) => x !== t);
    this.g.audio.sfx('pickup');
    const obj = t.obj;
    const y0 = obj.position.y;
    tween(0.25, (k) => {
      obj.position.y = y0 + k * 0.5;
      obj.scale.setScalar(Math.max(0.01, 1 - k));
    }).then(() => this.g.scene.remove(obj));
    if (reward) this.g.addScore(1, obj.position.clone().add(V(0, 0.4, 0)));
    this.g.ui.setTrash(this.trash.length, this.dirty);
  }

  // ---------- פקח ----------
  exitX(dir) {
    const { left, right } = this.g.edges();
    return dir > 0 ? right + 1 : left - 1;
  }

  spawnInspector() {
    const p = new Person(INSPECTOR_LOOK);
    const dir = Math.random() < 0.5 ? 1 : -1;
    p.root.position.set(this.exitX(-dir), 0, 0.6);
    p.setWalking(true, 0.8);
    p.taps = this.g.upgrades.permit ? 1 : 2; // רישיון ממוסגר – מספיקה לחיצה אחת
    p.dir = dir;
    p.target = V(this.g.booths.booths[0].x, 0, -0.45);
    p.tag = this.g.ui.tapsTag(() => p.worldPoint(p.head, V(0, 0.5, 0)), '📋', p.taps);
    this.g.scene.add(p.root);
    this.inspector = p;
    this.g.audio.sfx('whistle');
  }

  tapInspector() {
    const p = this.inspector;
    if (!p || p.done) return;
    p.taps--;
    p.tag.set(p.taps);
    this.g.audio.sfx('tap', 2 - p.taps);
    if (p.taps > 0) return;
    // הרישיון הוצג
    this.g.mendySay('m_permit', true);
    this.g.ui.popupAt('📜 רישיון!', p.worldPoint(p.head, V(0, 0.8, 0)), 'good');
    this.g.say(p, 'i_ok', { block: false, voice: 'man2' });
    this.g.addScore(5, p.worldPoint(p.head, V(0, 1.1, 0)));
    this.inspectorLeave();
  }

  inspectorLeave() {
    const p = this.inspector;
    p.done = true;
    p.tag?.remove();
    p.tag = null;
    p.target = V(this.exitX(p.dir), 0, 0.6);
    p.leaving = true;
  }

  removeInspector() {
    const p = this.inspector;
    p.tag?.remove();
    this.g.scene.remove(p.root);
    this.inspector = null;
  }

  updateInspector(dt) {
    const p = this.inspector;
    p.update(dt);
    const to = p.target.clone().sub(p.root.position);
    to.y = 0;
    const d = to.length();
    if (d < 0.05) {
      if (p.leaving) return this.removeInspector();
      if (p.done) return; // כבר נתן קנס, עומד רגע לפני שהוא הולך
      // הגיע לדוכן בלי שהראו לו רישיון – קנס, הדוכן נסגר לכמה שניות, והשם הטוב נפגע
      p.setWalking(false);
      p.faceYaw(Math.PI);
      this.g.say(p, 'i_fine', { block: false, voice: 'man2' });
      this.g.addScore(-this.level.penalty.fine, p.worldPoint(p.head, V(0, 0.9, 0)));
      this.g.audio.sfx('fine');
      this.g.breakCombo();
      this.g.fines++;
      this.g.booths.closeBooth(this.g.booths.booths[0], CLOSED_SECONDS);
      this.g.ui.banner('📋 קנס!', `הדוכן סגור ל-${CLOSED_SECONDS} שניות`, 2.2);
      this.g.loseHeart();
      p.done = true;
      p.tag?.remove();
      p.tag = null;
      wait(1.4).then(() => {
        if (this.inspector !== p) return;
        p.setWalking(true, 0.8);
        p.target = V(this.exitX(p.dir), 0, 0.6);
        p.leaving = true;
      });
      return;
    }
    if (!p.walking && !p.leaving) return;
    if (!p.walking) p.setWalking(true, 0.8);
    p.root.position.addScaledVector(to.normalize(), Math.min(d, 0.95 * dt * (p.leaving ? 1.4 : 1)));
    p.faceYaw(Math.atan2(to.x, to.z));
  }

  // ---------- יונים ----------
  spawnPigeon() {
    const free = this.g.booths.booths.filter((b) => !b.pigeon);
    if (!free.length) return;
    const booth = free[Math.floor(Math.random() * free.length)];
    const obj = buildPigeon();
    const land = V(booth.x + rand(-0.7, 0.4), 0.92, -2.2 + rand(-0.15, 0.25));
    const from = V(booth.x + (Math.random() < 0.5 ? -5 : 5), 6, -1);
    obj.position.copy(from);
    obj.lookAt(land.x, from.y, land.z);
    this.g.scene.add(obj);
    const p = { obj, booth, landed: false, t: Math.random() * 10 };
    this.pigeons.push(p);
    booth.pigeon = p; // השולחן "תפוס" כבר כשהיא בדרך
    this.g.audio.sfx('flap');
    tween(1.3, (k) => {
      obj.position.lerpVectors(from, land, k);
      obj.position.y += Math.sin(k * Math.PI) * 0.8;
    }, ease.inOut).then(() => {
      if (!this.pigeons.includes(p)) return;
      p.landed = true;
      obj.rotation.set(0, rand(-0.6, 0.6), 0);
      p.tag = this.g.ui.tapsTag(() => obj.position.clone().add(V(0, 0.45, 0)), '🐦', '!');
      this.g.audio.sfx('coo');
    });
  }

  shooPigeon(p, reward = true) {
    if (!this.pigeons.includes(p)) return;
    this.pigeons = this.pigeons.filter((x) => x !== p);
    p.booth.pigeon = null;
    p.tag?.remove();
    this.g.audio.sfx('flap');
    if (reward) {
      this.g.addScore(3, p.obj.position.clone().add(V(0, 0.5, 0)));
      this.g.mendySay('m_shoo');
    }
    const from = p.obj.position.clone();
    const to = from.clone().add(V(rand(-5, 5), 7, -3));
    tween(1, (k) => p.obj.position.lerpVectors(from, to, k), ease.inOut).then(() => this.g.scene.remove(p.obj));
    p.flying = true;
  }

  removePigeon(p) {
    p.booth.pigeon = null;
    p.tag?.remove();
    this.g.scene.remove(p.obj);
    this.pigeons = this.pigeons.filter((x) => x !== p);
  }

  // ---------- אוטובוס ----------
  async spawnBus() {
    const bus = buildBus();
    const doorX = this.doorX;
    const stopX = doorX + 2.2; // הדלת בחלק הקדמי של האוטובוס
    const fromX = stopX + 14;
    bus.position.set(fromX, 0, 4.9);
    this.g.scene.add(bus);
    this.g.audio.sfx('horn');
    this.g.ui.banner('🚌 אוטובוס!', 'הרבה אנשים יורדים בבת אחת', 2);
    await tween(2.2, (k) => { bus.position.x = THREE.MathUtils.lerp(fromX, stopX, k); }, ease.out);
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      if (this.g.state !== 'day') break;
      this.g.spawnFromBus(doorX + rand(-0.3, 0.3));
      await wait(0.35);
    }
    await wait(1.2);
    await tween(1.6, (k) => { bus.position.x = THREE.MathUtils.lerp(stopX, stopX - 40, k); }, (t) => t * t);
    this.g.scene.remove(bus);
  }

  // ---------- בחירה בלחיצה ----------
  pick(p) {
    const near = (world, max) => {
      const s = this.g.ui.project(world);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      return d < max ? d : Infinity;
    };
    let best = null, bestD = Infinity;
    for (const pg of this.pigeons) {
      if (!pg.landed || pg.flying) continue;
      const d = near(pg.obj.position.clone().add(V(0, 0.15, 0)), 55);
      if (d < bestD) { bestD = d; best = { kind: 'pigeon', obj: pg }; }
    }
    for (const t of this.trash) {
      const d = near(t.obj.position, 42);
      if (d < bestD) { bestD = d; best = { kind: 'trash', obj: t }; }
    }
    const ins = this.inspector;
    if (ins && !ins.done) {
      const d = Math.min(near(ins.worldPoint(ins.root, V(0, 1.1, 0)), 60), near(ins.worldPoint(ins.head, V(0, 0, 0)), 45));
      if (d < bestD) { bestD = d; best = { kind: 'inspector', obj: ins }; }
    }
    return best;
  }

  handle(hit) {
    if (hit.kind === 'trash') this.pickUpTrash(hit.obj);
    else if (hit.kind === 'pigeon') this.shooPigeon(hit.obj);
    else if (hit.kind === 'inspector') this.tapInspector();
  }

  // ---------- עדכון ----------
  update(dt) {
    this.time += dt;
    const L = this.level;
    const active = this.g.state === 'day' && this.g.time < L.time;
    const r = L.hazardRate;

    if (active) {
      for (const k of Object.keys(this.timers)) this.timers[k] -= dt;
      if (L.has('trash') && this.timers.trash <= 0) {
        this.dropTrash();
        // פח אשפה ליד הדוכן – פחות לכלוך
        this.timers.trash = (rand(7, 11) / r) * (this.g.upgrades.bin ? 1.6 : 1);
      }
      if (L.has('inspector') && this.timers.inspector <= 0) {
        if (!this.inspector) this.spawnInspector();
        this.timers.inspector = rand(26, 36) / r;
      }
      if (L.has('pigeon') && this.timers.pigeon <= 0) {
        this.spawnPigeon();
        // רשת נגד יונים – באות בחצי מהתדירות
        this.timers.pigeon = (rand(13, 20) / r) * (this.g.upgrades.net ? 2 : 1);
      }
      if (L.has('bus') && this.timers.bus <= 0) {
        this.spawnBus();
        this.timers.bus = rand(24, 32) / r;
      }
    }

    if (this.inspector) this.updateInspector(dt);

    for (const p of this.pigeons) {
      p.t += dt;
      const flap = p.landed && !p.flying ? Math.sin(p.t * 3) * 0.1 : Math.sin(p.t * 30) * 0.9;
      p.obj.userData.wingL.rotation.z = flap;
      p.obj.userData.wingR.rotation.z = -flap;
      if (p.landed && !p.flying) p.obj.rotation.x = Math.max(0, Math.sin(p.t * 5)) * 0.35; // מנקרת
    }
  }
}
