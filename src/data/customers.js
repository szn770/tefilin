// סוגי עוברים ושבים.
// taps = כמה לחיצות צריך כדי לשכנע. penalty = אסור לקרוא לו להניח תפילין (מוריד נקודות).

const SKINS = [0xf6d2b4, 0xeec19b, 0xd9a47a, 0xb97f55, 0x8d5a3b, 0xffe0c7];
const HAIR = [0x2b1d14, 0x4a2f1c, 0x6b4426, 0x1a1a1a, 0x8a5a2b, 0xc98c3c];
const SHIRTS = [0xff7b54, 0x4fb3ff, 0x7ed957, 0xffd166, 0xc77dff, 0xff5d8f, 0x2ec4b6, 0xf4f1de];
const PANTS = [0x2f3e64, 0x3d3d3d, 0x6b4f3a, 0x41597a, 0x55616e];
const MODEST = [0x355070, 0x6d597a, 0x8d6e63, 0x2a9d8f, 0x5c6b73, 0xb5838d, 0x264653];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

export const PED_TYPES = {
  regular: {
    taps: 1, points: 10, speed: [1.1, 1.5], voice: 'man', callLine: 'c_ok',
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS),
      hat: pick(['none', 'none', 'cap', 'kippa']), beard: chance(0.25), glasses: chance(0.3), backpack: chance(0.35),
    }),
  },
  soldier: {
    taps: 1, points: 10, speed: [1.2, 1.5], voice: 'man2', callLine: 's_sure',
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: 0x5b6b3a, pants: 0x5b6b3a, hat: 'beret',
      beret: pick([0x6b2d5c, 0x3d5a1f, 0x8a1c1c, 0x2f4f8f]), backpack: true, backpackColor: 0x4a5530,
    }),
  },
  grandpa: {
    taps: 1, points: 20, speed: [0.6, 0.8], voice: 'oldman', callLine: 'g_long',
    look: () => ({
      skin: pick(SKINS.slice(0, 4)), hair: 0xe8e8e8, shirt: pick([0xc9b79c, 0x9fb4c7, 0xd8c3a5]),
      pants: pick([0x6b5d4f, 0x4f5b66]), hat: 'flatcap', hatColor: 0x6e5a44, beard: true, beardColor: 0xf0f0f0,
      glasses: true, cane: true, bald: true,
    }),
  },
  rushed: {
    taps: 3, points: 15, speed: [1.9, 2.3], voice: 'man2', callLine: 'c_rush2', tapLine: 'c_rush', icon: '📱', pose: 'phone',
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: 0xffffff, jacket: pick([0x2d2d3a, 0x34495e, 0x3b3b3b]),
      pants: 0x2d2d3a, tie: pick([0xd62828, 0x1d3a8a, 0x2a9d8f]), hat: 'none', glasses: chance(0.4), phone: true,
    }),
  },
  runner: {
    taps: 5, points: 25, speed: [2.6, 3.0], voice: 'man2', callLine: 'c_rush2', tapLine: 'c_rush', icon: '⏰',
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: 0xffffff, jacket: pick([0x5a3b22, 0x2d2d3a]),
      pants: 0x2d2d3a, tie: 0xd62828, hat: 'none', briefcase: true,
    }),
  },
  // "קרקפתא" – יהודי שעוד לא הניח תפילין אף פעם. שווה הרבה נחת!
  first: {
    taps: 4, points: 50, speed: [1.5, 1.9], voice: 'man', callLine: 'f_first', tapLine: 'f_hmm', icon: '⭐', firstTime: true,
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: pick([0xff5d8f, 0x2ec4b6, 0xffd166, 0xff7b54]), pants: pick(PANTS),
      hat: 'cap', capColor: pick([0xd62828, 0x1d3a8a, 0x111111]), glasses: true, backpack: chance(0.5),
    }),
  },
  woman: {
    penalty: true, line: 'w_no', speed: [1.0, 1.4], voice: 'woman',
    look: () => {
      const married = chance(0.5);
      return {
        skin: pick(SKINS), hair: pick(HAIR), shirt: pick(MODEST), skirt: pick(MODEST),
        hat: married ? 'tichel' : 'none', hatColor: pick([0x6d597a, 0x264653, 0xb5838d, 0x1d3a8a, 0x8d6e63]),
        longHair: true, bag: true, bagColor: pick([0xe76f51, 0xf4a261, 0x264653]), female: true,
      };
    },
  },
  // ילד לפני בר מצווה – עוד לא מניחים תפילין
  kid: {
    penalty: true, line: 'k_young', speed: [1.3, 1.7], voice: 'man', scale: 0.7,
    look: () => ({
      skin: pick(SKINS), hair: pick(HAIR), shirt: pick(SHIRTS), pants: pick(PANTS),
      hat: pick(['cap', 'kippa']), backpack: true, backpackColor: pick(SHIRTS),
    }),
  },
};

export const INSPECTOR_LOOK = {
  skin: 0xeec19b, hair: 0x2b1d14, shirt: 0x2f4f8f, pants: 0x1f2f55, hat: 'peaked', hatColor: 0x1f2f55,
  badge: true, clipboard: true, glasses: true,
};

// הרכב הקהל לפי השלב: כל שלב יותר ממהרים, ומ"שלב הקרקפתא" גם כוכבים
export function weightsFor(level) {
  const n = level.index;
  return {
    regular: 38,
    soldier: 12,
    grandpa: 9,
    rushed: 12 + Math.min(n, 6) * 3,
    runner: level.has('runner') ? 5 + Math.min(n, 8) * 2 : 0,
    first: level.has('first') ? 6 : 0,
    woman: 15,
    kid: 8,
  };
}

export function randomTypeId(level) {
  const entries = Object.entries(weightsFor(level));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'regular';
}

export function makePedData(typeId) {
  const type = PED_TYPES[typeId];
  return {
    typeId,
    type,
    look: type.look(),
    lefty: Math.random() < 0.25,
    speed: type.speed[0] + Math.random() * (type.speed[1] - type.speed[0]),
    scale: type.scale ?? 0.95 + Math.random() * 0.1,
  };
}
