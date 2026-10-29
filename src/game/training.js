import * as THREE from 'three';
import { Person } from '../characters/person.js';
import { makePedData } from '../data/customers.js';
import { tween, wait, ease } from '../engine/tween.js';
import { createShelYad, createShelRosh, Wrap, createHeadStraps, createTarget, strapMesh } from '../world/tefillin.js';

// הדרכה: מניחים תפילין לאדם אחד, צעד אחר צעד – בלי שעון ובלי לחץ.
// נכנסים אליה מכפתור במסך הפתיחה. כל שלב מוסבר בכותרת, וטעות רק מסבירה מה נכון.

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const tmpV = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const SPOT = V(1.2, 0, -1.9); // איפה שהמתלמד עומד, מימין לשולחן של מנדי
const STEPS = 9;
const BRACHA_WORDS = ['ברוך', 'אתה', 'ה׳', 'אלוקינו', 'מלך', 'העולם', 'אשר', 'קדשנו', 'במצוותיו', 'וציוונו', 'להניח', 'תפילין'];
const SHEMA_WORDS = ['שמע', 'ישראל', 'ה׳', 'אלוקינו', 'ה׳', 'אחד'];
const TREATS = [
  { label: 'עוגה 🍰', emoji: '🍰' },
  { label: 'מיץ ענבים 🍇', emoji: '🍇' },
  { label: 'סוכריה 🍬', emoji: '🍬' },
];

export class Training {
  constructor(game) {
    this.g = game;
    this.targets = [];
    this.bobbers = [];
    this.ring = null;
    this.c = null;
  }

  get ui() { return this.g.ui; }
  get audio() { return this.g.audio; }

  // לומדים שוב ושוב, עד שחוזרים למסך הפתיחה
  async start() {
    const g = this.g;
    g.state = 'training';
    g.training = this;
    g.audio.voicesOn = true; // בהדרכה מנדי והמתלמד מדברים בקול
    g.ui.showHud(false);
    g.world.setDayProgress(0.1);
    const exit = document.getElementById('btn-learn-exit');
    exit.classList.remove('hidden');
    exit.onclick = () => { location.href = location.pathname; };
    for (;;) {
      const { stars, text } = await this.lesson();
      if (await g.ui.showLearned(stars, text) === 'home') {
        location.href = location.pathname;
        return;
      }
    }
  }

  async lesson() {
    const g = this.g;
    this.mistakes = 0;
    const data = makePedData('regular');
    data.lefty = Math.random() < 0.35; // שיהיה גם שמאלי מדי פעם
    const c = new Person(data.look, { scale: data.scale });
    Object.assign(c, { data, dir: 1, laneZ: 1, speed: 1.3 });
    c.root.position.set(SPOT.x + 5, 0, 0.9);
    g.scene.add(c.root);
    g.peds.push(c);
    this.c = c;
    this.side = data.lefty ? -1 : 1; // היד החלשה: ימני ← שמאל (+1)
    this.K = this.side > 0 ? 'L' : 'R';

    this.shotStand();
    g.mendy.faceTowards(SPOT.x, SPOT.z);
    await g.walkTo(c, SPOT, 2.2);
    c.faceYaw(-0.7);
    await g.say(g.mendy, 'm_learn');
    c.showAccessories(false);

    await this.stepChooseArm();
    await this.stepPlaceYad();
    await this.stepBracha();
    await this.stepWrap();
    await this.stepRosh();
    await this.stepFinger();
    await this.stepShema();
    await this.stepRemove();
    await this.stepLechaim();
    return this.finish();
  }

  update(dt) {
    for (const t of this.targets) {
      t.obj.position.copy(t.posFn());
      t.obj.userData.update(dt, this.g.camera);
    }
    for (const b of this.bobbers) {
      if (!b.active) continue;
      b.t += dt;
      b.obj.position.y = b.home.y + Math.sin(b.t * 4) * 0.012;
      b.obj.rotation.y = Math.sin(b.t * 2) * 0.25;
    }
    if (this.ring) {
      const p = this.ui.project(this.ring.centerFn());
      this.ui.moveRing(p.x, p.y);
    }
  }

  // ---------- כלים ----------
  step(n, title, hint) { this.ui.banner(`${n}/${STEPS} · ${title}`, hint); }

  fwd() { return V(0, 0, 1).applyQuaternion(this.c.root.quaternion); }
  left() { return V(1, 0, 0).applyQuaternion(this.c.root.quaternion); }
  wp(obj, local) { return this.c.worldPoint(obj, local); }

  shot(target, pos, speed = 3.2) { this.g.rig.set(pos, target, speed); }
  shotStand() { this.shot(V(0.4, 1.25, -2.4), V(0.7, 2.3, 2.9), 2.2); }
  shotUpper() {
    const t = this.wp(this.c.root, V(0, 1.58, 0));
    this.shot(t, t.clone().addScaledVector(this.fwd(), 2.4).add(V(0, 0.25, 0)));
  }
  shotArm() {
    const t = this.wp(this.c.joints['elbow' + this.K], V(0, -0.02, 0.02));
    this.shot(t, t.clone().addScaledVector(this.fwd(), 1.55).addScaledVector(this.left(), this.side * 0.25).add(V(0, 0.18, 0)));
  }
  shotHead() {
    const t = this.wp(this.c.head, V(0, 0.12, 0.08));
    this.shot(t, t.clone().addScaledVector(this.fwd(), 1.1).add(V(0, 0.5, 0)));
  }
  shotHand() {
    const t = this.wp(this.c.joints['elbow' + this.K], V(0, -0.3, 0));
    this.shot(t, t.clone().addScaledVector(this.fwd(), 0.8).addScaledVector(this.left(), this.side * 0.25).add(V(0, 0.22, 0)));
  }

  addTarget(posFn, radius = 0.06) {
    const obj = createTarget(radius);
    obj.position.copy(posFn());
    this.g.scene.add(obj);
    const t = { obj, posFn };
    this.targets.push(t);
    return t;
  }
  removeTarget(t) {
    this.g.scene.remove(t.obj);
    this.targets = this.targets.filter((x) => x !== t);
  }

  mistake(text) {
    this.mistakes++;
    this.audio.sfx('buzz');
    this.ui.popupCenter(text, 'bad');
  }
  good(text) {
    this.audio.sfx('ding');
    this.ui.popupCenter(text, 'good');
  }

  // בחירה בין כמה נקודות על הדמות – הלחיצה הקרובה ביותר על המסך
  pickNearest(options, maxPx = 170) {
    return new Promise((resolve) => {
      this.g.input = {
        down: (p) => {
          let best = null, bestD = Infinity;
          for (const o of options) {
            const d = dist2d(this.ui.project(o.posFn()), p);
            if (d < bestD) { bestD = d; best = o; }
          }
          if (best && bestD < maxPx) {
            this.g.input = null;
            resolve(best);
          }
        },
      };
    });
  }

  // גרירת חפץ אל נקודת מטרה. judge(pos, px) מחזיר 'ok', 'miss' או הסבר לטעות
  dragDrop(obj, targetFn, { tolerance = 75, offsetX = 0.3, offsetY = -0.12, judge = null } = {}) {
    const cam = this.g.camera;
    const marker = this.addTarget(targetFn, 0.055);
    const right = V(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = V(0, 1, 0).applyQuaternion(cam.quaternion);
    const home = targetFn().addScaledVector(right, offsetX).addScaledVector(up, offsetY);
    obj.position.copy(home);
    this.g.scene.add(obj);
    const bob = { obj, home: home.clone(), t: 0, active: true };
    this.bobbers.push(bob);
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    let dragging = false;
    obj.scale.setScalar(0.01);
    tween(0.35, (k) => obj.scale.setScalar(Math.max(0.01, k)), ease.back);

    return new Promise((resolve) => {
      this.g.input = {
        down: (p) => {
          if (dist2d(this.ui.project(obj.getWorldPosition(tmpV)), p) > 120) return;
          dragging = true;
          bob.active = false;
          this.audio.sfx('pop');
          this.g.input.move(p);
        },
        move: (p) => {
          if (!dragging) return;
          raycaster.setFromCamera(p.ndc, cam);
          plane.setFromNormalAndCoplanarPoint(cam.getWorldDirection(tmpV).negate(), targetFn());
          if (raycaster.ray.intersectPlane(plane, hit)) obj.position.copy(hit);
        },
        up: () => {
          if (!dragging) return;
          dragging = false;
          const d = dist2d(this.ui.project(obj.position), this.ui.project(targetFn()));
          const verdict = judge ? judge(obj.position.clone(), d) : d < tolerance ? 'ok' : 'miss';
          if (verdict === 'ok') {
            this.g.input = null;
            this.removeTarget(marker);
            this.bobbers = this.bobbers.filter((x) => x !== bob);
            resolve();
            return;
          }
          if (verdict !== 'miss') this.mistake(verdict);
          const from = obj.position.clone();
          tween(0.3, (k) => obj.position.lerpVectors(from, bob.home, k)).then(() => { bob.active = true; });
        },
      };
    });
  }

  // תנועה סיבובית סביב נקודה על המסך (כריכות)
  circleGesture({ centerFn, turns, onProgress, onTurn }) {
    const total = turns * Math.PI * 2;
    let acc = 0;
    let prev = null;
    let done = 0;
    this.ring = { centerFn };
    const c0 = this.ui.project(centerFn());
    this.ui.showRing(c0.x, c0.y, 0, turns);

    return new Promise((resolve) => {
      const angleOf = (p) => {
        const c = this.ui.project(centerFn());
        const dx = p.x - c.x, dy = p.y - c.y;
        return { a: Math.atan2(dy, dx), r: Math.hypot(dx, dy) };
      };
      this.g.input = {
        down: (p) => { prev = angleOf(p); },
        move: (p) => {
          if (!prev) return;
          const cur = angleOf(p);
          if (cur.r < 22) return;
          let d = cur.a - prev.a;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          prev = cur;
          if (Math.abs(d) > 1.4) return;
          acc = Math.min(total, acc + Math.abs(d));
          onProgress(acc / total);
          const count = Math.floor(acc / (Math.PI * 2) + 1e-6);
          this.ui.setRing((acc % (Math.PI * 2)) / (Math.PI * 2), count, turns);
          if (count > done) {
            done = count;
            onTurn(count);
          }
          if (acc >= total - 1e-6) {
            this.g.input = null;
            this.ring = null;
            this.ui.setRing(1, turns, turns);
            setTimeout(() => this.ui.hideRing(), 250);
            resolve();
          }
        },
        up: () => { prev = null; },
      };
    });
  }

  attachTo(parent, obj, localPos, normal, duration = 0.22) {
    parent.attach(obj);
    const fromP = obj.position.clone();
    const fromQ = obj.quaternion.clone();
    const toQ = new THREE.Quaternion().setFromUnitVectors(UP, normal);
    const s0 = obj.scale.x;
    const s1 = 1 / this.c.root.scale.x; // ביטול קנה המידה של הדמות
    return tween(duration, (k) => {
      obj.position.lerpVectors(fromP, localPos, k);
      obj.quaternion.slerpQuaternions(fromQ, toQ, k);
      obj.scale.setScalar(THREE.MathUtils.lerp(s0, s1, k));
    });
  }

  flyAway(obj) {
    this.g.scene.attach(obj);
    const from = obj.position.clone();
    const s = obj.scale.x;
    return tween(0.45, (k) => {
      obj.position.set(from.x, from.y + k * 0.5, from.z);
      obj.scale.setScalar(Math.max(0.001, s * (1 - k)));
    }, ease.inOut).then(() => obj.removeFromParent());
  }

  // ---------- השלבים ----------
  async stepChooseArm() {
    const { c } = this;
    this.step(1, 'על איזו יד מניחים?', 'על היד החלשה – לא היד שכותבים איתה ✍️');
    this.shotUpper();
    await this.g.say(c, this.c.data.lefty ? 'c_lefty' : 'c_righty');
    const opts = [1, -1].map((s) => {
      const k = s > 0 ? 'L' : 'R';
      const posFn = () => this.wp(c[`upper${k}`], V(0, 0, 0.08));
      return { side: s, posFn, target: this.addTarget(posFn, 0.07) };
    });
    for (;;) {
      const pick = await this.pickNearest(opts);
      if (pick.side === this.side) break;
      this.mistake(this.c.data.lefty ? 'הוא שמאלי – אז על יד ימין!' : 'אופס! על היד החלשה – שמאל 💪');
    }
    opts.forEach((o) => this.removeTarget(o.target));
    this.good('נכון! 👍');
  }

  async stepPlaceYad() {
    const { c } = this;
    c.setPose('armOut', this.side);
    c.rollSleeve(this.side, true);
    this.step(2, 'מניחים את של יד', 'גררו את התפילין אל השריר של הזרוע – מול הלב');
    await wait(0.5);
    this.shotArm();
    await wait(0.45);
    const shoulder = c.joints['arm' + this.K];
    const n = V(-this.side * 0.55, 0, 0.83).normalize();
    const local = V(n.x * 0.077, -0.14, n.z * 0.077);
    const box = createShelYad();
    await this.dragDrop(box, () => this.wp(shoulder, local), { offsetX: 0.4, offsetY: 0.02 });
    await this.attachTo(shoulder, box, local, n);
    this.audio.sfx('snap');
    this.yad = box;
    this.yadStrap = strapMesh([
      local.clone().addScaledVector(n, 0.012).add(V(0, -0.05, 0)),
      V(n.x * 0.06, -0.24, 0.07),
      V(0, -0.33, 0.075),
    ]);
    shoulder.add(this.yadStrap);
    this.good('מושלם! 📿');
  }

  async stepBracha() {
    const { c } = this;
    this.step(3, 'הברכה', 'הקישו על המילים לפי הסדר');
    this.shotUpper();
    await this.g.say(this.g.mendy, 'm_repeat');
    this.audio.voice('m_bracha', 'mendy');
    await this.ui.karaoke(BRACHA_WORDS, (i, ok) => {
      if (ok) { this.audio.sfx('word', i); c.talk(0.35); } else this.audio.sfx('tick');
    });
    this.good('אמן! 🙌');
  }

  async stepWrap() {
    const { c } = this;
    this.step(4, 'שבע כריכות', 'סובבו את האצבע סביב הזרוע – 7 פעמים!');
    this.g.say(this.g.mendy, 'm_wrap', { block: false });
    this.shotArm();
    await wait(0.4);
    const elbow = c.joints['elbow' + this.K];
    this.armWrap = new Wrap(elbow, { yStart: -0.05, yEnd: -0.26, radius: 0.084, turns: 7, lead: [V(0, 0.0, 0.08)] });
    await this.circleGesture({
      centerFn: () => this.wp(elbow, V(0, -0.16, 0)),
      turns: 7,
      onProgress: (f) => this.armWrap.set(f),
      onTurn: (i) => {
        this.audio.sfx('wrap', i);
        const p = this.ui.project(this.wp(elbow, V(0, -0.16, 0)));
        this.ui.popup(`${i}`, p.x, p.y - 120, 'good');
      },
    });
    this.good('שבע! 💪');
  }

  async stepRosh() {
    const { c } = this;
    this.step(5, 'של ראש', 'גררו את התפילין מעל קו השיער, באמצע');
    this.g.say(this.g.mendy, 'm_rosh', { block: false });
    if (c.hatParts?.length) {
      c.hatParts.forEach((h) => (h.visible = false));
      this.ui.popupCenter('מורידים כובע 🧢', 'good');
      this.audio.sfx('whoosh');
    }
    this.shotHead();
    await wait(0.55);
    const head = c.head;
    const n = V(0, 0.7, 0.714).normalize();
    const local = n.clone().multiplyScalar(0.292);
    const box = createShelRosh();
    await this.dragDrop(box, () => this.wp(head, local), {
      offsetX: 0.32,
      offsetY: -0.05,
      judge: (pos, d) => {
        if (d < 70) return 'ok';
        if (d < 200 && head.worldToLocal(pos.clone()).y < local.y - 0.07) return 'נמוך מדי! מעל קו השיער ☝️';
        return 'miss';
      },
    });
    await this.attachTo(head, box, local, n);
    this.audio.sfx('snap');
    this.rosh = box;
    this.headStraps = createHeadStraps(0.27);
    head.add(this.headStraps);
    this.good('בול באמצע! 🎯');
  }

  async stepFinger() {
    const { c } = this;
    this.step(6, 'כריכות על האצבע', 'סובבו 3 פעמים סביב האצבע');
    this.g.say(this.g.mendy, 'm_finger', { block: false });
    this.shotHand();
    await wait(0.45);
    const elbow = c.joints['elbow' + this.K];
    this.fingerWrap = new Wrap(elbow, { yStart: -0.29, yEnd: -0.37, radius: 0.09, turns: 3, lead: [V(0.084, -0.26, 0)] });
    await this.circleGesture({
      centerFn: () => this.wp(elbow, V(0, -0.32, 0)),
      turns: 3,
      onProgress: (f) => this.fingerWrap.set(f),
      onTurn: (i) => this.audio.sfx('wrap', i + 3),
    });
    this.good('כל הכבוד! ✋');
  }

  async stepShema() {
    const { c } = this;
    c.setPose('shema', this.side);
    this.step(7, 'שמע ישראל', 'מכסים את העיניים – הקישו על המילים');
    this.shotUpper();
    await this.g.say(this.g.mendy, 'm_shema');
    this.audio.voice('m_shema_text', 'mendy');
    await this.ui.karaoke(SHEMA_WORDS, (i, ok) => {
      if (ok) { this.audio.sfx('word', i + 2); c.talk(0.35); } else this.audio.sfx('tick');
    });
    c.setPose('armOut', this.side);
    this.good('שמע ישראל! 💙');
  }

  async stepRemove() {
    const { c } = this;
    this.step(8, 'חולצים בסדר הפוך', 'מה מורידים קודם?');
    this.g.say(this.g.mendy, 'm_remove', { block: false });
    this.shotUpper();
    await wait(0.4);
    const roshOpt = { id: 'rosh', posFn: () => this.rosh.getWorldPosition(new THREE.Vector3()) };
    const yadOpt = { id: 'yad', posFn: () => this.yad.getWorldPosition(new THREE.Vector3()) };
    roshOpt.target = this.addTarget(roshOpt.posFn, 0.06);
    yadOpt.target = this.addTarget(yadOpt.posFn, 0.06);
    for (;;) {
      const pick = await this.pickNearest([roshOpt, yadOpt]);
      if (pick.id === 'rosh') break;
      this.mistake('קודם של ראש! 🙂');
    }
    this.removeTarget(roshOpt.target);
    this.audio.sfx('whoosh');
    const fw = this.fingerWrap;
    await tween(0.35, (k) => fw.set(1 - k));
    fw.dispose();
    this.headStraps.removeFromParent();
    await this.flyAway(this.rosh);

    await this.pickNearest([yadOpt]);
    this.removeTarget(yadOpt.target);
    this.audio.sfx('whoosh');
    const aw = this.armWrap;
    await tween(0.5, (k) => aw.set(1 - k));
    aw.dispose();
    this.yadStrap.removeFromParent();
    await this.flyAway(this.yad);

    c.rollSleeve(this.side, false);
    c.setPose('normal');
    c.hatParts?.forEach((h) => (h.visible = true));
    c.showAccessories(true);
    this.good('נשיקה לתפילין 😘');
  }

  async stepLechaim() {
    const { c } = this;
    const g = this.g;
    this.step(9, 'לחיים!', 'מה מגישים?');
    this.shotStand();
    await g.say(g.mendy, 'm_lechaim');
    const treat = await this.ui.choices(TREATS);
    g.mendy.setPose('offer');
    this.audio.sfx('coin');
    this.ui.popupAt(treat.emoji, this.wp(c.head, V(0, 0.45, 0)), 'good big');
    c.happy();
    await wait(0.8);
    g.mendy.setPose('normal');
  }

  async finish() {
    const { c } = this;
    const g = this.g;
    this.ui.hideBanner();
    const stars = this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1;
    g.fx.confetti(this.wp(c.head, V(0, 0.3, 0)), 70);
    this.audio.sfx('success');
    c.setPose('cheer');
    await g.say(c, 'c_thanks');
    c.setPose('normal');
    await g.say(g.mendy, 'm_mazal');
    for (const t of [...this.targets]) this.removeTarget(t);
    g.leave(c); // הולך לדרכו, ונעלם בקצה הרחוב
    await wait(0.6);
    const text = [
      'עזרת ליהודי להניח תפילין – מצווה גדולה! 📿',
      this.mistakes ? `טעויות בדרך: ${this.mistakes} – בפעם הבאה זה יהיה עוד יותר קל` : 'בלי אף טעות – איזה שליח! 🌟',
    ].join('<br/>');
    return { stars, text };
  }
}
