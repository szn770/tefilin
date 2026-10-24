import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---- חומרי טון (מראה מצויר) ----
let gradientTex = null;
function gradientMap() {
  if (gradientTex) return gradientTex;
  const data = new Uint8Array([110, 185, 255]);
  gradientTex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  gradientTex.minFilter = THREE.NearestFilter;
  gradientTex.magFilter = THREE.NearestFilter;
  gradientTex.needsUpdate = true;
  return gradientTex;
}

const toonCache = new Map();
export function toon(color, { unique = false, ...extra } = {}) {
  const key = `${color}`;
  if (!unique && !Object.keys(extra).length && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
  if (!unique && !Object.keys(extra).length) toonCache.set(key, m);
  return m;
}

// ---- קו מתאר (inverted hull) בעובי קבוע על המסך ----
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { color: { value: new THREE.Color(0x231a33) }, thickness: { value: 0.0045 } },
  vertexShader: /* glsl */ `
    uniform float thickness;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      mv.xyz += n * thickness * max(-mv.z, 0.6);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    void main() { gl_FragColor = vec4(color, 1.0); }`,
  side: THREE.BackSide,
});

const noRaycast = () => {};

export function addOutline(mesh) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.raycast = noRaycast;
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

// ---- יצירת רשת מהירה ----
export function mesh(geo, color, { outline = true, shadow = true, receive = false, material } = {}) {
  const m = new THREE.Mesh(geo, material || toon(color));
  m.castShadow = shadow;
  m.receiveShadow = receive;
  if (outline) addOutline(m);
  return m;
}

// גאומטריות נפוצות (משותפות לחיסכון)
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export const G = {
  sphere: (r = 1, w = 20, h = 14) => cached(`s${r}-${w}-${h}`, () => new THREE.SphereGeometry(r, w, h)),
  capsule: (r, len, cap = 6, rad = 14) => cached(`c${r}-${len}-${cap}-${rad}`, () => new THREE.CapsuleGeometry(r, len, cap, rad)),
  cyl: (rt, rb, h, seg = 16) => cached(`y${rt}-${rb}-${h}-${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  rbox: (w, h, d, r = 0.04) => cached(`r${w}-${h}-${d}-${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01))),
  box: (w, h, d) => cached(`b${w}-${h}-${d}`, () => new THREE.BoxGeometry(w, h, d)),
  torus: (r, t, rs = 10, ts = 28, arc = Math.PI * 2) => cached(`t${r}-${t}-${rs}-${ts}-${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
};

// ---- טקסטורת טקסט עברי על קנבס ----
export function textTexture(text, {
  width = 1024, height = 256, font = 'Secular One', size = 150, color = '#ffffff',
  bg = null, stroke = null, strokeWidth = 0, radius = 40, border = null, borderWidth = 0,
} = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    roundRect(ctx, borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth, radius);
    ctx.fill();
    if (border) {
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = border;
      ctx.stroke();
    }
  }
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px "${font}"`;
  if (stroke) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, width / 2, height / 2 + size * 0.06);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2 + size * 0.06);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
