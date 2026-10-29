import * as THREE from 'three';
import { Person } from '../characters/person.js';
import { TefillinRig } from '../world/tefillin.js';
import { buildBooth, buildCakeCorner } from '../world/props.js';
import { mesh, G } from '../engine/materials.js';
import { tween, ease } from '../engine/tween.js';

// הדוכנים: לכל דוכן שליח אחד שמניח לאדם אחד בכל פעם (עם זוג תפילין שני: לשניים), ו-2–3 עמדות המתנה.
// פינת עוגה: עוד מקומות שבהם מחכים (ואוכלים עוגה) עד שמתפנה מקום בדוכן.
// מצבי מקום: free → coming → waiting / lounge → serving → free

const BOOTH_X = [-0.3, 4.3, -4.7];
const SPOT_DX = [-0.75, 0.15, 1.05];
const SPOT_Z = -1.35;
const LOUNGE = { x: 2.0, z: -2.45, spots: [[1.55, -1.5], [2.45, -1.5], [2.0, -0.9]] };
const HELPER_LOOKS = [
  { skin: 0xeec19b, hair: 0x6b4426, beardColor: 0x9a5a2b, shirt: 0xffffff, pants: 0x1c1c24 },
  { skin: 0xd9a47a, hair: 0x1a1a1a, beardColor: 0x1a1a1a, shirt: 0xffffff, pants: 0x1c1c24 },
];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const MAX_BOOTHS = BOOTH_X.length;
export const MAX_SPOTS_PER_BOOTH = SPOT_DX.length;

export class Booths {
  constructor(game) {
    this.g = game;
    this.booths = [];
    this.lounge = [];
    this.loungeMesh = null;
    this.time = 0;
    this.markerGeo = new THREE.CircleGeometry(0.34, 32);
    this.ringGeo = new THREE.RingGeometry(0.31, 0.38, 32);
  }

  // ---------- בנייה ----------
  addBooth() {
    const index = this.booths.length;
    const x = BOOTH_X[index];
    const mesh = buildBooth(x, { main: index === 0 });
    this.g.scene.add(mesh);
    let shliach = this.g.mendy;
    if (index > 0) {
      shliach = new Person(HELPER_LOOKS[index - 1], { isMendy: true });
      this.g.scene.add(shliach.root);
      tween(0.5, (k) => mesh.scale.setScalar(Math.max(0.01, k)), ease.back);
    }
    shliach.root.position.set(x - 0.1, 0, -2.95);
    shliach.faceYaw(0.2, true);
    const booth = { index, x, mesh, shliach, spots: [], serving: [], pairs: 1, pigeon: null, closedUntil: 0, closedTag: null };
    this.booths.push(booth);
    this.addSpot(booth);
    this.addSpot(booth);
    return booth;
  }

  addSpot(booth) {
    const pos = V(booth.x + SPOT_DX[booth.spots.length], 0, SPOT_Z);
    booth.spots.push(this.makeSpot(pos, 'booth', booth, 0xffc531));
  }

  unlockLounge() {
    if (this.loungeMesh) return;
    this.loungeMesh = buildCakeCorner(LOUNGE.x, LOUNGE.z);
    this.g.scene.add(this.loungeMesh);
    tween(0.5, (k) => this.loungeMesh.scale.setScalar(Math.max(0.01, k)), ease.back);
    for (const [x, z] of LOUNGE.spots) this.lounge.push(this.makeSpot(V(x, 0, z), 'lounge', null, 0xe76f51));
  }

  makeSpot(pos, kind, booth, color) {
    const marker = new THREE.Group();
    const disc = new THREE.Mesh(this.markerGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color }));
    marker.add(disc, ring);
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(pos.x, 0.012, pos.z);
    this.g.scene.add(marker);
    tween(0.4, (k) => marker.scale.setScalar(Math.max(0.01, k)), ease.back);
    return { kind, booth, pos, marker, disc, ring, color, ped: null, state: 'free', patience: 0, maxPatience: 1, progress: 0, rig: null, tag: null, since: 0 };
  }

  // ---------- שאילתות ----------
  get boothSpots() { return this.booths.flatMap((b) => b.spots); }
  get allSpots() { return [...this.boothSpots, ...this.lounge]; }
  get totalSpots() { return this.allSpots.length; }
  get busyCount() { return this.allSpots.filter((s) => s.state !== 'free').length; }
  get isEmpty() { return this.allSpots.every((s) => s.state === 'free'); }
  canAccept() { return this.allSpots.some((s) => s.state === 'free'); }

  // מקום פנוי בדוכן – עדיפות לדוכן שהשליח שלו פנוי ושיש בו הכי מעט מחכים
  freeBoothSpot() {
    let best = null, bestScore = Infinity;
    for (const b of this.booths) {
      const free = b.spots.find((s) => s.state === 'free');
      if (!free) continue;
      const load = b.spots.filter((s) => s.state !== 'free').length + (b.serving.length >= b.pairs ? 0.5 : 0) + (b.pigeon ? 2 : 0);
      if (load < bestScore) { bestScore = load; best = free; }
    }
    return best;
  }

  reserve(ped) {
    const s = this.freeBoothSpot() ?? this.lounge.find((x) => x.state === 'free');
    s.state = 'coming';
    s.ped = ped;
    return s;
  }

  // ---------- מחזור חיים של לקוח ----------
  arrive(s) {
    const ped = s.ped;
    s.since = this.time;
    if (s.kind === 'lounge') {
      s.state = 'lounge';
      s.patience = s.maxPatience = this.g.loungePatience();
      ped.faceYaw(0);
      ped.setPose('eat');
      ped.talk(0.5);
      ped.cakePiece = mesh(G.rbox(0.09, 0.06, 0.09, 0.02), 0xd4a373);
      ped.cakePiece.position.set(0, -0.38, 0.06);
      ped.joints.elbowR.add(ped.cakePiece);
      s.tag = this.g.ui.waitTag(() => ped.worldPoint(ped.head, V(0, 0.55, 0)), '🍰');
      return;
    }
    s.state = 'waiting';
    s.patience = s.maxPatience = this.g.patienceTime();
    ped.faceYaw(0);
    s.tag = this.g.ui.waitTag(() => ped.worldPoint(ped.head, V(0, 0.55, 0)), '⏳');
  }

  start(s) {
    const b = s.booth;
    s.tag?.remove();
    s.state = 'serving';
    b.serving.push(s);
    s.progress = 0;
    s.rig = new TefillinRig(s.ped, s.ped.data.lefty ? -1 : 1);
    b.shliach.faceTowards(s.pos.x, s.pos.z);
    b.shliach.talk(1.2);
    s.tag = this.g.ui.progressTag(() => s.ped.worldPoint(s.ped.head, V(0, 0.75, 0)));
    this.g.audio.sfx('pop');
  }

  // מעבירים לקוח מפינת העוגה למקום שהתפנה בדוכן
  promote(ls) {
    const target = this.freeBoothSpot();
    if (!target) return;
    const ped = ls.ped;
    ls.tag?.remove();
    ls.tag = null;
    ls.ped = null;
    ls.state = 'free';
    ped.setPose('normal');
    ped.cakePiece?.removeFromParent();
    target.state = 'coming';
    target.ped = ped;
    ped.spot = target;
    this.g.walkTo(ped, target.pos, 2.4).then(() => this.arrive(target));
  }

  // אחרי קנס: הדוכן סגור – השליח לא מניח עד שנפתח שוב
  closeBooth(b, seconds) {
    b.closedUntil = this.time + seconds;
    b.closedTag?.remove();
    b.closedTag = this.g.ui.addTag(() => V(b.x, 2.2, -2.3), 'tag-closed', '🚫 סגור');
  }
  isClosed(b) { return this.time < b.closedUntil; }

  // השלב נגמר באמצע (נגמרו הלבבות): כולם הולכים הביתה
  clearAll() {
    for (const s of this.allSpots) {
      if (s.state === 'free') continue;
      const ped = s.ped;
      this.release(s);
      if (ped) {
        ped.setPose('normal');
        this.g.leave(ped);
      }
    }
    for (const b of this.booths) {
      b.closedUntil = 0;
      b.closedTag?.remove();
      b.closedTag = null;
    }
  }

  release(s) {
    s.tag?.remove();
    s.tag = null;
    s.ped?.tankTag?.remove();
    s.ped?.cakePiece?.removeFromParent();
    s.rig?.dispose();
    s.rig = null;
    const b = s.booth;
    if (b?.serving.includes(s)) {
      b.serving = b.serving.filter((x) => x !== s);
      const other = b.serving[0];
      if (other) b.shliach.faceTowards(other.pos.x, other.pos.z);
      else b.shliach.faceYaw(0.2);
    }
    s.ped = null;
    s.state = 'free';
  }

  // ---------- עדכון ----------
  update(dt) {
    this.time += dt;
    for (const s of this.allSpots) {
      const free = s.state === 'free';
      s.disc.material.opacity = free ? 0.3 + Math.sin(this.time * 5) * 0.12 : 0.12;
      s.ring.material.color.set(free ? s.color : 0x4fb3ff);
    }

    // פינת העוגה: הוותיק ביותר עובר ראשון לדוכן
    const waitingLounge = this.lounge.filter((s) => s.state === 'lounge').sort((a, b) => a.since - b.since);
    for (const ls of waitingLounge) {
      if (!this.freeBoothSpot()) break;
      this.promote(ls);
    }

    for (const b of this.booths) {
      if (b.closedTag && !this.isClosed(b)) {
        b.closedTag.remove();
        b.closedTag = null;
      }
      // השליח מתחיל להניח לבא בתור, כל עוד יש לו זוג תפילין פנוי
      while (b.serving.length < b.pairs && !b.pigeon && !this.isClosed(b)) {
        const next = b.spots.filter((s) => s.state === 'waiting').sort((a, c) => a.since - c.since)[0];
        if (!next) break;
        this.start(next);
      }
    }

    for (const s of this.allSpots) {
      if (s.state === 'waiting' || s.state === 'lounge') {
        s.patience -= dt;
        s.tag.set(s.patience / s.maxPatience);
        if (s.patience <= 0) this.g.onGiveUp(s);
      } else if (s.state === 'serving') {
        if (s.booth.pigeon || this.isClosed(s.booth)) continue; // יונה על השולחן או דוכן סגור
        s.progress = Math.min(1, s.progress + dt / this.g.serveTime());
        s.rig.setProgress(s.progress);
        s.tag.set(s.progress);
        if (s.progress >= 1) this.g.onServed(s);
      }
    }

    for (const b of this.booths) if (b.shliach !== this.g.mendy) b.shliach.update(dt);
  }
}
