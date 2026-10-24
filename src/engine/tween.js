// מנהל אנימציות קטן שרץ על שעון המשחק
const active = [];

export const ease = {
  linear: (t) => t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function tween(duration, fn, easing = ease.out) {
  return new Promise((resolve) => {
    active.push({ t: 0, duration: Math.max(0.0001, duration), fn, easing, resolve });
    fn(0);
  });
}

export const wait = (seconds) => tween(seconds, () => {});

export function updateTweens(dt) {
  for (let i = active.length - 1; i >= 0; i--) {
    const a = active[i];
    a.t += dt;
    const k = Math.min(1, a.t / a.duration);
    a.fn(a.easing(k));
    if (k >= 1) {
      active.splice(i, 1);
      a.resolve();
    }
  }
}
