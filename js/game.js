// GameManager: states, spawning, collisions, HUD, screens
const EXP_FRAMES = {
  small: ['expA_a', 'expA_b', 'expA_c', 'expA_d'],
  big:   ['exp1_a', 'exp1_b', 'exp1_c', 'exp1_d'],
  alien: ['expB_a', 'expB_b', 'expB_c', 'expB_d'],
  blue:  ['exp_blue_a', 'exp_blue_b', 'exp_blue_c'],
  purple:['exp_purple', 'exp_purple2'],
};

class Explosion {
  constructor(x, y, kind, scale = 1) {
    this.x = x; this.y = y; this.kind = kind;
    this.scale = scale; this.t = 0; this.dead = false;
    this.frames = EXP_FRAMES[kind] || EXP_FRAMES.small;
    this.frameDur = 0.09;
  }
  update(dt) {
    this.t += dt;
    if (this.t > this.frames.length * this.frameDur) this.dead = true;
  }
  draw(ctx) {
    const f = Math.min(this.frames.length - 1, (this.t / this.frameDur) | 0);
    const key = this.frames[f];
    const im = SPRITES[key];
    const s = (im ? Math.max(im.width, im.height) / 2 : 20) * this.scale; // sprites are 2x-res sources
    drawSprite(ctx, key, this.x, this.y, s, s);
  }
}

class Game {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = 'menu';
    this.level = 1;
    this.diff = 1;          // DIFFS index (0 easy, 1 normal, 2 hard)
    this.diffSel = 1;
    this.stars = [];
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        z: 0.3 + Math.random() * 0.7, tw: Math.random() * 7,
        sz: Math.random() < 0.35 ? 0.5 : 1,
        c: Math.random() < 0.15 ? '#9cf' : (Math.random() < 0.1 ? '#fc8' : '#dde'),
      });
    }
    // prerendered space background at 4x: vertical gradient + nebula blobs + vignette
    const BS = 4;
    this.bg = document.createElement('canvas');
    this.bg.width = W * BS; this.bg.height = H * BS;
    const b = this.bg.getContext('2d');
    const g = b.createLinearGradient(0, 0, 0, H * BS);
    g.addColorStop(0, '#04102e'); g.addColorStop(0.55, '#01061a'); g.addColorStop(1, '#020313');
    b.fillStyle = g; b.fillRect(0, 0, W * BS, H * BS);
    for (const [x, y, r, c] of [
      [90, 55, 110, 'rgba(64,40,140,0.30)'],
      [250, 40, 90, 'rgba(20,60,140,0.28)'],
      [300, 140, 100, 'rgba(120,30,110,0.22)'],
      [50, 150, 80, 'rgba(20,50,120,0.25)'],
    ]) {
      const rg = b.createRadialGradient(x * BS, y * BS, 0, x * BS, y * BS, r * BS);
      rg.addColorStop(0, c); rg.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = rg; b.fillRect(0, 0, W * BS, H * BS);
    }
    const vg = b.createRadialGradient(W * BS / 2, H * BS / 2, 60 * BS, W * BS / 2, H * BS / 2, 215 * BS);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.55)');
    b.fillStyle = vg; b.fillRect(0, 0, W * BS, H * BS);
    this.resetRun();
    this.stateT = 0;
  }

  resetRun() {
    this.score = 0; this.scoreAtLevelStart = 0;
    this.combo = 0; this.comboT = 0;
    this.lives = CFG.playerLives;
    this.retryEarthHp = null;
    this.totalKills = 0; this.astKills = 0; this.alienKills = 0;
    this.shotsFired = 0; this.shotsHit = 0;
    this.bossDefeated = false;
    this.levelKills = 0;
  }

  startLevel(n) {
    // life carries over between levels; on retry only Earth's damage persists
    const carry = this.state === 'levelComplete' && this.player && !this.player.dead;
    const carryHp = carry ? this.player.hp : null;
    let carryEarth = carry && this.earth ? this.earth.hp : null;
    if (this.retryEarthHp != null) { carryEarth = this.retryEarthHp; this.retryEarthHp = null; }
    this.level = n;
    this.levelKills = 0;
    this.player = new Player();
    this.earth = new Earth();
    if (carryHp !== null) this.player.hp = carryHp;
    if (carryEarth !== null) this.earth.hp = carryEarth;
    this.asteroids = []; this.aliens = [];
    this.bullets = []; this.enemyBullets = [];
    this.powerups = []; this.explosions = [];
    this.boss = null; this.bossSpawned = false;
    this.timer = CFG.levelTime;
    this.spawnT = 1.2;
    this.alienT = 4;
    this.announced = {};
    this.msg = null; this.msgT = 0;
    this.deadT = 0;
    this.introTick = 4;   // > 3 so the '3' tick fires
    this.scoreAtLevelStart = this.score;
    Particles.clear();
    this.state = 'intro';
    this.stateT = 0;
  }

  announce(text, dur = 1.6, color = '#fff') {
    this.msg = { text, dur, color };
    this.msgT = dur;
  }

  // ---------- UPDATE ----------
  update(dt, keys) {
    this.stateT += dt;
    for (const s of this.stars) {
      s.tw += dt * 3;
      s.y += s.z * 3 * dt;
      if (s.y > H) { s.y = -1; s.x = Math.random() * W; }
    }
    Shake.update(dt);
    Particles.update(dt);
    if (this.msgT > 0) this.msgT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    switch (this.state) {
      case 'menu': break;
      case 'difficulty': break;
      case 'intro': {
        // 3-2-1 countdown ticks
        const n = 3 - Math.floor(this.stateT / (2.2 / 3));
        if (n >= 1 && n < this.introTick) { this.introTick = n; AudioMan.count(); }
        if (this.stateT > 2.2) { this.state = 'playing'; this.stateT = 0; }
        break;
      }
      case 'playing': this.updatePlaying(dt, keys); break;
      case 'dying':
        this.updateWorld(dt, keys);
        this.deadT -= dt;
        if (this.deadT <= 0) { this.lives--; this.gameOver('SHIP DESTROYED'); }
        break;
      case 'levelComplete': case 'gameover': case 'victory':
        this.updateWorld(dt * 0.3, keys); // slow drift
        break;
      case 'paused': break;
    }
  }

  updatePlaying(dt, keys) {
    this.timer -= dt;
    const lvl = LEVELS[this.level];
    const D = DIFFS[this.diff];
    AudioMan.music();

    // scheduled announcements
    if (lvl.announce) {
      for (const [at, text] of lvl.announce) {
        if (this.timer <= at && !this.announced[at]) {
          this.announced[at] = true;
          this.announce(text, 1.8, text === 'WARNING' || text === 'HOSTILE CONTACT' ? '#f44' : '#fc4');
          AudioMan.warn();
        }
      }
    }
    // countdown drama
    const t = Math.ceil(this.timer);
    if (t === 10 && !this.announced.ten) {
      this.announced.ten = true; this.announce('10 SECONDS', 1.2, '#f84'); AudioMan.alarm();
    }
    if (t <= 5 && t >= 1 && !this.announced['c' + t]) {
      this.announced['c' + t] = true; this.announce(String(t), 0.8, '#f44'); AudioMan.count();
    }

    // boss entrance
    if (lvl.boss && !this.bossSpawned && this.timer <= lvl.bossAt) {
      this.bossSpawned = true;
      this.boss = new Boss();
      this.boss.maxHp = Math.round(this.boss.maxHp * D.boss);
      this.boss.hp = this.boss.maxHp;
      this.boss.shieldHp = this.boss.shieldMax = Math.round(this.boss.shieldMax * D.boss);
      this.announce('MOTHERSHIP INBOUND', 2.0, '#f4a');
      AudioMan.bossIn();
      Shake.add(2);
    }

    // spawns (levels with empty types spawn no asteroids — e.g. L5 boss gauntlet)
    if (lvl.types.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = lvl.spawn * (0.75 + Math.random() * 0.5) / D.spawn;
        this.spawnAsteroid(lvl);
      }
    }
    if (lvl.aliens && this.aliens.length < lvl.alienMax) {
      this.alienT -= dt;
      if (this.alienT <= 0) {
        this.alienT = lvl.alienEvery * D.alien;
        this.aliens.push(new Alien(24 + Math.random() * 60, 24 + Math.random() * (W - 48)));
      }
    }

    this.updateWorld(dt, keys);
    this.collide();

    // win/lose checks
    if (this.player.dead && this.state === 'playing') {
      this.state = 'dying'; this.deadT = 1.2;
    }
    if (this.earth.hp <= 0 && this.state === 'playing') {
      this.gameOver('EARTH DESTROYED');
    }
    if (this.level === 5 && this.boss && this.boss.dead && this.state === 'playing') {
      this.score += SCORE.boss * Math.max(1, this.combo);
      this.bossDefeated = true;
      this.state = 'victory'; this.stateT = 0;
      AudioMan.levelUp();
    }
    if (this.timer <= 0 && this.state === 'playing') {
      this.timer = 0;
      if (this.level === 5) {
        this.gameOver('MOTHERSHIP SURVIVED');
      } else {
        this.state = 'levelComplete'; this.stateT = 0;
        AudioMan.levelUp();
      }
    }
  }

  updateWorld(dt, keys) {
    this.player.update(dt, keys, this);
    this.earth.update(dt);
    for (const a of this.asteroids) a.update(dt);
    for (const a of this.aliens) a.update(dt, this);
    for (const b of this.bullets) b.update(dt);
    for (const b of this.enemyBullets) b.update(dt);
    for (const p of this.powerups) p.update(dt);
    for (const e of this.explosions) e.update(dt);
    if (this.boss) this.boss.update(dt, this);
    this.asteroids = this.asteroids.filter(a => !a.dead);
    this.aliens = this.aliens.filter(a => !a.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
    this.powerups = this.powerups.filter(p => !p.dead);
    this.explosions = this.explosions.filter(e => !e.dead);
  }

  spawnAsteroid(lvl) {
    const type = lvl.types[(Math.random() * lvl.types.length) | 0];
    const [vMin, vMax] = lvl.speed;
    const D = DIFFS[this.diff];
    const sp = (vMin + Math.random() * (vMax - vMin)) * D.spd;
    // spawn from top or upper sides, aimed near Earth with spread
    let x, y;
    const edge = Math.random();
    if (edge < 0.7) { x = Math.random() * W; y = -14; }
    else if (edge < 0.85) { x = -14; y = Math.random() * H * 0.4; }
    else { x = W + 14; y = Math.random() * H * 0.4; }
    const tx = this.earth.x + (Math.random() - 0.5) * 130;
    const ty = this.earth.y + (Math.random() - 0.5) * 10;
    const dx = tx - x, dy = ty - y;
    const d = Math.hypot(dx, dy) || 1;
    this.asteroids.push(new Asteroid(x, y, type, dx / d * sp, dy / d * sp));
  }

  addKill(points, x, y, color) {
    this.combo = Math.min(CFG.comboMax, this.combo + 1);
    this.comboT = CFG.comboWindow;
    this.score += points * this.combo;
    this.totalKills++; this.levelKills++;
    if (this.combo >= 2) this.announce('COMBO x' + this.combo, 0.7, '#8ff');
    // maybe drop powerup
    if (Math.random() < CFG.powerupDrop && this.powerups.length < 2) {
      const type = POWERUPS[(Math.random() * POWERUPS.length) | 0];
      this.powerups.push(new PowerUp(x, y, type));
    }
  }

  splitAsteroid(a) {
    if (a.size === 'l') {
      for (let i = 0; i < 2; i++) {
        const na = new Asteroid(a.x + (i ? 6 : -6), a.y, 'm',
          a.vx + (Math.random() - 0.5) * 40, a.vy * 0.6 + (Math.random() - 0.5) * 30);
        this.asteroids.push(na);
      }
    } else if (a.size === 'm') {
      for (let i = 0; i < 2; i++) {
        const na = new Asteroid(a.x + (i ? 5 : -5), a.y, 's',
          a.vx + (Math.random() - 0.5) * 50, a.vy * 0.6 + (Math.random() - 0.5) * 40);
        this.asteroids.push(na);
      }
    }
  }

  collide() {
    const P = this.player;
    // player bullets
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const a of this.asteroids) {
        if (a.dead) continue;
        if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 < (b.r + a.r) ** 2) {
          b.dead = true; this.shotsHit++;
          AudioMan.hitAst();
          Particles.spawn(b.x, b.y, { n: 4, speed: 25, life: 0.25 });
          if (a.hit(1)) {
            a.dead = true;
            const pts = SCORE[a.size];
            this.astKills++;
            this.addKill(pts, a.x, a.y);
            this.explosions.push(new Explosion(a.x, a.y, a.size === 'l' ? 'big' : 'small', a.size === 'l' ? 1.4 : 0.9));
            Particles.spawn(a.x, a.y, { n: a.size === 'l' ? 26 : 12, speed: 40 });
            if (a.size === 'l') { Shake.add(2); AudioMan.expBig(); } else AudioMan.expAst();
            this.splitAsteroid(a);
          }
          break;
        }
      }
      if (b.dead) continue;
      for (const a of this.aliens) {
        if (a.dead) continue;
        if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 < (b.r + a.r) ** 2) {
          b.dead = true; this.shotsHit++;
          if (a.hit(1)) {
            a.dead = true; this.alienKills++;
            this.addKill(SCORE.alien, a.x, a.y);
            this.explosions.push(new Explosion(a.x, a.y, 'alien', 1.2));
            Particles.spawn(a.x, a.y, { n: 18, colors: ['#c4f', '#f8f', '#4f4', '#fff'], speed: 45 });
            Shake.add(1.5); AudioMan.expAlien();
          }
          break;
        }
      }
      if (b.dead) continue;
      const B = this.boss;
      if (B && !B.dead && B.dying <= 0 && B.phase >= 1) {
        if ((b.x - B.x) ** 2 + (b.y - B.y) ** 2 < (b.r + B.r) ** 2) {
          b.dead = true; this.shotsHit++;
          B.hit(3);   // player bullets deal 3 damage to the mothership
          Particles.spawn(b.x, b.y, { n: 4, colors: ['#f8f', '#fff'], speed: 30, life: 0.3 });
        }
      }
    }

    // enemy bullets vs player
    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      if (!P.dead && (b.x - P.x) ** 2 + (b.y - P.y) ** 2 < (b.r + P.r) ** 2) {
        b.dead = true;
        P.hurt(b.kind === 'missile_purple' ? 22 : (b.kind === 'orb_purple' ? 14 : 10), this);
      }
    }

    // asteroids vs earth & player
    const D = DIFFS[this.diff];
    for (const a of this.asteroids) {
      if (a.dead) continue;
      const E = this.earth;
      if ((a.x - E.x) ** 2 + (a.y - E.y) ** 2 < (a.r + E.r) ** 2) {
        a.dead = true;
        E.damage(Math.round(AST_DMG[a.size] * D.edmg), this);
        this.explosions.push(new Explosion(a.x, a.y, a.size === 'l' ? 'big' : 'small', 1));
        continue;
      }
      if (!P.dead && (a.x - P.x) ** 2 + (a.y - P.y) ** 2 < (a.r + P.r) ** 2) {
        a.dead = true;
        P.hurt(Math.round(AST_PLAYER_DMG[a.size] * D.pdmg), this, true);
        if (P.shield > 0) AudioMan.shieldSmash(); else AudioMan.expAst();
        this.explosions.push(new Explosion(a.x, a.y, 'small', 0.9));
        Particles.spawn(a.x, a.y, { n: 14, speed: 40 });
      }
    }

    // aliens vs player (contact)
    for (const a of this.aliens) {
      if (a.dead) continue;
      if (!P.dead && (a.x - P.x) ** 2 + (a.y - P.y) ** 2 < (a.r + P.r) ** 2) {
        a.dead = true;
        P.hurt(Math.round(15 * D.pdmg), this, true);
        if (P.shield > 0) AudioMan.shieldSmash();
        this.explosions.push(new Explosion(a.x, a.y, 'alien', 1.1));
        AudioMan.expAlien();
      }
    }

    // powerup pickup: FIFO queue, oldest used first on each E press
    for (const p of this.powerups) {
      if (p.dead) continue;
      if (!P.dead && P.stored.length < CFG.powerupMax &&
          (p.x - P.x) ** 2 + (p.y - P.y) ** 2 < (p.r + P.r + 6) ** 2) {
        p.dead = true;
        const wasEmpty = P.stored.length === 0;
        P.stored.push(p.type);
        AudioMan.pickup();
        this.announce(PU_NAME[p.type] + (wasEmpty ? ' READY [E]' : ' QUEUED'), 1.4, PU_COLOR[p.type]);
        Particles.ring(P.x, P.y, PU_COLOR[p.type], 14, 0.4);
        Particles.spawn(P.x, P.y, { n: 10, colors: [PU_COLOR[p.type], '#fff'], speed: 30 });
      }
    }
  }

  activatePowerup() {
    const P = this.player;
    if (!P || P.dead) return;
    if (!P.stored.length) {
      if (this.state === 'playing') this.announce('NO POWER-UP', 0.9, '#789');
      return;
    }
    const t = P.stored.shift();   // first in, first out
    this.announce(PU_NAME[t] + '!', 0.9, PU_COLOR[t]);
    if (t === 'shield') { P.shield = CFG.shieldTime; AudioMan.shieldOn(); Particles.ring(P.x, P.y, '#4df', 18, 0.5); }
    else if (t === 'rapid') { P.rapid = CFG.rapidTime; AudioMan.pickup(); }
    else if (t === 'triple') { P.triple = CFG.tripleTime; AudioMan.pickup(); }
    else if (t === 'emp') {
      AudioMan.emp();
      Particles.ring(P.x, P.y, '#4df', CFG.empRadius + 10, 0.6, 3);
      Particles.ring(P.x, P.y, '#8ff', CFG.empRadius, 0.5, 2);
      Shake.add(2);
      const R2 = CFG.empRadius ** 2;
      for (const a of this.asteroids) {
        if ((a.x - P.x) ** 2 + (a.y - P.y) ** 2 < R2) {
          a.dead = true; this.astKills++;
          this.addKill(SCORE[a.size], a.x, a.y);
          this.explosions.push(new Explosion(a.x, a.y, 'blue', 1));
        }
      }
      for (const a of this.aliens) {
        if ((a.x - P.x) ** 2 + (a.y - P.y) ** 2 < R2) {
          a.dead = true; this.alienKills++;
          this.addKill(SCORE.alien, a.x, a.y);
          this.explosions.push(new Explosion(a.x, a.y, 'purple', 1));
        }
      }
      for (const b of this.enemyBullets) {
        if ((b.x - P.x) ** 2 + (b.y - P.y) ** 2 < R2) b.dead = true;
      }
      if (this.boss && this.boss.phase >= 1 && this.boss.dying <= 0) this.boss.hit(CFG.empBossDmg);
    }
  }

  gameOver(reason) {
    this.state = 'gameover';
    this.overReason = reason;
    this.stateT = 0;
    AudioMan.gameOver();
  }

  handleKey(k) {
    if (k === 'm') { AudioMan.muted = !AudioMan.muted; return; }
    if (k === 'p' && (this.state === 'playing' || this.state === 'paused')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      return;
    }
    if (this.state === 'difficulty') {
      if (k === 'w' || k === 'arrowup') { this.diffSel = (this.diffSel + DIFFS.length - 1) % DIFFS.length; AudioMan.count(); }
      else if (k === 's' || k === 'arrowdown') { this.diffSel = (this.diffSel + 1) % DIFFS.length; AudioMan.count(); }
      else if (k === '1' || k === '2' || k === '3') { this.diffSel = +k - 1; this.diff = this.diffSel; this.resetRun(); this.startLevel(1); }
      else if (k === ' ' || k === 'enter') { this.diff = this.diffSel; this.resetRun(); this.startLevel(1); }
      return;
    }
    if (k === 'e') { this.activatePowerup(); return; }
    if (k !== ' ' && k !== 'enter') return;
    switch (this.state) {
      case 'menu': this.state = 'difficulty'; this.stateT = 0; break;
      case 'levelComplete': this.startLevel(this.level + 1); break;
      case 'gameover':
        if (this.overReason === 'EARTH DESTROYED' || this.lives <= 0) {
          this.resetRun(); this.startLevel(1);          // Earth lost or out of chances = start over
        } else {
          this.score = this.scoreAtLevelStart; this.combo = 0;
          this.retryEarthHp = this.earth ? this.earth.hp : null;   // Earth keeps its damage
          this.startLevel(this.level);
        }
        break;
      case 'victory': this.state = 'menu'; this.resetRun(); break;
    }
  }

  accuracy() { return this.shotsFired ? Math.round(this.shotsHit / this.shotsFired * 100) : 0; }

  // ---------- DRAW ----------
  draw() {
    const ctx = this.ctx;
    const WX = window.RENDER_WX || window.RENDER_SCALE || 2;
    const WY = window.RENDER_WY || window.RENDER_SCALE || 2;
    // nebula bg always fills the whole canvas (no plain black bars on phones)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(WX, 0, 0, WY, window.RENDER_OX || 0, window.RENDER_OY || 0);   // world logic stays 320x180
    ctx.save();
    ctx.translate(Math.round(Shake.ox()), Math.round(Shake.oy()));

    // stars
    for (const s of this.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(s.tw));
      ctx.globalAlpha = a * s.z;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x | 0, s.y | 0, s.sz, s.sz);
    }
    ctx.globalAlpha = 1;

    if (this.state !== 'menu' && this.state !== 'difficulty') {
      this.earth.draw(ctx);
      for (const p of this.powerups) p.draw(ctx);
      for (const a of this.asteroids) a.draw(ctx);
      for (const a of this.aliens) a.draw(ctx);
      if (this.boss) this.boss.draw(ctx);
      for (const b of this.bullets) b.draw(ctx);
      for (const b of this.enemyBullets) b.draw(ctx);
      this.player.draw(ctx);
      for (const e of this.explosions) e.draw(ctx);
      Particles.draw(ctx);
      if (!window.HUD_PX) this.drawHUD(ctx);
    } else {
      Particles.draw(ctx);
    }

    // center announcements
    if (this.msgT > 0 && this.msg) {
      const a = Math.min(1, this.msgT * 3);
      ctx.globalAlpha = a;
      const big = this.msg.text.length <= 2;
      this.text(ctx, this.msg.text, W / 2, big ? 80 : 80, this.msg.color, big ? 5 : 3, 'center');
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // full-screen overlays
    switch (this.state) {
      case 'menu': this.drawMenu(ctx); break;
      case 'difficulty': this.drawDifficulty(ctx); break;
      case 'intro': this.drawIntro(ctx); break;
      case 'levelComplete': this.drawLevelComplete(ctx); break;
      case 'gameover': this.drawGameOver(ctx); break;
      case 'victory': this.drawVictory(ctx); break;
      case 'paused': this.drawPaused(ctx); break;
    }
    if (window.HUD_PX && this.state !== 'menu' && this.state !== 'difficulty') this.drawHUDScreen(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // x,y are logical (320x180) coords; pixel font drawn at device res so blocks stay crisp
  text(ctx, s, x, y, color = '#fff', size = 1, align = 'left') {
    const WX = window.RENDER_WX || window.RENDER_SCALE || 2;
    const WY = window.RENDER_WY || window.RENDER_SCALE || 2;
    const S = Math.min(WX, WY);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    pixText(ctx, s, Math.round((window.RENDER_OX || 0) + x * WX), Math.round((window.RENDER_OY || 0) + y * WY), Math.max(1, Math.round(size)) * S, color, align);
    ctx.restore();
  }

  bar(ctx, x, y, w, h, frac, color, backColor = '#222') {
    ctx.fillStyle = backColor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * frac), h);
  }

  drawHUD(ctx) {
    const t = Math.max(0, Math.ceil(this.timer));
    // top strip
    ctx.fillStyle = 'rgba(2,4,18,0.7)';
    ctx.fillRect(0, 0, W, 24);
    this.text(ctx, 'LEVEL ' + this.level + '/5', 4, 2, '#8ef', 1);
    this.text(ctx, 'TIME ' + String(t).padStart(2, '0'), 4, 9, t <= 10 ? '#f44' : '#fff', 1);
    this.text(ctx, 'EARTH', 44, 2, '#678', 1);
    this.bar(ctx, 44, 9, 40, 5, this.earth.hp / CFG.earthHp,
      this.earth.hp > 60 ? '#4af' : this.earth.hp > 30 ? '#fa4' : '#f44');
    this.text(ctx, 'PLAYER', 90, 2, '#678', 1);
    this.bar(ctx, 90, 9, 40, 5, this.player.hp / CFG.playerHp,
      this.player.hp > 50 ? '#4f4' : this.player.hp > 25 ? '#fa4' : '#f44');
    // chances left
    this.text(ctx, 'LIVES', 44, 17, '#678', 1);
    for (let i = 0; i < CFG.playerLives; i++) {
      if (i < this.lives) drawSprite(ctx, 'player_ship2', 76 + i * 9, 20, 6, 7);
    }
    this.text(ctx, 'SCORE', 136, 2, '#678', 1);
    this.text(ctx, String(this.score).padStart(7, '0'), 136, 9, '#ff8', 1);
    if (this.combo >= 2) this.text(ctx, 'COMBO X' + this.combo, 186, 9, '#8ff', 1);
    // power slot
    this.text(ctx, 'POWER', 236, 2, '#678', 1);
    if (this.player.stored.length) {
      const front = this.player.stored[0];
      const label = PU_NAME[front] + (this.player.stored.length > 1 ? ' +' + (this.player.stored.length - 1) : '');
      this.text(ctx, label, 236, 9, PU_COLOR[front], 1);
      if ((this.stateT * 4 | 0) % 2 === 0)
        this.text(ctx, 'PRESS E', 236, 16, '#fff', 1);
    } else {
      this.text(ctx, '---', 236, 9, '#456', 1);
    }
    // active effects
    let ey = 16;
    if (this.player.shield > 0) { this.text(ctx, 'SHIELD ' + Math.ceil(this.player.shield), 150, ey, '#4df', 1); ey += 7; }
    if (this.player.rapid > 0) { this.text(ctx, 'RAPID ' + Math.ceil(this.player.rapid), 150, ey, '#f43', 1); ey += 7; }
    if (this.player.triple > 0) { this.text(ctx, 'TRIPLE ' + Math.ceil(this.player.triple), 150, ey, '#4f4', 1); ey += 7; }
    // boss bar
    if (this.boss && this.boss.phase >= 1 && !this.boss.dead) {
      this.text(ctx, 'MOTHERSHIP', W / 2, 27, '#f4a', 1, 'center');
      if (this.boss.phase === 1) {
        this.bar(ctx, W / 2 - 50, 34, 100, 4, this.boss.shieldHp / this.boss.shieldMax, '#4df');
      } else {
        this.bar(ctx, W / 2 - 50, 34, 100, 4, this.boss.hp / this.boss.maxHp, this.boss.phase === 3 ? '#f44' : '#c4f');
      }
    }
  }

  // portrait phones: HUD pinned to the top of the screen in device px
  drawHUDScreen(ctx) {
    const cw = ctx.canvas.width, band = window.HUD_PX;
    const t = Math.max(0, Math.ceil(this.timer));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(2,4,18,0.85)';
    ctx.fillRect(0, 0, cw, band);
    ctx.strokeStyle = 'rgba(80,140,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, band); ctx.lineTo(cw, band); ctx.stroke();
    const top = window.SAFE_TOP_PX || 0;
    const usable = band - top;
    const s = Math.max(4, Math.round(usable / 34));
    const gh = 5 * s;
    const y1 = top + Math.round(usable * 0.07);
    const y2 = top + Math.round(usable * 0.40);
    const y3 = top + Math.round(usable * 0.73);
    const xL = Math.round(cw * 0.015);
    const xM = Math.round(cw * 0.36);   // mid column
    const xR = Math.round(cw * 0.58);   // right column
    // row 1: LEVEL | TIME | SCORE digits
    pixText(ctx, 'LEVEL ' + this.level + '/5', xL, y1, s, '#8ef');
    pixText(ctx, 'TIME ' + String(t).padStart(2, '0'), xM, y1, s, t <= 10 ? '#f44' : '#fff');
    pixText(ctx, 'SCORE ' + String(this.score).padStart(7, '0'), xR, y1, s, '#ff8');
    // row 2: EARTH label+bar | PLAYER label+bar
    const bw = Math.round(cw * 0.18), bh = Math.max(6, Math.round(usable * 0.09));
    pixText(ctx, 'EARTH', xL, y2, s, '#678');
    this.bar(ctx, xL + 21 * s, y2 + s, bw, bh, this.earth.hp / CFG.earthHp,
      this.earth.hp > 60 ? '#4af' : this.earth.hp > 30 ? '#fa4' : '#f44');
    pixText(ctx, 'PLAYER', xR, y2, s, '#678');
    this.bar(ctx, xR + 25 * s, y2 + s, bw, bh, this.player.hp / CFG.playerHp,
      this.player.hp > 50 ? '#4f4' : this.player.hp > 25 ? '#fa4' : '#f44');
    // row 3: LIVES+icons | PWR+value | COMBO
    pixText(ctx, 'LIVES', xL, y3, s, '#678');
    for (let i = 0; i < this.lives; i++) {
      drawSprite(ctx, 'player_ship2', xL + 24 * s + i * Math.round(5.5 * s), y3 - s, Math.round(4 * s), Math.round(4.5 * s));
    }
    pixText(ctx, 'PWR', xM, y3, s, '#678');
    if (this.player.stored.length) {
      const front = this.player.stored[0];
      pixText(ctx, PU_NAME[front] + (this.player.stored.length > 1 ? '+' + (this.player.stored.length - 1) : ''), xM + 15 * s, y3, s, PU_COLOR[front]);
    } else {
      pixText(ctx, '---', xM + 15 * s, y3, s, '#456');
    }
    let ex = xR;
    if (this.combo >= 2) { pixText(ctx, 'X' + this.combo, ex, y3, s, '#8ff'); ex += 3 * s; }
    if (this.player.shield > 0) { pixText(ctx, 'SHD' + Math.ceil(this.player.shield), ex, y3, s, '#4df'); ex += 5 * s; }
    if (this.player.rapid > 0) { pixText(ctx, 'RPD' + Math.ceil(this.player.rapid), ex, y3, s, '#f43'); ex += 5 * s; }
    if (this.player.triple > 0) { pixText(ctx, 'TRP' + Math.ceil(this.player.triple), ex, y3, s, '#4f4'); ex += 5 * s; }
    ctx.restore();
    // boss bar hangs just under the HUD band
    if (this.boss && this.boss.phase >= 1 && !this.boss.dead) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const bW = Math.round(cw * 0.6), bx = Math.round((cw - bW) / 2);
      const frac = this.boss.phase === 1 ? this.boss.shieldHp / this.boss.shieldMax : this.boss.hp / this.boss.maxHp;
      this.bar(ctx, bx, band + 6, bW, Math.max(6, Math.round(band * 0.07)), frac,
        this.boss.phase === 1 ? '#4df' : this.boss.phase === 3 ? '#f44' : '#c4f');
      pixText(ctx, 'MOTHERSHIP', cw / 2, band + 6 + Math.round(band * 0.11), Math.max(2, Math.round(s * 0.8)), '#f4a', 'center');
      ctx.restore();
    }
  }

  dim(ctx, a = 0.72) {
    ctx.fillStyle = `rgba(1,3,12,${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawMenu(ctx) {
    this.dim(ctx, 0.45);
    // hero artwork: jet squadron defending Earth
    const bob = Math.sin(this.stateT * 2) * 2;
    drawSprite(ctx, 'earth1', W / 2, 138, 58, 58);
    ctx.globalAlpha = 0.22 + Math.sin(this.stateT * 2) * 0.07;
    ctx.strokeStyle = '#4af';
    ctx.beginPath(); ctx.arc(W / 2, 138, 34 + Math.sin(this.stateT * 2) * 1.5, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.beginPath(); ctx.arc(W / 2, 138, 38 + Math.sin(this.stateT * 2) * 1.5, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
    // engine glow under each jet
    const eng = (x, y, w) => {
      ctx.fillStyle = '#f80';
      ctx.fillRect(x - w / 2, y, w, 3 + Math.sin(this.stateT * 18 + x) * 1.5);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(x - 0.5, y, 1, 2 + Math.sin(this.stateT * 18 + x));
    };
    eng(W / 2 - 44, 122 + bob * 0.6, 3);
    eng(W / 2 + 44, 122 + bob * 0.6, 3);
    eng(W / 2, 118 + bob, 4);
    drawSprite(ctx, 'player_ship', W / 2, 102 + bob, 26, 32);
    drawSprite(ctx, 'player_ship2', W / 2 - 44, 114 + bob * 0.6, 17, 20);
    drawSprite(ctx, 'player_ship2', W / 2 + 44, 114 + bob * 0.6, 17, 20);
    this.text(ctx, 'DOOMSDAY', W / 2, 16, '#f66', 5, 'center');
    if ((this.stateT * 2 | 0) % 2 === 0)
      this.text(ctx, 'PRESS SPACE TO START', W / 2, 66, '#fff', 2, 'center');
    // retro terminal box: controls, bottom-left
    const bx = 4, by = 120, bw = 92, bh = 56;
    ctx.fillStyle = 'rgba(2,10,20,0.78)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#2af';
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2af';
    ctx.fillRect(bx + 4, by + 2, 18, 1);
    const scan = 1 + ((this.stateT * 14 | 0) % (bh - 4));
    ctx.fillStyle = 'rgba(60,180,255,0.08)';
    ctx.fillRect(bx + 1, by + scan, bw - 2, 1);
    this.text(ctx, 'CONTROLS', bx + 8, by + 6, '#4df', 1);
    const ctrls = ['WASD  MOVE', 'SPACE SHOOT', 'E     POWER-UP', 'SHIFT BOOST', 'P PAUSE  M MUTE'];
    ctrls.forEach((c, i) => this.text(ctx, c, bx + 8, by + 17 + i * 8, '#8ef', 1));
  }

  drawDifficulty(ctx) {
    this.dim(ctx, 0.6);
    this.text(ctx, 'SELECT DIFFICULTY', W / 2, 40, '#8ef', 3, 'center');
    DIFFS.forEach((d, i) => {
      const sel = i === this.diffSel;
      const y = 68 + i * 16;
      if (sel) this.text(ctx, '>', W / 2 - 46, y, '#f84', 2, 'center');
      this.text(ctx, (i + 1) + '. ' + d.name, W / 2, y, sel ? '#fff' : '#678', 2, 'center');
    });
    const hints = ['FEWER SLOWER ASTEROIDS', 'THE ARCADE STANDARD', 'MAXIMUM CHAOS'];
    this.text(ctx, hints[this.diffSel], W / 2, 122, '#789', 1, 'center');
    this.text(ctx, 'W/S OR 1-3 TO CHOOSE - SPACE TO START', W / 2, 150, '#567', 1, 'center');
  }

  drawIntro(ctx) {
    this.dim(ctx);
    const lvl = LEVELS[this.level];
    this.text(ctx, 'LEVEL ' + this.level, W / 2, 50, '#8ef', 3, 'center');
    this.text(ctx, lvl.name, W / 2, 68, '#fff', 2, 'center');
    this.text(ctx, lvl.sub, W / 2, 84, '#789', 1, 'center');
    this.text(ctx, 'DIFFICULTY: ' + DIFFS[this.diff].name, W / 2, 96, '#567', 1, 'center');
    const n = 3 - Math.floor(this.stateT / (2.2 / 3));
    if (n >= 1) this.text(ctx, String(n), W / 2, 118, '#f84', 4, 'center');
  }

  drawLevelComplete(ctx) {
    this.dim(ctx);
    this.text(ctx, 'LEVEL COMPLETE', W / 2, 30, '#4f8', 3, 'center');
    const acc = this.accuracy();
    const rows = [
      ['TIME SURVIVED', '60 SECONDS'],
      ['ENEMIES DESTROYED', String(this.levelKills)],
      ['ACCURACY', acc + '%'],
      ['SCORE', String(this.score).padStart(7, '0')],
      ['EARTH HEALTH', this.earth.hp + '%'],
    ];
    rows.forEach((r, i) => {
      this.text(ctx, r[0], 80, 56 + i * 11, '#789', 1);
      this.text(ctx, r[1], 240, 56 + i * 11, '#fff', 1, 'right');
    });
    if ((this.stateT * 2 | 0) % 2 === 0)
      this.text(ctx, 'PRESS SPACE FOR NEXT LEVEL', W / 2, 130, '#8ef', 2, 'center');
  }

  drawGameOver(ctx) {
    this.dim(ctx);
    this.text(ctx, 'GAME OVER', W / 2, 34, '#f44', 4, 'center');
    this.text(ctx, this.overReason || '', W / 2, 58, '#f88', 2, 'center');
    const rows = [
      ['FINAL SCORE', String(this.score).padStart(7, '0')],
      ['LEVEL REACHED', this.level + '/5'],
      ['ENEMIES DESTROYED', String(this.totalKills)],
      ['CHANCES LEFT', String(Math.max(0, this.lives))],
    ];
    rows.forEach((r, i) => {
      this.text(ctx, r[0], 80, 80 + i * 11, '#789', 1);
      this.text(ctx, r[1], 240, 80 + i * 11, '#fff', 1, 'right');
    });
    if ((this.stateT * 2 | 0) % 2 === 0)
      this.text(ctx, (this.overReason === 'EARTH DESTROYED' || this.lives <= 0) ? 'PRESS SPACE TO START OVER' : 'PRESS SPACE TO RETRY', W / 2, 126, '#8ef', 2, 'center');
  }

  drawVictory(ctx) {
    this.dim(ctx, 0.6);
    this.text(ctx, 'EARTH SAVED', W / 2, 22, '#4f8', 4, 'center');
    this.text(ctx, 'MISSION COMPLETE', W / 2, 44, '#8ef', 2, 'center');
    const rows = [
      ['FINAL SCORE', String(this.score).padStart(7, '0')],
      ['ASTEROIDS DESTROYED', String(this.astKills)],
      ['ALIENS DESTROYED', String(this.alienKills)],
      ['BOSS DEFEATED', this.bossDefeated ? 'YES' : 'NO'],
      ['EARTH HEALTH', this.earth.hp + '%'],
      ['ACCURACY', this.accuracy() + '%'],
    ];
    rows.forEach((r, i) => {
      this.text(ctx, r[0], 80, 62 + i * 11, '#789', 1);
      this.text(ctx, r[1], 240, 62 + i * 11, '#fff', 1, 'right');
    });
    if ((this.stateT * 2 | 0) % 2 === 0)
      this.text(ctx, 'PRESS SPACE TO PLAY AGAIN', W / 2, 140, '#8ef', 2, 'center');
  }

  drawPaused(ctx) {
    this.dim(ctx, 0.6);
    this.text(ctx, 'PAUSED', W / 2, 78, '#8ef', 3, 'center');
    this.text(ctx, 'P TO RESUME', W / 2, 98, '#789', 1, 'center');
  }
}
