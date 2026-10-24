import * as THREE from 'three';
import { mesh, G, toon, textTexture } from '../engine/materials.js';

// ---- דוכן: שולחן, שלט, שמשייה ----
export function buildBooth(x, { main = false } = {}) {
  const g = new THREE.Group();
  g.position.set(x, 0, -2.3);

  const top = mesh(G.rbox(2.3, 0.08, 0.95, 0.03), 0x1d3a8a);
  top.position.y = 0.88;
  const cloth = mesh(G.rbox(2.32, 0.7, 0.97, 0.04), 0x24479e);
  cloth.position.y = 0.52;
  g.add(top, cloth);

  const signTex = textTexture('מבצע תפילין', {
    width: 1024, height: 220, bg: '#ffc531', color: '#1d3a8a', size: 150, border: '#ffffff', borderWidth: 16, radius: 50,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.43), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }));
  sign.position.set(0, 0.55, 0.49);
  g.add(sign);

  const pole = mesh(G.cyl(0.04, 0.04, 2.6, 8), 0xdddddd);
  pole.position.set(-0.9, 1.3, -0.35);
  g.add(pole);
  const umbrella = new THREE.Group();
  const segs = 8;
  const colors = main ? [0x1d3a8a, 0xffffff] : [0xffc531, 0xffffff];
  for (let i = 0; i < segs; i++) {
    const geo = new THREE.ConeGeometry(1.7, 0.6, 1, 1, true, (i / segs) * Math.PI * 2, (Math.PI * 2) / segs);
    const m = new THREE.Mesh(geo, toon(colors[i % 2], { unique: true, side: THREE.DoubleSide }));
    m.castShadow = true;
    umbrella.add(m);
  }
  umbrella.position.set(-0.9, 2.75, -0.35);
  g.add(umbrella);

  if (main) {
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.5),
      new THREE.MeshBasicMaterial({ map: textTexture('הנחת היום?', { width: 1024, height: 220, bg: '#1d3a8a', color: '#ffc531', size: 140, border: '#ffc531', borderWidth: 12 }), toneMapped: false, side: THREE.DoubleSide }),
    );
    banner.position.set(0.3, 2.1, -0.9);
    g.add(banner);
    for (const s of [-0.85, 1.45]) {
      const p = mesh(G.cyl(0.03, 0.03, 2.4, 8), 0xdddddd);
      p.position.set(s, 1.2, -0.9);
      g.add(p);
    }
  }

  // על השולחן: שקיות תפילין, סידור, קופת צדקה
  const bagA = mesh(G.rbox(0.32, 0.22, 0.24, 0.07), 0x2a2a7a);
  bagA.position.set(0.55, 1.03, -0.05);
  const bagB = mesh(G.rbox(0.3, 0.2, 0.22, 0.07), 0x6b1d3a);
  bagB.position.set(0.85, 1.02, 0.12);
  const pushka = mesh(G.rbox(0.14, 0.2, 0.12, 0.02), 0x2a9d8f);
  pushka.position.set(1.0, 1.02, -0.25);
  const siddur = mesh(G.rbox(0.18, 0.04, 0.25, 0.01), 0x7a1f1f);
  siddur.position.set(0.15, 0.94, -0.2);
  siddur.rotation.y = 0.3;
  const candles = mesh(G.rbox(0.22, 0.08, 0.14, 0.02), 0xffffff);
  candles.position.set(-0.4, 0.96, 0.2);
  g.add(bagA, bagB, pushka, siddur, candles);
  return g;
}

// ---- פינת עוגה ולחיים: שולחן עגול שמחכים לידו ----
export function buildCakeCorner(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const top = mesh(G.cyl(0.5, 0.5, 0.05, 28), 0xffffff);
  top.position.y = 0.9;
  const leg = mesh(G.cyl(0.05, 0.05, 0.88, 10), 0x777777);
  leg.position.y = 0.45;
  const foot = mesh(G.cyl(0.25, 0.28, 0.04, 18), 0x777777);
  foot.position.y = 0.02;
  g.add(top, leg, foot);
  const plate = mesh(G.cyl(0.22, 0.19, 0.03, 20), 0xf1f1f1);
  plate.position.set(-0.08, 0.94, 0);
  g.add(plate);
  for (let i = 0; i < 5; i++) {
    const cake = mesh(G.rbox(0.1, 0.07, 0.1, 0.02), i % 2 ? 0xd4a373 : 0x8b5a3c);
    cake.position.set(-0.16 + (i % 3) * 0.1, 0.99, -0.06 + Math.floor(i / 3) * 0.12);
    g.add(cake);
  }
  const bottle = mesh(G.capsule(0.05, 0.16, 4, 10), 0x6a1b4d);
  bottle.position.set(0.25, 1.06, -0.1);
  g.add(bottle);
  for (let i = 0; i < 3; i++) {
    const cup = mesh(G.cyl(0.035, 0.028, 0.08, 10), 0xffffff);
    cup.position.set(0.18 + i * 0.08, 0.96, 0.15);
    g.add(cup);
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.3),
    new THREE.MeshBasicMaterial({ map: textTexture('לחיים!', { width: 512, height: 170, bg: '#e76f51', color: '#ffffff', size: 110, radius: 40 }), toneMapped: false }),
  );
  const signPole = mesh(G.cyl(0.02, 0.02, 1.7, 8), 0xdddddd);
  signPole.position.set(0.55, 0.85, -0.2);
  sign.position.set(0.55, 1.75, -0.2);
  g.add(signPole, sign);
  return g;
}

// ---- לכלוך על המדרכה ----
export function buildTrash() {
  const g = new THREE.Group();
  const kind = Math.floor(Math.random() * 3);
  if (kind === 0) {
    const cup = mesh(G.cyl(0.05, 0.04, 0.11, 10), 0xffffff);
    cup.rotation.z = Math.PI / 2;
    cup.position.y = 0.05;
    g.add(cup);
  } else if (kind === 1) {
    const paper = mesh(G.sphere(0.07, 7, 5), 0xf4f1de);
    paper.scale.set(1, 0.8, 1.1);
    paper.position.y = 0.05;
    g.add(paper);
  } else {
    const wrap = mesh(G.rbox(0.16, 0.02, 0.1, 0.01), [0xe63946, 0x2a9d8f, 0xf4a261][Math.floor(Math.random() * 3)]);
    wrap.position.y = 0.015;
    g.add(wrap);
  }
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

// ---- יונה ----
export function buildPigeon() {
  const g = new THREE.Group();
  const body = mesh(G.sphere(0.11, 14, 10), 0x8d8f99);
  body.scale.set(0.9, 0.85, 1.3);
  body.position.y = 0.12;
  const head = mesh(G.sphere(0.065, 12, 10), 0x6e7080);
  head.position.set(0, 0.24, 0.11);
  const neck = mesh(G.sphere(0.07, 12, 8), 0x4f8a6b);
  neck.position.set(0, 0.19, 0.08);
  neck.scale.set(1, 0.8, 1);
  const beak = mesh(G.cyl(0.0, 0.018, 0.05, 6), 0xffa040, { outline: false });
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.235, 0.18);
  g.add(body, neck, head, beak);
  for (const s of [1, -1]) {
    const eye = mesh(G.sphere(0.012, 6, 5), 0xff6b35, { outline: false });
    eye.position.set(s * 0.045, 0.255, 0.14);
    g.add(eye);
    const wing = mesh(G.sphere(0.09, 10, 8), 0x7a7c88);
    wing.scale.set(0.3, 0.6, 1.2);
    wing.position.set(s * 0.09, 0.14, -0.01);
    g.add(wing);
    g.userData['wing' + (s > 0 ? 'L' : 'R')] = wing;
    const leg = mesh(G.cyl(0.008, 0.008, 0.06, 5), 0xff7a5c, { outline: false });
    leg.position.set(s * 0.035, 0.03, 0.02);
    g.add(leg);
  }
  return g;
}

// ---- אוטובוס ותחנה ----
export function buildBus() {
  const g = new THREE.Group();
  const body = mesh(G.rbox(6.4, 2.1, 2.3, 0.25), 0xf5f5f0);
  body.position.y = 1.55;
  const stripe = mesh(G.box(6.42, 0.3, 2.32), 0x1b9e4b, { outline: false });
  stripe.position.y = 0.95;
  const windows = mesh(G.box(5.4, 0.75, 2.34), 0x2b4a6b, { outline: false });
  windows.position.set(-0.2, 1.95, 0);
  const front = mesh(G.box(0.05, 1.1, 1.9), 0x2b4a6b, { outline: false });
  front.position.set(-3.21, 1.8, 0);
  g.add(body, stripe, windows, front);
  const door = mesh(G.box(0.9, 1.6, 0.05), 0x3d6b8f, { outline: false });
  door.position.set(-2.2, 1.3, -1.16);
  g.add(door);
  for (const wx of [-2.2, 2.2]) {
    for (const wz of [-1.1, 1.1]) {
      const wheel = mesh(G.cyl(0.45, 0.45, 0.3, 18), 0x222222);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.45, wz);
      g.add(wheel);
    }
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.32),
    new THREE.MeshBasicMaterial({ map: textTexture('קו 770', { width: 512, height: 120, bg: '#111111', color: '#ffb000', size: 90, radius: 10 }), toneMapped: false }),
  );
  sign.position.set(-3.24, 2.45, 0);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);
  return g;
}

// ---- טנק המבצעים: קרוואן עם רמקולים ושלט ----
export function buildTank() {
  const g = new THREE.Group();
  const body = mesh(G.rbox(4.6, 2.2, 2.2, 0.25), 0xffffff);
  body.position.set(-0.4, 1.55, 0);
  const cab = mesh(G.rbox(1.3, 1.5, 2.1, 0.25), 0xffffff);
  cab.position.set(2.45, 1.2, 0);
  const windshield = mesh(G.box(0.05, 0.6, 1.7), 0x2b4a6b, { outline: false });
  windshield.position.set(3.1, 1.55, 0);
  const stripe = mesh(G.box(5.95, 0.32, 2.24), 0x1d3a8a, { outline: false });
  stripe.position.set(0.2, 0.75, 0);
  g.add(body, cab, windshield, stripe);
  for (const wx of [-1.8, 2.2]) {
    for (const wz of [-1.05, 1.05]) {
      const wheel = mesh(G.cyl(0.42, 0.42, 0.3, 18), 0x222222);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      g.add(wheel);
    }
  }
  // שלט בצד שפונה למדרכה ולמצלמה
  const sideTex = textTexture('טנק המבצעים', { width: 1024, height: 200, bg: '#ffc531', color: '#1d3a8a', size: 130, radius: 30, border: '#1d3a8a', borderWidth: 12 });
  for (const s of [1, -1]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.75), new THREE.MeshBasicMaterial({ map: sideTex, toneMapped: false }));
    sign.position.set(-0.4, 1.75, s * 1.12);
    if (s < 0) sign.rotation.y = Math.PI;
    g.add(sign);
  }
  // רמקולים על הגג
  for (const sx of [-1.8, 0.8]) {
    const horn = mesh(G.cyl(0.28, 0.08, 0.5, 14), 0xdddddd);
    horn.rotation.z = Math.PI / 2;
    horn.position.set(sx, 2.95, 0);
    const base = mesh(G.box(0.2, 0.3, 0.2), 0x888888);
    base.position.set(sx + 0.15, 2.75, 0);
    g.add(horn, base);
  }
  return g;
}

// ---- קישוטים לדוכן: 1 בלונים, 2 דגלונים, 3 אורות ----
export function buildDecor(tier) {
  const g = new THREE.Group();
  const colors = [0xff5d8f, 0x4fb3ff, 0xffd166, 0x7ed957, 0xc77dff];
  if (tier >= 1) {
    for (let i = 0; i < 4; i++) {
      const b = mesh(G.sphere(0.17, 14, 10), colors[i % colors.length]);
      b.scale.set(1, 1.2, 1);
      b.position.set(1.05 + (i % 2) * 0.22 - 0.1, 2.0 + Math.floor(i / 2) * 0.28 + (i % 2) * 0.1, 0.35 + (i % 2) * 0.1);
      const str = mesh(G.cyl(0.004, 0.004, 1.0, 4), 0xffffff, { outline: false, shadow: false });
      str.position.set(1.05, 1.4, 0.4);
      g.add(b, str);
    }
  }
  if (tier >= 2) {
    // דגלונים לאורך שפת השולחן
    for (let i = 0; i < 9; i++) {
      const f = mesh(G.cyl(0.0, 0.07, 0.14, 3), colors[i % colors.length], { outline: false });
      f.rotation.x = Math.PI;
      f.position.set(-1.05 + i * 0.26, 0.82, 0.5);
      g.add(f);
    }
  }
  if (tier >= 3) {
    // שרשרת אורות מסביב לשמשייה
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const l = new THREE.Mesh(G.sphere(0.05, 8, 6), lightMat);
      l.position.set(-0.9 + Math.cos(a) * 1.62, 2.42, -0.35 + Math.sin(a) * 1.62);
      g.add(l);
    }
  }
  return g;
}

export function buildBusStop(x) {
  const g = new THREE.Group();
  g.position.set(x, 0, 2.55);
  const pole = mesh(G.cyl(0.04, 0.04, 2.4, 8), 0x2f3e46);
  pole.position.y = 1.2;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({ map: textTexture('🚌', { width: 256, height: 256, bg: '#1b9e4b', color: '#ffffff', size: 160, radius: 60 }), toneMapped: false, side: THREE.DoubleSide }),
  );
  sign.position.y = 2.3;
  g.add(pole, sign);
  return g;
}
