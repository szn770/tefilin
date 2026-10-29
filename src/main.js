import * as THREE from 'three';
import './style.css';
import { World } from './world/world.js';
import { UI } from './ui/ui.js';
import { GameAudio } from './audio/audio.js';
import { FX } from './engine/fx.js';
import { updateTweens } from './engine/tween.js';
import { Game } from './game/game.js';
import { OnlineUI } from './ui/online-ui.js';
import { ContactUI } from './ui/contact.js';

async function boot() {
  // הפונטים חייבים להיטען לפני שמציירים שלטים בעברית על קנבס
  try {
    await Promise.all([
      document.fonts.load('150px "Secular One"', 'מבצע תפילין'),
      document.fonts.load('700 20px "Rubik"', 'שלום'),
    ]);
  } catch { /* ממשיכים עם פונט ברירת מחדל */ }

  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9ecff, 30, 90);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);

  const world = new World(scene);
  const ui = new UI(camera, canvas);
  const audio = new GameAudio();
  const fx = new FX(scene);
  const game = new Game({ scene, camera, ui, audio, world, fx, canvas });
  const online = new OnlineUI();
  game.onLevelEnd = (result) => online.levelEnded(result);
  new ContactUI();

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // במסך צר (נייד לאורך) מרחיקים מעט את השדה
    camera.fov = w / h < 0.9 ? 62 : 45;
    camera.updateProjectionMatrix();
    game.frameCamera(true);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- קלט ----
  const toPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return { x, y, ndc: new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    try { canvas.setPointerCapture(e.pointerId); } catch { /* אירוע סינתטי */ }
    game.onDown(toPointer(e));
  });
  canvas.addEventListener('pointermove', (e) => game.onMove(toPointer(e)));
  canvas.addEventListener('pointerup', (e) => game.onUp(toPointer(e)));
  canvas.addEventListener('pointercancel', (e) => game.onUp(toPointer(e)));

  const muteBtn = document.getElementById('btn-mute');
  muteBtn.onclick = () => {
    audio.setMuted(!audio.muted);
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
  };
  document.getElementById('btn-nigun').onclick = () => game.perks.useNigun();
  document.getElementById('btn-flyers').onclick = () => game.perks.useFlyers();
  // בלי זה, ב-iPhone הכפתורים לא נראים לחוצים כשנוגעים בהם
  document.addEventListener('touchstart', () => {}, { passive: true });

  // ---- הפסקה: התפריט באמצע המשחק. הכול קופא, גם השמש והשעון ----
  let paused = false;
  const setPaused = (on) => {
    paused = on;
    document.getElementById('screen-pause').classList.toggle('hidden', !on);
    if (audio.ctx) (on ? audio.ctx.suspend() : audio.ctx.resume()).catch(() => {});
  };
  document.getElementById('btn-pause').onclick = () => setPaused(true);
  document.getElementById('btn-resume').onclick = () => setPaused(false);
  // ההתקדמות נשמרת בסוף כל שלב, ולכן במסך הפתיחה אפשר להמשיך מתחילת השלב הנוכחי
  document.getElementById('btn-home').onclick = () => { location.href = location.pathname; };
  // מי שעובר ללשונית או לאפליקציה אחרת באמצע שלב, חוזר למשחק עצור
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'day') setPaused(true);
  });

  // ---- לולאה ----
  const clock = new THREE.Clock();
  const frame = (dt) => {
    if (!paused) {
      updateTweens(dt);
      game.update(dt);
      world.update(dt);
      fx.update(dt);
    }
    ui.update(paused ? 0 : dt);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 1 / 20)));

  // לגישה מהקונסול בזמן פיתוח: __step(n) מקדם n פריימים גם כשהלשונית מוסתרת
  window.__game = game;
  const yieldTask = () => new Promise((r) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = r;
    ch.port2.postMessage(0);
  });
  window.__step = async (n = 30, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      frame(dt);
      await yieldTask();
    }
    clock.getDelta();
  };

  // ?quick – דילוג על מסך הפתיחה, ?level=N – קפיצה לשלב (לפיתוח)
  const params = new URLSearchParams(location.search);
  const started = ui.waitStart(game.hasSave ? game.levelIndex + 1 : 0);
  if (params.has('quick')) document.getElementById(game.hasSave ? 'btn-continue' : 'btn-start').click();
  const choice = await started;
  if (choice === 'new' && game.hasSave) return game.resetProgress();
  await audio.init();
  audio.loop('sfx/street', 0.35);
  audio.loop('music/theme', 0.5);
  const jump = parseInt(params.get('level'), 10);
  game.beginLevel(Number.isFinite(jump) ? jump - 1 : game.levelIndex);
}

boot();
