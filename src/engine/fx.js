import * as THREE from 'three';

// קונפטי ולבבות – חלקיקים פשוטים
const COLORS = [0xffc531, 0x4fb3ff, 0xff5d8f, 0x7ed957, 0xffffff, 0xc77dff];
const geo = new THREE.PlaneGeometry(0.05, 0.03);

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.mats = COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, transparent: true }));
  }

  confetti(pos, count = 50, power = 2.2) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, this.mats[i % this.mats.length].clone());
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 0.8;
      m.userData = {
        v: new THREE.Vector3(Math.cos(a) * power * Math.random(), up * power, Math.sin(a) * power * Math.random()),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 1.6 + Math.random() * 0.8,
      };
      m.scale.setScalar(1 + Math.random());
      this.scene.add(m);
      this.parts.push(m);
    }
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      const u = p.userData;
      u.life -= dt;
      u.v.y -= 4.5 * dt;
      u.v.multiplyScalar(1 - dt * 1.5);
      p.position.addScaledVector(u.v, dt);
      p.rotation.x += u.spin.x * dt;
      p.rotation.y += u.spin.y * dt;
      p.rotation.z += u.spin.z * dt;
      p.material.opacity = Math.min(1, u.life * 2);
      if (u.life <= 0) {
        this.scene.remove(p);
        p.material.dispose();
        this.parts.splice(i, 1);
      }
    }
  }
}
