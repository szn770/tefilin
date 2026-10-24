import * as THREE from 'three';
import { mesh, G, toon, textTexture } from '../engine/materials.js';

const SKY = {
  noon: { top: new THREE.Color(0x3fa9f5), bottom: new THREE.Color(0xc9ecff), sun: new THREE.Color(0xfff3dc), sunI: 2.6, hemi: 1.15 },
  sunset: { top: new THREE.Color(0x3b3f8f), bottom: new THREE.Color(0xff9a5c), sun: new THREE.Color(0xff8c4a), sunI: 1.6, hemi: 0.75 },
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildBuildings();
    this.buildStreetProps();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(120, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: SKY.noon.top.clone() },
        bottom: { value: SKY.noon.bottom.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y * 1.6 + 0.15, 0.0, 1.0);
          gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, this.skyMat);
    sky.renderOrder = -1;
    this.scene.add(sky);

    // עננים מצוירים
    const cloudMat = toon(0xffffff, { unique: true });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = new THREE.Mesh(G.sphere(1, 14, 10), cloudMat);
        s.position.set(j * 1.3 - n * 0.6, Math.random() * 0.6, Math.random() * 0.6);
        s.scale.setScalar(1 + Math.random() * 0.8);
        c.add(s);
      }
      c.position.set(-50 + Math.random() * 100, 18 + Math.random() * 10, -45 - Math.random() * 25);
      c.userData.speed = 0.3 + Math.random() * 0.5;
      this.scene.add(c);
      this.clouds.push(c);
    }
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdff3ff, 0x9a8a70, SKY.noon.hemi);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff3dc, SKY.noon.sunI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -16; c.right = 16; c.top = 12; c.bottom = -10; c.near = 1; c.far = 60;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    sun.target.position.set(0, 0, -2);
    this.sun = sun;
    this.setDayProgress(0);
  }

  // progress: 0 = צהריים, 1 = שקיעה
  setDayProgress(p) {
    const a = SKY.noon, b = SKY.sunset;
    const t = Math.pow(p, 1.6);
    this.skyMat.uniforms.top.value.copy(a.top).lerp(b.top, t);
    this.skyMat.uniforms.bottom.value.copy(a.bottom).lerp(b.bottom, t);
    this.sun.color.copy(a.sun).lerp(b.sun, t);
    this.sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, t);
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemi, b.hemi, t);
    const ang = THREE.MathUtils.lerp(1.15, 0.22, p);
    this.sun.position.set(-14 * Math.cos(ang) - 4, 22 * Math.sin(ang) + 2, 14);
    if (this.scene.fog) this.scene.fog.color.copy(this.skyMat.uniforms.bottom.value);
  }

  buildGround() {
    // כביש
    const road = mesh(G.box(80, 0.1, 14), 0x5a5f6b, { outline: false, shadow: false, receive: true });
    road.position.set(0, -0.06, 10);
    this.scene.add(road);
    // פסים
    for (let x = -36; x < 40; x += 4) {
      const line = mesh(G.box(2, 0.02, 0.18), 0xf4f1de, { outline: false, shadow: false, receive: true });
      line.position.set(x, 0, 9);
      this.scene.add(line);
    }
    // שפת מדרכה
    const curb = mesh(G.box(80, 0.18, 0.35), 0xd8d2c4, { outline: false, receive: true });
    curb.position.set(0, 0.02, 2.9);
    this.scene.add(curb);
    // מדרכה – אריחים בטקסטורה
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#e9dcc2';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ddcdb0';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillRect(64, 64, 64, 64);
    ctx.strokeStyle = '#cbb894';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
    const tex = new THREE.CanvasTexture(tile);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 6);
    const walk = new THREE.Mesh(G.box(80, 0.1, 12), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon(0xffffff).gradientMap }));
    walk.position.set(0, -0.05, -3.1);
    walk.receiveShadow = true;
    this.scene.add(walk);
  }

  buildBuildings() {
    // בתי אבן ירושלמית עם חנויות
    const stones = [0xf1e3c6, 0xe9d6b1, 0xf5e8cf, 0xe3cfa6];
    const shops = [
      { name: 'פלאפל', color: '#e76f51' }, { name: 'מכולת', color: '#2a9d8f' },
      { name: 'ספרים', color: '#6d597a' }, { name: 'פיצה', color: '#e9c46a' },
      { name: 'מאפייה', color: '#bc6c25' }, { name: 'פרחים', color: '#ff70a6' },
      { name: 'משקפיים', color: '#457b9d' }, { name: 'גלידה', color: '#f28482' },
    ];
    let x = -26;
    let i = 0;
    while (x < 26) {
      const w = 4 + Math.random() * 2.5;
      const h = 6 + Math.random() * 6;
      const b = new THREE.Group();
      const body = mesh(G.box(w, h, 4), stones[i % stones.length], { outline: false, receive: true });
      body.position.y = h / 2;
      b.add(body);
      // חלונות
      const floors = Math.floor((h - 3) / 2.2);
      const cols = Math.max(1, Math.floor(w / 1.6));
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const wx = -w / 2 + (c + 0.5) * (w / cols);
          const wy = 4 + f * 2.2;
          const frame = mesh(G.rbox(0.9, 1.2, 0.12, 0.05), 0x7aa6c2, { outline: false, shadow: false });
          frame.position.set(wx, wy, 2.02);
          b.add(frame);
          const shutter = mesh(G.box(0.12, 1.2, 0.06), 0x3f7d5a, { outline: false, shadow: false });
          shutter.position.set(wx - 0.55, wy, 2.03);
          b.add(shutter);
          if (Math.random() < 0.3) {
            const balc = mesh(G.box(1.3, 0.12, 0.6), 0xd6c39c, { outline: false });
            balc.position.set(wx, wy - 0.7, 2.3);
            b.add(balc);
          }
        }
      }
      // חזית חנות
      const shop = shops[i % shops.length];
      const glass = mesh(G.box(w * 0.75, 2.1, 0.1), 0x9fd3e6, { outline: false, shadow: false });
      glass.position.set(0, 1.25, 2.02);
      b.add(glass);
      const awningColor = new THREE.Color(shop.color).getHex();
      const awning = mesh(G.box(w * 0.85, 0.12, 1.1), awningColor, { outline: false });
      awning.position.set(0, 2.6, 2.5);
      awning.rotation.x = 0.25;
      b.add(awning);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.7, 0.7),
        new THREE.MeshBasicMaterial({ map: textTexture(shop.name, { bg: shop.color, size: 150, border: '#ffffff', borderWidth: 14 }), toneMapped: false }),
      );
      sign.position.set(0, 3.25, 2.08);
      b.add(sign);
      b.position.set(x + w / 2, 0, -11);
      this.scene.add(b);
      x += w + 0.15;
      i++;
    }
  }

  buildStreetProps() {
    // עצים בעציצים ופנסי רחוב
    const treeSpots = [-11, -6.5, 5, 10.5];
    for (const tx of treeSpots) {
      const pot = mesh(G.cyl(0.45, 0.35, 0.6, 14), 0xb5652b);
      pot.position.set(tx, 0.3, -7.2);
      const trunk = mesh(G.cyl(0.09, 0.12, 1.6, 8), 0x7a4b2a);
      trunk.position.set(tx, 1.3, -7.2);
      const crown = mesh(G.sphere(1, 16, 12), 0x5cbf5a);
      crown.position.set(tx, 2.6, -7.2);
      crown.scale.set(1.1, 0.95, 1.1);
      const crown2 = mesh(G.sphere(0.7, 14, 10), 0x6fd16a);
      crown2.position.set(tx + 0.5, 2.9, -6.9);
      this.scene.add(pot, trunk, crown, crown2);
    }
    for (const lx of [-8.5, 8]) {
      const pole = mesh(G.cyl(0.07, 0.09, 4, 10), 0x2f3e46);
      pole.position.set(lx, 2, 2.4);
      const arm = mesh(G.cyl(0.04, 0.04, 0.8, 8), 0x2f3e46);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(lx + 0.35, 3.95, 2.4);
      const lamp = mesh(G.sphere(0.2, 12, 10), 0xfff2b3);
      lamp.position.set(lx + 0.7, 3.85, 2.4);
      this.scene.add(pole, arm, lamp);
    }
    // ספסל
    const bench = new THREE.Group();
    const seat = mesh(G.rbox(1.8, 0.1, 0.5, 0.03), 0xb07a4a);
    seat.position.y = 0.5;
    const back = mesh(G.rbox(1.8, 0.45, 0.08, 0.03), 0xb07a4a);
    back.position.set(0, 0.85, -0.22);
    for (const s of [-0.75, 0.75]) {
      const leg = mesh(G.box(0.08, 0.5, 0.45), 0x2f3e46);
      leg.position.set(s, 0.25, 0);
      bench.add(leg);
    }
    bench.add(seat, back);
    bench.position.set(7.2, 0, -7.4);
    this.scene.add(bench);
  }

  update(dt) {
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 60) c.position.x = -60;
    }
  }
}
