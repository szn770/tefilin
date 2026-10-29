import * as THREE from 'three';
import { TEFILLIN_ICON, TEFILLIN_SHAPES } from './icons.js';

const $ = (id) => document.getElementById(id);
const tmp = new THREE.Vector3();

export class UI {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.bubbles = [];
    this.tags = new Set();
    this.tagSeq = 0;
    for (const el of document.querySelectorAll('[data-icon="tefillin"]')) el.innerHTML = TEFILLIN_ICON;
  }

  project(world) {
    tmp.copy(world).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (tmp.x * 0.5 + 0.5) * r.width,
      y: (-tmp.y * 0.5 + 0.5) * r.height,
      visible: tmp.z < 1,
    };
  }

  place(el, world) {
    const p = this.project(world);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.display = p.visible ? '' : 'none';
  }

  // ---- בועות דיבור ----
  bubble(text, anchorFn, { cls = '', duration = 2 } = {}) {
    const el = document.createElement('div');
    el.className = `bubble ${cls}`;
    el.textContent = text;
    $('bubbles').appendChild(el);
    const b = { el, anchorFn, life: duration };
    this.bubbles.push(b);
    this.place(el, anchorFn());
    return b;
  }

  // ---- תגיות שצמודות לדמות: לחיצות שנשארו / המתנה / התקדמות ----
  addTag(anchorFn, cls, html) {
    const el = document.createElement('div');
    el.className = `tag ${cls}`;
    el.innerHTML = html;
    $('tags').appendChild(el);
    const tag = { el, anchorFn, remove: () => { el.remove(); this.tags.delete(tag); } };
    this.tags.add(tag);
    this.place(el, anchorFn());
    return tag;
  }
  tapsTag(anchorFn, icon, count) {
    const t = this.addTag(anchorFn, 'tag-taps', `<span>${icon}</span><b>${count}</b>`);
    t.set = (n) => {
      t.el.querySelector('b').textContent = n;
      t.el.classList.remove('hit');
      void t.el.offsetWidth;
      t.el.classList.add('hit');
    };
    return t;
  }
  waitTag(anchorFn, icon = '⏳') {
    const t = this.addTag(anchorFn, 'tag-wait', `<span>${icon}</span><div class="bar"><i></i></div>`);
    const fill = t.el.querySelector('i');
    t.set = (f) => {
      fill.style.width = `${Math.max(0, f) * 100}%`;
      fill.style.background = f > 0.5 ? '#3cc56b' : f > 0.25 ? '#ffc531' : '#ff5b5b';
    };
    return t;
  }
  // תפילין של ראש מעל מי שמניח: מתמלאות בצבע מלמטה למעלה, עד שמסיימים
  progressTag(anchorFn) {
    const clip = `tfl-fill-${++this.tagSeq}`;
    const t = this.addTag(anchorFn, 'tag-prog', `
      <svg viewBox="0 0 44 44">
        <defs><clipPath id="${clip}"><rect class="level" x="0" y="44" width="44" height="44"/></clipPath></defs>
        <circle class="badge" cx="22" cy="22" r="20"/>
        <g class="empty">${TEFILLIN_SHAPES}</g>
        <g class="full" clip-path="url(#${clip})">${TEFILLIN_SHAPES}</g>
      </svg>`);
    const level = t.el.querySelector('.level');
    t.set = (f) => level.setAttribute('y', 44 * (1 - Math.max(0, Math.min(1, f))));
    return t;
  }

  update(dt) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life -= dt;
      if (b.life <= 0) {
        b.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      this.place(b.el, b.anchorFn());
      b.el.style.opacity = Math.min(1, b.life * 4);
    }
    for (const t of this.tags) this.place(t.el, t.anchorFn());
  }

  clearOverlays() {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
    for (const t of [...this.tags]) t.remove();
  }

  // ---- כותרת ----
  banner(step, hint = '', seconds = 0) {
    const el = $('banner');
    el.classList.add('hidden');
    void el.offsetWidth;
    $('banner-step').textContent = step;
    $('banner-hint').textContent = hint;
    el.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    if (seconds) this.bannerTimer = setTimeout(() => this.hideBanner(), seconds * 1000);
  }
  hideBanner() { $('banner').classList.add('hidden'); }

  // ---- הודעות קופצות ----
  popup(text, x, y, cls = 'good') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  popupAt(text, world, cls = 'good') {
    const p = this.project(world);
    this.popup(text, p.x, p.y, cls);
  }

  // ---- HUD ----
  showHud(on) { $('hud').classList.toggle('hidden', !on); }
  setScore(n) {
    $('nachat-val').textContent = n;
    bump($('hud-nachat'));
  }
  setGoal(done, goal) {
    $('goal-val').textContent = `${done}/${goal}`;
    $('hud-goal').classList.toggle('met', done >= goal);
  }
  setSeats(used, total) {
    $('seats-val').textContent = `${used}/${total}`;
    $('hud-seats').classList.toggle('full', used >= total);
  }
  flashSeats() { bump($('hud-seats')); }
  setCombo(mult) {
    const el = $('hud-combo');
    el.classList.toggle('hidden', mult <= 1);
    $('combo-val').textContent = `x${mult}`;
    if (mult > 1) bump(el);
  }
  setLevel(number, name) {
    $('level-val').textContent = `שלב ${number}`;
    $('level-name').textContent = name;
  }
  setHearts(n, max) {
    const el = $('hud-hearts');
    $('hearts-val').textContent = '❤️'.repeat(n) + '🤍'.repeat(Math.max(0, max - n));
    el.classList.toggle('low', n <= 1);
    bump(el);
  }
  setFlyers(count) {
    const btn = $('btn-flyers');
    btn.classList.toggle('hidden', count <= 0);
    $('flyers-val').textContent = count;
  }
  setTrash(count, dirty) {
    const el = $('hud-trash');
    el.classList.toggle('hidden', count === 0);
    el.classList.toggle('dirty', dirty);
    $('trash-val').textContent = count;
  }
  // כפתור הניגון: ready = 0..1 (טעינה), active = מתנגן עכשיו
  setNigun(owned, ready, active) {
    const btn = $('btn-nigun');
    btn.classList.toggle('hidden', !owned);
    if (!owned) return;
    btn.classList.toggle('ready', ready >= 1);
    btn.classList.toggle('active', active);
    $('nigun-fill').style.height = `${(1 - ready) * 100}%`;
  }
  setSun(p) {
    $('sun-fill').style.width = `${p * 100}%`;
    $('sun-icon').style.right = `${p * 100}%`;
    $('sun-icon').textContent = p > 0.85 ? '🌅' : '☀️';
    $('sun-label').textContent = p >= 1 ? 'השמש שקעה' : 'עד השקיעה';
  }

  // ---- מסכים ----
  // מחזיר 'continue' או 'new'
  waitStart(savedLevel) {
    const cont = $('btn-continue');
    cont.classList.toggle('hidden', !savedLevel);
    if (savedLevel) cont.textContent = `המשך משלב ${savedLevel} ←`;
    $('btn-start').textContent = savedLevel ? 'משחק חדש' : 'יאללה, מתחילים!';
    $('btn-start').classList.toggle('secondary', !!savedLevel);
    return new Promise((resolve) => {
      const done = (choice) => {
        $('screen-start').classList.add('hidden');
        resolve(choice);
      };
      $('btn-start').onclick = () => done('new');
      cont.onclick = () => done('continue');
    });
  }

  // כרטיס פתיחה לשלב – מה חדש בו
  showIntro(level) {
    $('intro-level').textContent = `שלב ${level.number}`;
    $('intro-name').textContent = level.name;
    $('intro-icon').textContent = level.intro.icon;
    $('intro-title').textContent = level.intro.title;
    $('intro-text').textContent = level.intro.text;
    $('intro-goal').textContent = `יעד: ${level.goal} הנחות תפילין לפני השקיעה`;
    const screen = $('screen-intro');
    screen.classList.remove('hidden');
    return new Promise((resolve) => {
      $('btn-go').onclick = () => {
        screen.classList.add('hidden');
        resolve();
      };
    });
  }

  // סוף שלב: כוכבים + חנות שדרוגים. items: [{icon, title, desc, level, cost, can, maxed, buy()}]
  showResults({ title, stars, summary, items: getItems, score: getScore, nextLabel }) {
    const screen = $('screen-shop');
    this.shopTab ??= 'stand';
    for (const t of document.querySelectorAll('.shop-tab')) {
      t.onclick = () => {
        this.shopTab = t.dataset.cat;
        render();
      };
    }
    $('result-title').textContent = title;
    $('result-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('');
    $('shop-summary').innerHTML = summary;
    $('btn-next').textContent = nextLabel;
    const tabs = [...document.querySelectorAll('.shop-tab')];
    const render = () => {
      $('shop-score').textContent = getScore();
      const all = getItems();
      // על כל לשונית: כמה דברים אפשר לקנות עכשיו
      for (const t of tabs) {
        const n = all.filter((it) => it.cat === t.dataset.cat && it.can).length;
        t.classList.toggle('active', t.dataset.cat === this.shopTab);
        t.querySelector('i').textContent = n ? n : '';
      }
      const list = $('shop-items');
      list.innerHTML = '';
      for (const it of all.filter((x) => x.cat === this.shopTab)) {
        const card = document.createElement('div');
        card.className = 'shop-card' + (it.maxed ? ' maxed' : '') + (it.locked ? ' locked' : '');
        const btnText = it.maxed ? 'מקסימום' : it.locked ? '🔒' : `💛 ${it.cost}`;
        card.innerHTML = `
          <div class="shop-icon">${it.icon}</div>
          <div class="shop-text"><b>${it.title}</b><small>${it.desc}</small><span class="lvl">${it.level}</span></div>
          <button class="shop-buy" ${it.maxed || !it.can ? 'disabled' : ''}>${btnText}</button>`;
        card.querySelector('button').onclick = () => {
          it.buy();
          render();
        };
        list.appendChild(card);
      }
    };
    render();
    screen.classList.remove('hidden');
    return new Promise((resolve) => {
      $('btn-next').onclick = () => {
        screen.classList.add('hidden');
        resolve();
      };
    });
  }
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}
