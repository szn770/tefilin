import * as THREE from 'three';
import { mesh, G, toon } from '../engine/materials.js';

// דמות מצוירת שנבנית מצורות פשוטות. הדמות מסתכלת לכיוון +z, והצד השמאלי שלה הוא +x.
// side: +1 = יד שמאל, -1 = יד ימין.

const darken = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();
const lerp = THREE.MathUtils.lerp;

const BASE_POSE = {
  armL: { x: 0, y: 0, z: 0.1 }, armR: { x: 0, y: 0, z: -0.1 },
  elbowL: { x: -0.15, y: 0, z: 0 }, elbowR: { x: -0.15, y: 0, z: 0 },
  head: { x: 0, y: 0, z: 0 }, legL: { x: 0, y: 0, z: 0 }, legR: { x: 0, y: 0, z: 0 },
};

export class Person {
  constructor(look, { scale = 1, isMendy = false } = {}) {
    this.look = look;
    this.isMendy = isMendy;
    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    this.body = new THREE.Group(); // מתנדנד בהליכה
    this.root.add(this.body);
    this.joints = {};
    this.accessories = [];
    this.sleeves = { L: null, R: null, lowL: null, lowR: null };
    this.pose = structuredClone(BASE_POSE);
    this.current = structuredClone(BASE_POSE);
    this.walkPhase = Math.random() * 10;
    this.walking = false;
    this.talkTimer = 0;
    this.happyTimer = 0;
    this.blinkTimer = 1 + Math.random() * 3;
    this.time = Math.random() * 100;
    this.targetYaw = null;

    this.build();
  }

  build() {
    const L = this.look;
    const skin = L.skin;
    const shirt = L.jacket ?? L.shirt;
    const longSleeves = !!(L.jacket || L.longSleeves || L.female || this.isMendy || L.hat === 'beret' || L.hat === 'flatcap' || L.hat === 'peaked');

    // ---- רגליים ----
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.12, 0.85, 0);
      const legColor = L.skirt ? (L.tights ?? 0x3b3036) : L.pants;
      const leg = mesh(G.capsule(0.095, 0.55), legColor);
      leg.position.y = -0.4;
      pivot.add(leg);
      const shoe = mesh(G.rbox(0.17, 0.11, 0.28, 0.05), L.female ? 0x7a3b2e : 0x2a2a2a);
      shoe.position.set(0, -0.8, 0.05);
      pivot.add(shoe);
      this.body.add(pivot);
      this.joints[s > 0 ? 'legL' : 'legR'] = pivot;
    }

    if (L.skirt) {
      // חצאית ארוכה עד אמצע השוק
      const skirt = mesh(G.cyl(0.22, 0.36, 0.72, 18), L.skirt);
      skirt.position.y = 0.55;
      this.body.add(skirt);
    }

    // ---- גוף ----
    const torso = mesh(G.capsule(0.25, 0.36), shirt);
    torso.position.y = 1.17;
    torso.scale.set(1, 1, 0.78);
    this.body.add(torso);
    this.torso = torso;

    if (L.jacket) {
      const front = mesh(G.rbox(0.16, 0.34, 0.05, 0.02), 0xffffff, { outline: false });
      front.position.set(0, 1.32, 0.18);
      this.body.add(front);
    }
    if (L.tie) {
      const tie = mesh(G.rbox(0.07, 0.3, 0.03, 0.015), L.tie);
      tie.position.set(0, 1.28, 0.205);
      this.body.add(tie);
    }
    if (L.badge) {
      const badge = mesh(G.rbox(0.07, 0.08, 0.02, 0.01), 0xffd166, { outline: false });
      badge.position.set(0.12, 1.33, 0.2);
      this.body.add(badge);
    }
    if (L.tzitzit || this.isMendy) {
      for (const s of [1, -1]) {
        for (const off of [-0.03, 0.03]) {
          const t = mesh(G.cyl(0.008, 0.008, 0.32, 5), 0xffffff, { outline: false, shadow: false });
          t.position.set(s * 0.24, 0.72, off);
          this.body.add(t);
        }
      }
    }
    if (this.isMendy) {
      // חגורה ומכנסיים שחורים כבר בצבע. מוסיפים חולצה לבנה מתחת לווסט
      const belt = mesh(G.cyl(0.26, 0.26, 0.05, 18), 0x1a1a1a, { outline: false });
      belt.position.y = 0.88;
      belt.scale.z = 0.8;
      this.body.add(belt);
    }
    if (L.backpack) {
      const bp = mesh(G.rbox(0.36, 0.42, 0.18, 0.06), L.backpackColor ?? 0x3d5a80);
      bp.position.set(0, 1.18, -0.27);
      this.body.add(bp);
    }
    if (L.bag) {
      const bag = mesh(G.rbox(0.22, 0.18, 0.08, 0.04), L.bagColor);
      bag.position.set(-0.32, 0.92, 0.02);
      this.body.add(bag);
      this.accessories.push(bag);
    }

    const neck = mesh(G.cyl(0.08, 0.09, 0.12, 12), skin, { outline: false });
    neck.position.y = 1.56;
    this.body.add(neck);

    // ---- ידיים ----
    for (const s of [1, -1]) {
      const k = s > 0 ? 'L' : 'R';
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.3, 1.46, 0);
      const upper = mesh(G.capsule(0.075, 0.22), skin);
      upper.position.y = -0.17;
      shoulder.add(upper);

      // שרוול: הגאומטריה מוזזת כך שהחלק העליון בנקודת הכתף – אפשר "להפשיל" בעזרת scale.y
      const sleeveGeo = sleeveGeometry(0.088, longSleeves ? 0.34 : 0.17);
      const sleeve = mesh(sleeveGeo, shirt);
      sleeve.position.y = 0.04;
      shoulder.add(sleeve);
      this.sleeves[k] = sleeve;
      this.sleeves[k + 'Full'] = longSleeves ? 1 : 0.5;

      const elbow = new THREE.Group();
      elbow.position.y = -0.34;
      shoulder.add(elbow);
      const fore = mesh(G.capsule(0.068, 0.2), skin);
      fore.position.y = -0.15;
      elbow.add(fore);
      if (longSleeves) {
        const low = mesh(sleeveGeometry(0.08, 0.24), shirt);
        low.position.y = 0.02;
        elbow.add(low);
        this.sleeves['low' + k] = low;
      }
      const hand = mesh(G.sphere(0.078, 16, 12), skin);
      hand.position.y = -0.32;
      hand.scale.set(0.9, 1.05, 0.75);
      elbow.add(hand);

      this.body.add(shoulder);
      this.joints['arm' + k] = shoulder;
      this.joints['elbow' + k] = elbow;
      this[`upper${k}`] = upper;
      this[`fore${k}`] = fore;
      this[`hand${k}`] = hand;
    }

    // ---- ראש ----
    const head = new THREE.Group();
    head.position.y = 1.8;
    this.body.add(head);
    this.joints.head = head;
    this.head = head;

    const skull = mesh(G.sphere(0.27, 28, 20), skin);
    head.add(skull);
    this.skull = skull;

    for (const s of [1, -1]) {
      const ear = mesh(G.sphere(0.055, 12, 10), skin);
      ear.position.set(s * 0.262, -0.01, 0);
      ear.scale.set(0.6, 1, 0.8);
      head.add(ear);

      const eye = mesh(G.sphere(0.04, 14, 10), 0x1b1530, { outline: false, shadow: false });
      eye.position.set(s * 0.095, 0.03, 0.243);
      eye.scale.set(1, 1.35, 0.6);
      const shine = mesh(G.sphere(0.012, 8, 6), 0xffffff, { outline: false, shadow: false });
      shine.position.set(0.012, 0.015, 0.03);
      eye.add(shine);
      head.add(eye);
      (this.eyes ||= []).push(eye);

      const brow = mesh(G.rbox(0.085, 0.022, 0.02, 0.01), darken(L.hair, 0.8), { outline: false, shadow: false });
      brow.position.set(s * 0.095, 0.12, 0.245);
      brow.rotation.z = s * -0.12;
      head.add(brow);

      const cheek = mesh(G.sphere(0.05, 12, 8), 0xff9c9c, { outline: false, shadow: false });
      cheek.position.set(s * 0.16, -0.06, 0.212);
      cheek.scale.set(1, 0.6, 0.3);
      head.add(cheek);
    }

    const nose = mesh(G.sphere(0.045, 12, 10), darken(skin, 0.93));
    nose.position.set(0, -0.025, 0.27);
    head.add(nose);

    const mouth = mesh(G.torus(0.065, 0.015, 8, 16, Math.PI), 0x6b2737, { outline: false, shadow: false });
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.085, 0.25);
    mouth.rotation.x = -0.25;
    head.add(mouth);
    this.mouth = mouth;
    // בזמן דיבור: פה קטן וכהה שנפתח מעט, במקום החיוך
    const open = mesh(G.sphere(0.038, 14, 10), 0x4a2326, { outline: false, shadow: false });
    open.position.set(0, -0.118, 0.236);
    open.rotation.x = 0.45;
    open.scale.set(1, 0.3, 0.45);
    open.visible = false;
    head.add(open);
    this.mouthOpen = open;

    // שיער
    if (L.hat === 'tichel') {
      // ממילא מכוסה בטיכל
    } else if (!L.bald) {
      const hairGeo = new THREE.SphereGeometry(0.285, 26, 14, 0, Math.PI * 2, 0, Math.PI * 0.46);
      const hair = mesh(hairGeo, L.hair);
      hair.rotation.x = -0.45;
      hair.position.set(0, 0.005, -0.01);
      head.add(hair);
    } else {
      for (const s of [1, -1]) {
        const tuft = mesh(G.sphere(0.09, 12, 8), L.hair);
        tuft.position.set(s * 0.22, 0.04, -0.1);
        tuft.scale.set(0.6, 1, 1.2);
        head.add(tuft);
      }
    }
    if (L.longHair && L.hat !== 'tichel') {
      const back = mesh(G.capsule(0.22, 0.3), L.hair);
      back.position.set(0, -0.2, -0.12);
      back.scale.set(1.1, 1, 0.6);
      head.add(back);
    }

    if (L.beard || this.isMendy) {
      const beardColor = L.beardColor ?? L.hair;
      const beard = mesh(G.sphere(0.2, 20, 14), beardColor);
      beard.position.set(0, -0.17, 0.11);
      beard.scale.set(1.08, 0.85, 0.75);
      head.add(beard);
      // הפה מעל הזקן
      this.mouth.position.z = 0.28;
      this.mouth.position.y = -0.08;
      this.mouthOpen.position.set(0, -0.112, 0.268);
      const stache = mesh(G.capsule(0.03, 0.12, 4, 8), beardColor, { outline: false });
      stache.rotation.z = Math.PI / 2;
      stache.position.set(0, -0.06, 0.27);
      head.add(stache);
    }

    if (L.glasses) {
      for (const s of [1, -1]) {
        const ring = mesh(G.torus(0.06, 0.011, 8, 20), 0x222222, { outline: false, shadow: false });
        ring.position.set(s * 0.095, 0.03, 0.262);
        head.add(ring);
      }
      const bridge = mesh(G.box(0.07, 0.012, 0.012), 0x222222, { outline: false, shadow: false });
      bridge.position.set(0, 0.04, 0.265);
      head.add(bridge);
    }

    this.buildHat(head);

    // ---- אביזרים ביד ימין (יוסתרו בזמן ההנחה) ----
    if (L.phone) {
      const phone = mesh(G.rbox(0.07, 0.14, 0.02, 0.01), 0x111111);
      phone.position.set(0, -0.36, 0.05);
      this.joints.elbowR.add(phone);
      this.accessories.push(phone);
    }
    if (L.briefcase) {
      const bc = mesh(G.rbox(0.34, 0.25, 0.09, 0.03), 0x5a3b22);
      bc.position.set(0, -0.48, 0);
      this.joints.elbowL.add(bc);
      this.accessories.push(bc);
    }
    if (L.cane) {
      const cane = mesh(G.cyl(0.018, 0.018, 0.95, 8), 0x5a3b22);
      cane.position.set(0, -0.72, 0.08);
      this.joints.elbowR.add(cane);
      this.accessories.push(cane);
    }
    if (L.clipboard) {
      const board = mesh(G.rbox(0.2, 0.26, 0.02, 0.01), 0x8b5a2b);
      const paper = mesh(G.box(0.16, 0.2, 0.005), 0xffffff, { outline: false });
      paper.position.z = 0.012;
      board.add(paper);
      board.position.set(0, -0.38, 0.08);
      board.rotation.x = -0.3;
      this.joints.elbowL.add(board);
    }

    // תיבת פגיעה נוחה ללחיצה של ילדים
    const hit = new THREE.Mesh(G.cyl(0.42, 0.42, 2.1, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.05;
    hit.userData.person = this;
    this.root.add(hit);
    this.hitbox = hit;
  }

  buildHat(head) {
    const L = this.look;
    const hat = L.hat;
    if (this.isMendy) {
      const black = 0x1c1c24;
      const brim = mesh(G.cyl(0.38, 0.38, 0.025, 28), black);
      brim.position.y = 0.17;
      const crown = mesh(G.cyl(0.2, 0.235, 0.22, 24), black);
      crown.position.y = 0.29;
      const band = mesh(G.cyl(0.238, 0.238, 0.045, 24), 0x3a3a48, { outline: false });
      band.position.y = 0.205;
      const g = new THREE.Group();
      g.add(brim, crown, band);
      g.rotation.x = -0.08;
      head.add(g);
      return;
    }
    if (hat === 'kippa') {
      const kGeo = new THREE.SphereGeometry(0.15, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
      const k = mesh(kGeo, L.kippaColor ?? 0x1d3a8a);
      k.position.set(0, 0.14, -0.07);
      k.rotation.x = -0.55;
      head.add(k);
    } else if (hat === 'cap') {
      const color = L.capColor ?? L.shirt;
      const dome = mesh(new THREE.SphereGeometry(0.29, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), color);
      dome.position.y = 0.03;
      const brim = mesh(G.cyl(0.17, 0.17, 0.025, 18), color);
      brim.scale.set(1, 1, 0.85);
      brim.position.set(0, 0.11, 0.27);
      brim.rotation.x = 0.18;
      head.add(dome, brim);
      this.hatParts = [dome, brim];
    } else if (hat === 'beret') {
      const b = mesh(G.sphere(0.26, 20, 12), L.beret);
      b.scale.set(1.1, 0.35, 1.05);
      b.position.set(-0.04, 0.22, -0.02);
      b.rotation.z = 0.25;
      head.add(b);
      this.hatParts = [b];
    } else if (hat === 'flatcap') {
      const c = mesh(G.sphere(0.27, 20, 12), L.hatColor);
      c.scale.set(1.08, 0.45, 1.1);
      c.position.set(0, 0.17, 0.0);
      const brim = mesh(G.cyl(0.16, 0.16, 0.025, 18), L.hatColor);
      brim.scale.set(1.1, 1, 0.6);
      brim.position.set(0, 0.13, 0.24);
      brim.rotation.x = 0.25;
      head.add(c, brim);
      this.hatParts = [c, brim];
    } else if (hat === 'peaked') {
      // כובע מצחייה של פקח
      const crown = mesh(G.cyl(0.3, 0.27, 0.14, 24), L.hatColor);
      crown.position.set(0, 0.2, -0.01);
      crown.rotation.x = -0.1;
      const brim = mesh(G.cyl(0.17, 0.17, 0.025, 18), 0x111111);
      brim.scale.set(1.1, 1, 0.65);
      brim.position.set(0, 0.13, 0.25);
      brim.rotation.x = 0.3;
      const band = mesh(G.cyl(0.275, 0.275, 0.035, 24), 0xffd166, { outline: false });
      band.position.set(0, 0.145, -0.01);
      head.add(crown, brim, band);
    } else if (hat === 'tichel') {
      // כיסוי ראש לאישה נשואה
      const scarf = mesh(new THREE.SphereGeometry(0.3, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), L.hatColor);
      scarf.rotation.x = -0.5;
      scarf.position.set(0, 0.0, -0.02);
      const knot = mesh(G.sphere(0.11, 14, 10), L.hatColor);
      knot.position.set(0, -0.05, -0.29);
      knot.scale.set(1.2, 0.9, 0.8);
      head.add(scarf, knot);
    }
  }

  // ---- שליטה ----
  setWalking(on, rate = this.walkRate ?? 1) {
    this.walking = on;
    this.walkRate = rate;
  }
  talk(seconds = 1.5) { this.talkTimer = seconds; }
  happy(seconds = 1.6) { this.happyTimer = seconds; }

  faceYaw(yaw, instant = false) {
    this.targetYaw = yaw;
    if (instant) this.root.rotation.y = yaw;
  }
  faceTowards(x, z, instant = false) {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    this.faceYaw(Math.atan2(dx, dz), instant);
  }

  setPose(name, side = 1) {
    const p = structuredClone(BASE_POSE);
    const k = side > 0 ? 'L' : 'R';
    const o = side > 0 ? 'R' : 'L';
    if (name === 'armOut' || name === 'tefillin' || name === 'shema') {
      // היד החלשה מושטת הצידה, האמה כפופה קדימה
      p['arm' + k] = { x: -0.2, y: 0, z: side * 0.95 };
      p['elbow' + k] = { x: -0.5, y: 0, z: 0 };
    }
    if (name === 'shema') {
      // היד החזקה מכסה את העיניים
      p['arm' + o] = { x: -1.86, y: 0, z: side * 0.3 };
      p['elbow' + o] = { x: -1.03, y: 0, z: side * 0.5 };
      p.head = { x: 0.12, y: 0, z: 0 };
    }
    if (name === 'cheer') {
      p.armL = { x: -0.2, y: 0, z: 2.6 };
      p.armR = { x: -0.2, y: 0, z: -2.6 };
      p.elbowL = { x: -0.3, y: 0, z: 0 };
      p.elbowR = { x: -0.3, y: 0, z: 0 };
    }
    if (name === 'eat') {
      // יד ימין מקרבת עוגה לפה
      p.armR = { x: -1.6, y: 0, z: 0.3 };
      p.elbowR = { x: -1.1, y: 0, z: 0.5 };
    }
    if (name === 'phone') {
      // יד ימין מחזיקה טלפון ליד האוזן
      p.armR = { x: -2.11, y: 0, z: -0.96 };
      p.elbowR = { x: -2.17, y: 0, z: 0.53 };
    }
    if (name === 'wave') {
      p.armR = { x: -0.3, y: 0, z: -2.5 };
      p.elbowR = { x: -0.5, y: 0, z: 0 };
    }
    if (name === 'offer') {
      p.armL = { x: -1.1, y: 0, z: 0.25 };
      p.armR = { x: -1.1, y: 0, z: -0.25 };
      p.elbowL = { x: -0.5, y: 0, z: 0 };
      p.elbowR = { x: -0.5, y: 0, z: 0 };
    }
    this.pose = p;
    this.poseName = name;
  }

  rollSleeve(side, rolled) {
    const k = side > 0 ? 'L' : 'R';
    const s = this.sleeves[k];
    if (s) s.userData.targetScale = rolled ? 0.32 : this.sleeves[k + 'Full'] > 0.5 ? 1 : 1;
    const low = this.sleeves['low' + k];
    if (low) low.visible = !rolled;
  }

  showAccessories(on) {
    for (const a of this.accessories) a.visible = on;
  }

  // ---- עדכון בכל פריים ----
  update(dt) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 9);

    for (const j of Object.keys(this.pose)) {
      const c = this.current[j];
      const t = this.pose[j];
      c.x = lerp(c.x, t.x, k);
      c.y = lerp(c.y, t.y, k);
      c.z = lerp(c.z, t.z, k);
    }

    let swing = 0;
    if (this.walking) {
      this.walkPhase += dt * 7.5 * (this.walkRate ?? 1);
      swing = Math.sin(this.walkPhase);
      this.body.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.05;
    } else {
      this.body.position.y = lerp(this.body.position.y, 0, k);
    }

    const J = this.joints;
    const free = this.poseName === undefined || this.poseName === 'normal';
    J.legL.rotation.set(this.current.legL.x + swing * 0.55, 0, 0);
    J.legR.rotation.set(this.current.legR.x - swing * 0.55, 0, 0);
    J.armL.rotation.set(this.current.armL.x - (free ? swing * 0.5 : 0), this.current.armL.y, this.current.armL.z);
    J.armR.rotation.set(this.current.armR.x + (free ? swing * 0.5 : 0), this.current.armR.y, this.current.armR.z);
    J.elbowL.rotation.set(this.current.elbowL.x, this.current.elbowL.y, this.current.elbowL.z);
    J.elbowR.rotation.set(this.current.elbowR.x, this.current.elbowR.y, this.current.elbowR.z);

    // נשימה ותנודת ראש
    const breathe = Math.sin(this.time * 2.2) * 0.012;
    this.torso.scale.y = 1 + breathe;
    let headX = this.current.head.x;
    let headZ = Math.sin(this.time * 1.3) * 0.03;
    if (this.talkTimer > 0) {
      this.talkTimer -= dt;
      headX += Math.sin(this.time * 14) * 0.03;
      this.mouth.visible = false;
      this.mouthOpen.visible = true;
      this.mouthOpen.scale.y = 0.22 + Math.abs(Math.sin(this.time * 11)) * 0.3;
    } else if (this.mouthOpen.visible) {
      this.mouthOpen.visible = false;
      this.mouth.visible = true;
    }
    J.head.rotation.set(headX, this.current.head.y, headZ);

    if (this.happyTimer > 0) {
      this.happyTimer -= dt;
      this.body.position.y += Math.abs(Math.sin(this.happyTimer * 9)) * 0.18;
    }

    // מצמוץ
    this.blinkTimer -= dt;
    const blink = this.blinkTimer < 0.12 ? 0.15 : 1;
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 3;
    for (const e of this.eyes) e.scale.y = 1.35 * blink;

    // שרוולים
    for (const kk of ['L', 'R']) {
      const s = this.sleeves[kk];
      if (s && s.userData.targetScale !== undefined) s.scale.y = lerp(s.scale.y, s.userData.targetScale, k);
    }

    // סיבוב חלק לכיוון המטרה
    if (this.targetYaw !== null) {
      let d = this.targetYaw - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * 8);
    }
  }

  // נקודות עולם שימושיות למצלמה ולמשחקונים
  worldPoint(obj, local) {
    obj.updateWorldMatrix(true, false);
    return obj.localToWorld(local.clone());
  }
}

function sleeveGeometry(r, len) {
  const g = new THREE.CylinderGeometry(r, r * 0.95, len, 14, 1, false);
  g.translate(0, -len / 2, 0);
  return g;
}

export const MENDY_LOOK = {
  skin: 0xf3cba5, hair: 0x3b2516, beardColor: 0x4a2e1a, shirt: 0xffffff, pants: 0x1c1c24,
};
