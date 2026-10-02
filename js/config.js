// 60 SECONDS: LAST DEFENSE — config
const W = 320, H = 180;

const CFG = {
  playerSpeed: 78,
  boostMul: 1.85,        // SHIFT + move = rocket boost
  playerHp: 100,
  playerLives: 3,        // chances per run
  playerRadius: 5,
  fireRate: 0.16,        // seconds between shots
  rapidFireRate: 0.06,
  bulletSpeed: 150,
  enemyBulletSpeed: 46,
  invulnTime: 1.2,
  shieldTime: 10,
  rapidTime: 8,
  tripleTime: 8,
  empRadius: 80,
  empBossDmg: 60,
  earthHp: 100,
  earthX: W / 2,
  earthY: H - 16,
  earthRadius: 18,
  comboWindow: 2.5,
  comboMax: 8,
  levelTime: 60,
  powerupDrop: 0.22,     // chance per kill
  powerupMax: 3,         // FIFO queue slots
};

const SCORE = { s: 100, m: 250, l: 500, alien: 750, boss: 5000 };
const AST_DMG = { s: 5, m: 10, l: 20 };          // vs Earth
const AST_PLAYER_DMG = { s: 8, m: 16, l: 35 };   // vs player — scales with size
const AST_HP  = { s: 1, m: 2, l: 6 };
const AST_R   = { s: 4, m: 7, l: 12 };

const LEVELS = {
  1: { name: 'FIRST CONTACT',
       sub: 'SURVIVE FOR 60 SECONDS',
       spawn: 1.6, speed: [10, 20], types: ['s','s','s','s','m'],
       aliens: false, alienEvery: 0, alienMax: 0 },
  2: { name: 'ASTEROID STORM',
       sub: 'SURVIVE FOR 60 SECONDS',
       spawn: 1.05, speed: [16, 30], types: ['s','s','s','m','m'],
       aliens: false, alienEvery: 0, alienMax: 0 },
  3: { name: 'COLLISION COURSE',
       sub: 'SURVIVE FOR 60 SECONDS',
       spawn: 0.9, speed: [18, 34], types: ['s','s','m','m','l'],
       aliens: false, alienEvery: 0, alienMax: 0 },
  4: { name: 'UNKNOWN SIGNAL',
       sub: 'SURVIVE FOR 60 SECONDS',
       spawn: 0.95, speed: [18, 34], types: ['s','s','m','m','l'],
       aliens: true, alienEvery: 5.5, alienMax: 3,
       announce: [[40, 'UNKNOWN SIGNAL DETECTED'], [30, 'HOSTILE CONTACT']] },
  5: { name: 'THE INVASION',
       sub: 'DESTROY THE MOTHERSHIP',
       spawn: 0.85, speed: [20, 38], types: [],   // no asteroids: mothership + alien escorts only
       aliens: false, alienEvery: 0, alienMax: 0, boss: true, bossAt: 45,
       announce: [[46, 'WARNING'], [45, 'UNKNOWN OBJECT DETECTED']] },
};

// Difficulty multipliers: spawn interval divisor, enemy speed, alien rate divisor,
// boss hp, and damage dealt to Earth.
const DIFFS = [
  { name: 'EASY',   spawn: 0.65, spd: 0.85, alien: 1.5,  boss: 0.75, edmg: 0.7, pdmg: 0.7 },
  { name: 'NORMAL', spawn: 0.85, spd: 0.92, alien: 1.15, boss: 0.9,  edmg: 0.85, pdmg: 0.85 },
  { name: 'HARD',   spawn: 1.5,  spd: 1.25, alien: 0.65, boss: 1.35, edmg: 1.5, pdmg: 1.4 },
];

const POWERUPS = ['shield', 'rapid', 'triple', 'emp'];
const PU_NAME = { shield: 'SHIELD', rapid: 'RAPID FIRE', triple: 'TRIPLE SHOT', emp: 'EMP' };
const PU_SPRITE = { shield: 'pw_shield', rapid: 'pw_rapid', triple: 'pw_triple', emp: 'pw_emp' };
const PU_COLOR = { shield: '#3af', rapid: '#f43', triple: '#4f4', emp: '#c4f' };
