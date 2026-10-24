import * as THREE from 'three';
import { mesh, G, toon, textTexture, addOutline } from '../engine/materials.js';

const BLACK = 0x17171c;
const STRAP_R = 0.011;

// ---- בתים ----
export function createShelYad() {
  const g = new THREE.Group();
  const titura = mesh(G.rbox(0.105, 0.018, 0.105, 0.006), BLACK);
  const bayit = mesh(G.rbox(0.075, 0.075, 0.075, 0.008), BLACK);
  bayit.position.y = 0.046;
  const maabarta = mesh(G.rbox(0.03, 0.016, 0.05, 0.005), BLACK);
  maabarta.position.set(0, 0.0, -0.072);
  g.add(titura, bayit, maabarta);
  addShine(bayit, 0.075);
  return g;
}

export function createShelRosh() {
  const g = new THREE.Group();
  const titura = mesh(G.rbox(0.11, 0.018, 0.11, 0.006), BLACK);
  const bayit = mesh(G.rbox(0.08, 0.08, 0.08, 0.008), BLACK);
  bayit.position.y = 0.049;
  const maabarta = mesh(G.rbox(0.035, 0.016, 0.05, 0.005), BLACK);
  maabarta.position.set(0, 0, -0.075);
  g.add(titura, bayit, maabarta);
  // שי"ן על שני הצדדים
  const shinTex = textTexture('ש', { width: 128, height: 128, size: 100, color: '#d9d9e0' });
  const shinMat = new THREE.MeshBasicMaterial({ map: shinTex, transparent: true, toneMapped: false });
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), shinMat);
    p.position.set(s * 0.0412, 0.049, 0);
    p.rotation.y = s * Math.PI / 2;
    g.add(p);
  }
  // חריצי ארבעת הבתים
  for (const x of [-0.02, 0, 0.02]) {
    const line = new THREE.Mesh(G.box(0.002, 0.07, 0.082), new THREE.MeshBasicMaterial({ color: 0x050507 }));
    line.position.set(x, 0.052, 0);
    g.add(line);
  }
  addShine(bayit, 0.08);
  return g;
}

function addShine(bayit, size) {
  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 0.5, size * 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
  );
  shine.position.set(-size * 0.12, size * 0.3, size * 0.51);
  shine.rotation.z = 0.5;
  bayit.add(shine);
}

// ---- רצועות ----
const strapMat = toon(0x121216, { unique: true });

export function strapMesh(points, closed = false, segs = null) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, segs ?? Math.max(8, points.length * 6), STRAP_R, 5, closed);
  const m = new THREE.Mesh(geo, strapMat);
  m.castShadow = true;
  addOutline(m);
  return m;
}

// כריכות דינמיות: סליל סביב איבר. המיקומים במרחב המקומי של ההורה (מפרק המרפק).
export class Wrap {
  constructor(parent, { yStart, yEnd, radius, turns, lead = null }) {
    this.parent = parent;
    this.opts = { yStart, yEnd, radius, turns };
    this.lead = lead; // נקודות לפני הסליל (למשל מהמרפק)
    this.mesh = null;
    this.progress = 0;
  }
  set(progress) {
    progress = Math.max(0, Math.min(1, progress));
    if (Math.abs(progress - this.progress) < 0.002 && this.mesh) return;
    this.progress = progress;
    this.rebuild();
  }
  rebuild() {
    if (this.mesh) {
      this.parent.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    const { yStart, yEnd, radius, turns } = this.opts;
    const total = turns * Math.PI * 2;
    const tMax = total * this.progress;
    if (tMax < 0.05) return;
    const pts = this.lead ? this.lead.map((p) => p.clone()) : [];
    const steps = Math.max(2, Math.ceil(tMax / 0.35));
    for (let i = 0; i <= steps; i++) {
      const t = (tMax * i) / steps;
      const y = yStart + (yEnd - yStart) * (t / total);
      pts.push(new THREE.Vector3(Math.cos(t) * radius, y, Math.sin(t) * radius));
    }
    if (pts.length < 2) return;
    this.mesh = strapMesh(pts, false, pts.length * 4);
    this.parent.add(this.mesh);
  }
  dispose() {
    if (this.mesh) {
      this.parent.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }
}

// רצועת הראש: טבעת שמחבקת את הראש, ושתי רצועות שיורדות קדימה
export function createHeadStraps(headRadius = 0.27) {
  const g = new THREE.Group();
  const ring = [];
  for (let i = 0; i < 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    const y = 0.055 + 0.135 * Math.cos(th);
    const r = Math.sqrt(Math.max(0.001, headRadius * headRadius - y * y)) + 0.024;
    ring.push(new THREE.Vector3(Math.sin(th) * r, y, Math.cos(th) * r));
  }
  g.add(strapMesh(ring, true, 120));
  for (const s of [1, -1]) {
    const pts = [
      new THREE.Vector3(s * 0.03, -0.08, -0.27),
      new THREE.Vector3(s * 0.16, -0.24, -0.2),
      new THREE.Vector3(s * 0.25, -0.38, 0.02),
      new THREE.Vector3(s * 0.22, -0.55, 0.2),
      new THREE.Vector3(s * 0.18, -0.78, 0.27),
    ];
    g.add(strapMesh(pts));
  }
  // קשר בעורף
  const knot = mesh(G.rbox(0.05, 0.04, 0.03, 0.01), BLACK);
  knot.position.set(0, -0.08, -0.275);
  g.add(knot);
  return g;
}

// ---- תפילין על דמות, לפי התקדמות ההנחה (0..1) ----
// של יד ← שבע כריכות ← של ראש ← שמע ישראל (יד על העיניים) ← חליצה
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class TefillinRig {
  constructor(person, side) {
    this.p = person;
    this.side = side;
    const K = side > 0 ? 'L' : 'R';
    const shoulder = person.joints['arm' + K];
    const elbow = person.joints['elbow' + K];

    const n = new THREE.Vector3(-side * 0.55, 0, 0.83).normalize();
    const yadPos = new THREE.Vector3(n.x * 0.077, -0.14, n.z * 0.077);
    const yad = createShelYad();
    yad.position.copy(yadPos);
    yad.quaternion.setFromUnitVectors(UP, n);
    const yadStrap = strapMesh([
      yadPos.clone().addScaledVector(n, 0.012).add(new THREE.Vector3(0, -0.05, 0)),
      new THREE.Vector3(n.x * 0.06, -0.24, 0.07),
      new THREE.Vector3(0, -0.33, 0.075),
    ]);
    this.yadGroup = new THREE.Group();
    this.yadGroup.add(yad, yadStrap);
    this.yadGroup.visible = false;
    shoulder.add(this.yadGroup);

    this.wrap = new Wrap(elbow, { yStart: -0.05, yEnd: -0.26, radius: 0.084, turns: 7, lead: [new THREE.Vector3(0, 0, 0.08)] });

    const rn = new THREE.Vector3(0, 0.7, 0.714).normalize();
    const rosh = createShelRosh();
    rosh.position.copy(rn).multiplyScalar(0.292);
    rosh.quaternion.setFromUnitVectors(UP, rn);
    this.roshGroup = new THREE.Group();
    this.roshGroup.add(rosh, createHeadStraps(0.27));
    this.roshGroup.visible = false;
    person.head.add(this.roshGroup);

    person.rollSleeve(side, true);
    person.showAccessories(false);
    person.setPose('armOut', side);
  }

  setProgress(t) {
    const pop = (g, start) => {
      const k = clamp01((t - start) / 0.06);
      g.visible = k > 0;
      g.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)));
    };
    pop(this.yadGroup, 0.04);
    this.wrap.set(clamp01((t - 0.12) / 0.3));
    pop(this.roshGroup, 0.46);
    this.p.hatParts?.forEach((h) => (h.visible = t < 0.44));
    const pose = t > 0.6 && t < 0.86 ? 'shema' : 'armOut';
    if (this.p.poseName !== pose) this.p.setPose(pose, this.side);
  }

  dispose() {
    this.yadGroup.removeFromParent();
    this.roshGroup.removeFromParent();
    this.wrap.dispose();
    this.p.rollSleeve(this.side, false);
    this.p.showAccessories(true);
    this.p.hatParts?.forEach((h) => (h.visible = true));
    this.p.setPose('normal');
  }
}
