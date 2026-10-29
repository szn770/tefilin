import * as THREE from 'three';
import { buildTank, buildDecor } from '../world/props.js';
import { tween, ease } from '../engine/tween.js';

// דברים שקונים בחנות ופועלים תוך כדי משחק: ניגון, עלונים, טנק המבצעים, בחור ניקיון, קישוטים.

const NIGUN_TIME = 5; // שניות של האטה. הקטע public/audio/sfx/nigun.mp3 באותו אורך – משנים את שניהם יחד
const TANK_EVERY = [9, 6]; // לפי רמת הטנק (רמה 2: רמקול חזק)
const CLEAN_EVERY = 5;
const TANK_LINES = ['יהודי! בוא להניח תפילין!', 'רק דקה – מצווה גדולה!', 'תפילין ממש כאן, ליד הדוכן!', 'בוא, בוא! מחכים לך!'];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Perks {
  constructor(game) {
    this.g = game;
    this.tank = null;
    this.decor = [];
    this.nigunLeft = 0;
    this.nigunCooldown = 0;
    this.tankTimer = TANK_EVERY[0];
    this.cleanTimer = CLEAN_EVERY;
  }

  get u() { return this.g.upgrades; }
  nigunCooldownMax() { return this.u.speaker >= 2 ? 12 : 20; }
  tankEvery() { return TANK_EVERY[Math.max(0, this.u.tank - 1)] ?? TANK_EVERY[0]; }

  // בונים מחדש את מה שרואים (טנק, קישוטים) לפי השדרוגים
  apply() {
    if (this.u.tank && !this.tank) {
      this.tank = buildTank();
      this.g.scene.add(this.tank);
      tween(0.6, (k) => this.tank.scale.setScalar(Math.max(0.01, k)), ease.back);
    }
    for (const d of this.decor) this.g.scene.remove(d);
    this.decor = [];
    if (this.u.decor) {
      for (const b of this.g.booths.booths) {
        const d = buildDecor(this.u.decor);
        d.position.set(b.x, 0, -2.3);
        this.g.scene.add(d);
        this.decor.push(d);
      }
    }
  }

  // הטנק חונה ברחבה מאחורי הדוכנים, כדי לא להסתיר את המשחק
  placeTank() {
    if (this.tank) this.tank.position.set(-3.4, 0, -6.4);
  }

  reset() {
    this.nigunLeft = 0;
    this.nigunCooldown = 0;
    this.g.slowFactor = 1;
    this.tankTimer = this.tankEvery() / 2;
    this.cleanTimer = CLEAN_EVERY;
    this.placeTank();
  }

  // ---------- ניגון: כולם מאטים ----------
  useNigun() {
    if (!this.u.speaker || this.nigunCooldown > 0 || this.g.state !== 'day') return;
    this.nigunLeft = NIGUN_TIME;
    this.nigunCooldown = this.nigunCooldownMax();
    this.g.slowFactor = 0.4;
    this.g.audio.sfx('nigun');
    this.g.ui.banner('🎵 ניגון!', 'כולם עוצרים להקשיב...', 1.6);
  }

  // ---------- עלונים: מי שבמסך צריך רק לחיצה אחת ----------
  useFlyers() {
    if (this.u.flyers <= 0 || this.g.state !== 'day') return;
    const targets = this.g.peds.filter((p) => p.mode === 'walk' && !p.called && !p.penalized && !p.data.type.penalty && p.tapsLeft > 1);
    if (!targets.length) {
      this.g.ui.banner('📄 אין למי לחלק', 'חכו שיעברו אנשים ממהרים', 1.4);
      return;
    }
    this.u.flyers--;
    this.g.save();
    for (const p of targets) {
      p.tapsLeft = 1;
      p.tag?.set('1');
      this.g.ui.popupAt('📄', this.g.headTop(p, 0.9), 'good');
    }
    this.g.audio.sfx('whoosh');
  }

  // ---------- טנק המבצעים קורא למישהו: רואים ושומעים שזה בזכותו ----------
  tankCall(ped) {
    const g = this.g;
    const tank = this.tank;
    g.ui.bubble(TANK_LINES[Math.floor(Math.random() * TANK_LINES.length)],
      () => tank.position.clone().add(V(-0.4, 3.5, 0)), { cls: 'tank', duration: 2.2 });
    g.ui.beam(tank.position.clone().add(V(0.6, 3, 0.3)), g.headTop(ped, 0.2));
    g.audio.sfx('megaphone');
    tween(0.45, (k) => { tank.position.y = Math.sin(k * Math.PI) * 0.18; });
    g.callPed(ped, { auto: true });
    // תג קטן ליד הראש, עד שהוא מסיים להניח
    ped.byTank = true;
    ped.tankTag = g.ui.addTag(() => g.headTop(ped, 0.1).add(V(0.38, 0, 0)), 'tag-tank', '🚐');
  }

  // ---------- עדכון ----------
  update(dt) {
    const g = this.g;
    if (this.nigunLeft > 0) {
      this.nigunLeft -= dt;
      if (this.nigunLeft <= 0) g.slowFactor = 1;
    }
    if (this.nigunCooldown > 0) this.nigunCooldown = Math.max(0, this.nigunCooldown - dt);

    const active = g.state === 'day' && g.time < g.level.time;

    // בחור ניקיון: אוסף פריט לכלוך כל כמה שניות
    if (active && this.u.cleaner && g.hazards.trash.length) {
      this.cleanTimer -= dt;
      if (this.cleanTimer <= 0) {
        this.cleanTimer = CLEAN_EVERY;
        const t = g.hazards.trash[0];
        g.ui.popupAt('🧹', t.obj.position.clone().add(V(0, 0.4, 0)), 'good');
        g.hazards.pickUpTrash(t, false);
      }
    }

    // טנק המבצעים: קורא לבד לעובר ושב, בכל כמה שניות
    if (active && this.tank) {
      this.tankTimer -= dt;
      if (this.tankTimer <= 0) {
        this.tankTimer = this.tankEvery();
        const { left, right } = g.edges();
        const cand = g.peds.filter((p) => p.mode === 'walk' && !p.called && !p.penalized && !p.data.type.penalty
          && p.root.position.x > left + 1.5 && p.root.position.x < right - 1.5);
        if (cand.length && g.booths.canAccept() && !g.hazards.dirty) {
          const tx = this.tank.position.x;
          cand.sort((a, b) => Math.abs(a.root.position.x - tx) - Math.abs(b.root.position.x - tx));
          this.tankCall(cand[0]);
        }
      }
    }

    g.ui.setNigun(this.u.speaker > 0, 1 - this.nigunCooldown / this.nigunCooldownMax(), this.nigunLeft > 0);
    g.ui.setFlyers(this.u.flyers);
  }
}
