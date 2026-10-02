// Entities: Player, Earth, Asteroid, Alien, Boss, Bullet, PowerUp
// All positions in 320x180 space. Circle collision via .r

class Bullet {
  constructor(x, y, vx, vy, friendly, kind) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.friendly = friendly;
    this.kind = kind || (friendly ? 'bullet_blue' : 'bullet_red');
    this.r = friendly ? 2 : 3;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.x < -20 || this.x > W + 20 || this.y < -20 || this.y > H + 20) this.dead = true;
  }
  draw(ctx) {
    const s = { bullet_blue: [4, 8], bullet_blue2: [3, 8], bullet_red: [3, 6],
                bullet_red2: [3, 6], orb_purple: [7, 8], missile_purple: [6, 16] }[this.kind] || [4, 8];
    if (this.kind === 'missile_purple' || this.kind === 'orb_purple' || this.kind.startsWith('bullet_red')) {
      const ang = Math.atan2(this.vy, this.vx) + Math.PI / 2;
      ctx.save();
      ctx.translate(Math.round(this.x), Math.round(this.y));
      ctx.rotate(ang);
      if (!drawSprite(ctx, this.kind, 0, 0, s[0], s[1])) {
        ctx.fillStyle = '#f66'; ctx.fillRect(-1, -3, 2, 6);
      }
      ctx.restore();
    } else {
      if (!drawSprite(ctx, this.kind, this.x, this.y, s[0], s[1])) {
        ctx.fillStyle = '#7df'; ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 3, 2, 6);
      }
    }
  }
}

class Asteroid {
  constructor(x, y, size, vx, vy) {
    this.x = x; this.y = y; this.size = size;
    this.vx = vx; this.vy = vy;
    this.hp = AST_HP[size];
    this.r = AST_R[size];
    this.rot = Math.random() * 7;
    this.rv = (Math.random() - 0.5) * 2;
    this.variant = Math.random() < 0.5 ? 1 : 2;
    this.flash = 0;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.rv * dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.y > H + 30 || this.x < -40 || this.x > W + 40) this.dead = true;
  }
  hit(d) {
    this.hp -= d; this.flash = 0.08;
    return this.hp <= 0;
  }
  draw(ctx) {
    const key = 'ast_' + this.size + this.variant;
    const px = { s: 9, m: 14, l: 24 }[this.size];
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.rotate(this.rot);
    if (!drawSprite(ctx, key, 0, 0, px, px)) drawFallback(ctx, 'asteroid', 0, 0, this.r);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 8);
      drawSprite(ctx, key, 0, 0, px, px);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

class Alien {
  constructor(y, targetX) {
    this.x = targetX;                       // enters from the top
    this.y = -16;
    this.vy = 26 + Math.random() * 18;
    this.baseY = y;
    this.tx = targetX;                      // hover x near this
    this.t = Math.random() * 6;
    this.hp = 3;
    this.r = 7;
    this.fireT = 1.2 + Math.random() * 1.6;
    this.flash = 0;
    this.dead = false;
    this.sprite = 'alien' + (1 + ((Math.random() * 4) | 0));
    this.entered = false;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.entered) {
      this.y += this.vy * dt;               // dive in from the top
      if (this.y >= this.baseY) { this.y = this.baseY; this.entered = true; }
    } else {
      this.x += Math.sin(this.t * 1.4) * 12 * dt;
      this.y = this.baseY + Math.sin(this.t * 1.1) * 14;
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = 1.5 + Math.random() * 1.4;
        const p = game.player;
        const dx = p.x - this.x, dy = p.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        game.enemyBullets.push(new Bullet(this.x, this.y,
          dx / d * CFG.enemyBulletSpeed, dy / d * CFG.enemyBulletSpeed, false, 'bullet_red'));
      }
    }
    if (this.flash > 0) this.flash -= dt;
    if (this.y > H + 30) this.dead = true;
  }
  hit(d) { this.hp -= d; this.flash = 0.08; return this.hp <= 0; }
  draw(ctx) {
    const px = 15;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    ctx.scale(1, 1); // faces down
    if (!drawSprite(ctx, this.sprite, 0, 0, px + 4, px)) drawFallback(ctx, 'alien', 0, 0, this.r);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 8);
      drawSprite(ctx, this.sprite, 0, 0, px + 4, px);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

class Boss {
  constructor() {
    this.x = W / 2; this.y = -50;
    this.tx = W / 2;
    this.ty = 38;
    this.r = 40;
    this.maxHp = 280;
    this.hp = this.maxHp;
    this.shieldHp = 120;
    this.shieldMax = 120;
    this.phase = 0;          // 0=entering,1=shielded,2=vulnerable,3=enraged
    this.t = 0;
    this.fireT = 2;
    this.spawnT = 6;
    this.ringT = 0;
    this.flash = 0;
    this.dead = false;
    this.dying = 0;
    this.expT = 0;
    this.shieldBreakFx = false;
    this.volley = 0;
    this.mainT = 11;        // countdown to main cannon
    this.chargeT = 0;       // telegraph time
    this.beam = 0;          // active beam time
    this.beamX = 0;
    this.beamEarthHit = false;
  }
  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.dying > 0) {
      this.dying -= dt;
      this.expT -= dt;
      for (const b of game.enemyBullets) b.dead = true;   // guns silenced on death
      if (this.expT <= 0) {
        this.expT = 0.22;
        game.explosions.push(new Explosion(this.x + (Math.random() - 0.5) * 84,
          this.y + (Math.random() - 0.5) * 32,
          Math.random() < 0.5 ? 'big' : 'alien', 1 + Math.random() * 0.7));
        AudioMan.expAst();
        Shake.add(0.5);
      }
      if (Math.random() < 0.3) {
        Particles.spawn(this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 30,
          { n: 8, colors: ['#f8f', '#c4f', '#f80', '#ff8'], speed: 30 });
      }
      if (this.dying <= 0) {
        this.dead = true;
        for (const b of game.enemyBullets) b.dead = true;
        for (const a of game.aliens) {
          if (!a.dead) {
            a.dead = true; game.alienKills++;
            game.explosions.push(new Explosion(a.x, a.y, 'alien', 1.2));
            Particles.spawn(a.x, a.y, { n: 16, colors: ['#f80', '#ff8', '#fff'], speed: 45 });
          }
        }
        game.explosions.push(new Explosion(this.x, this.y, 'big', 3.4));
        Particles.spawn(this.x, this.y, { n: 90, colors: ['#fff', '#ff8', '#f80', '#f4a', '#8ef'], speed: 90, life: 1.2 });
        Particles.ring(this.x, this.y, '#fc8', 70, 0.9, 3);
        Particles.ring(this.x, this.y, '#f4a', 45, 0.7, 2);
        Shake.mag = 0;
        AudioMan.bossDie();
      }
      return;
    }
    // entrance glide
    if (this.y < this.ty) {
      this.y += 22 * dt;
      if (this.y >= this.ty) { this.phase = 1; }
      return;
    }
    // drift toward player — enraged phase chases harder.
    // frozen while the main cannon charges or fires so the beam stays
    // aligned with the ship's cannon.
    const firing = this.chargeT > 0 || this.beam > 0;
    if (!firing) {
      const want = Math.max(60, Math.min(W - 60, game.player.x));
      const chaseSpd = this.phase >= 3 ? 22 : 12;
      this.x += Math.sign(want - this.x) * Math.min(Math.abs(want - this.x), chaseSpd * dt);
      this.x += Math.sin(this.t * 0.7) * 8 * dt;
      this.y = this.ty + Math.sin(this.t * 0.9) * 3;
    }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;

    // attacks — volley patterns per phase
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.volley++;
      if (this.phase === 1) {          // shielded: sweeping fan that pans left-right
        const sweep = Math.sin(this.volley * 0.9) * 0.55;
        for (let k = 0; k < 4; k++) {
          const a = Math.atan2(dy, dx) + sweep + (k - 1.5) * 0.17;
          game.enemyBullets.push(new Bullet(this.x, this.y + 20,
            Math.cos(a) * 56, Math.sin(a) * 56, false, 'bullet_red2'));
        }
        this.fireT = 1.35;
      } else if (this.phase === 2) {   // vulnerable: alternating spiral arcs + ring burst
        if (this.volley % 4 === 0) {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + this.volley * 0.2;
            game.enemyBullets.push(new Bullet(this.x, this.y + 14,
              Math.cos(a) * 48, Math.sin(a) * 48, false, 'orb_purple'));
          }
        } else {
          const dir = this.volley % 2 === 0 ? 1 : -1;
          for (let k = 0; k < 5; k++) {
            const a = Math.PI * 0.5 + dir * (k - 2) * 0.24 + dir * this.volley * 0.12;
            game.enemyBullets.push(new Bullet(this.x, this.y + 14,
              Math.cos(a) * 58, Math.sin(a) * 58, false, 'orb_purple'));
          }
        }
        this.fireT = 1.05;
      } else {                          // enraged: counter-rotating rings + missile pair
        for (let k = 0; k < 12; k++) {
          const dir = k % 2 === 0 ? 1 : -1;
          const a = (k / 12) * Math.PI * 2 + dir * this.volley * 0.28;
          game.enemyBullets.push(new Bullet(this.x, this.y + 14,
            Math.cos(a) * 44, Math.sin(a) * 44, false, 'orb_purple'));
        }
        const a = Math.atan2(dy, dx);
        for (const off of [-0.12, 0.12]) {
          game.enemyBullets.push(new Bullet(this.x, this.y + 20,
            Math.cos(a + off) * 72, Math.sin(a + off) * 72, false, 'missile_purple'));
        }
        this.fireT = 1.2;
      }
    }
    // main cannon: charge -> lock -> beam
    this.mainT -= dt;
    if (this.chargeT > 0) {
      this.chargeT -= dt;
      this.beamX = this.x;                  // beam stays aligned with the cannon
      if (this.chargeT <= 0) {
        this.beam = 1.1;
        this.beamEarthHit = false;
        AudioMan.beam();
        Shake.add(1.5);
      }
    } else if (this.mainT <= 0) {
      this.mainT = this.phase === 1 ? 12 : 8;
      this.chargeT = 1.5;
      this.beamX = this.x;
      AudioMan.charge();
      game.announce('ENERGY SURGE', 1.2, '#f4a');
    }
    if (this.beam > 0) {
      this.beam -= dt;
      if (!p.dead && Math.abs(p.x - this.beamX) < 14 && p.y > this.y) p.hurt(28, game);
      if (!this.beamEarthHit && Math.abs(game.earth.x - this.beamX) < 26) {
        this.beamEarthHit = true;
        game.earth.damage(9, game);
      }
    }
    // no escorts — level 5 is mothership only
    // phase transitions
    if (this.phase === 1 && this.shieldHp <= 0) {
      this.phase = 2;
      this.shieldBreakFx = true;
      Particles.ring(this.x, this.y, '#4df', 60, 0.7, 3);
      Particles.spawn(this.x, this.y, { n: 40, colors: ['#4df', '#8ef', '#fff'], speed: 60 });
      Shake.add(2.5);
      AudioMan.expBig();
    }
    if (this.phase === 2 && this.hp <= this.maxHp * 0.3) {
      this.phase = 3;
      game.announce('CORE EXPOSED', 1.4, '#f4a');
      AudioMan.alarm();
    }
  }
  // returns 'shield'|'body'|'dead'
  hit(d) {
    if (this.dying > 0) return 'dead';
    if (this.phase <= 1) {
      this.shieldHp -= d; this.flash = 0.06;
      AudioMan.bossHit();
      return 'shield';
    }
    this.hp -= d; this.flash = 0.06;
    AudioMan.bossHit();
    if (this.hp <= 0) {
      this.dying = 2.8;
      this.beam = 0; this.chargeT = 0;   // shut down all weapons
      return 'dead';
    }
    return 'body';
  }
  draw(ctx) {
    const flash = this.flash > 0;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    const dyingJitter = this.dying > 0 ? (Math.random() - 0.5) * 3 : 0;
    ctx.translate(dyingJitter, 0);
    drawSprite(ctx, 'mothership', 0, 0, 96, 44);
    if (flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, this.flash * 9);
      drawSprite(ctx, 'mothership', 0, 0, 96, 44);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // glowing core
    const corePulse = 3 + Math.sin(this.t * 6) * 1;
    ctx.fillStyle = this.phase === 3 ? '#f4a' : '#f0f';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 8, corePulse, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // main cannon: targeting telegraph while charging
    if (this.chargeT > 0) {
      const locked = this.chargeT <= 0.35;
      ctx.strokeStyle = '#f4a';
      ctx.globalAlpha = locked ? 0.5 + Math.sin(this.t * 40) * 0.4 : 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(this.beamX - this.x, H - this.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // swelling charge glow
      const ch = 1.5 - this.chargeT;
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = Math.min(0.8, ch * 0.5);
      ctx.beginPath(); ctx.arc(0, 8, 5 + ch * 3, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // active beam
    if (this.beam > 0) {
      const bx = this.beamX - this.x;
      const bw = 9 + Math.sin(this.t * 40) * 2;
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#f4a';
      ctx.fillRect(bx - bw / 2, 12, bw, H - this.y - 12);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx - 1.5, 12, 3, H - this.y - 12);
      ctx.globalAlpha = 1;
    }
    // shield bubble
    if (this.phase === 1) {
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 4) * 0.15;
      drawSprite(ctx, 'shield_sphere', 0, 2, 104, 104);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.vy = 14; this.t = 0; this.life = 9;
    this.r = 7; this.dead = false;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    if (this.t > this.life || this.y > H + 12) this.dead = true;
  }
  draw(ctx) {
    const blink = this.life - this.t < 3 && (this.t * 8 | 0) % 2 === 0;
    if (blink) return;
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(this.y));
    // glow ring
    ctx.globalAlpha = 0.5 + Math.sin(this.t * 5) * 0.2;
    ctx.strokeStyle = PU_COLOR[this.type];
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
    drawSprite(ctx, PU_SPRITE[this.type], 0, 0, 13, 13);
    ctx.restore();
  }
}

class Player {
  constructor() {
    this.x = W / 2; this.y = H - 50;
    this.hp = CFG.playerHp;
    this.r = CFG.playerRadius;
    this.fireT = 0;
    this.invuln = 0;
    this.shield = 0;
    this.rapid = 0;
    this.triple = 0;
    this.stored = [];     // FIFO queue of powerup types
    this.muzzle = 0;
    this.dead = false;
    this.engine = 0;
    this.boosting = false;
  }
  update(dt, keys, game) {
    if (this.dead) return;
    let mx = 0, my = 0;
    if (keys['a'] || keys['arrowleft']) mx -= 1;
    if (keys['d'] || keys['arrowright']) mx += 1;
    if (keys['w'] || keys['arrowup']) my -= 1;
    if (keys['s'] || keys['arrowdown']) my += 1;
    this.boosting = false;
    if (mx || my) {
      const d = Math.hypot(mx, my);
      this.boosting = !!keys['shift'];
      const spd = CFG.playerSpeed * (this.boosting ? CFG.boostMul : 1) * (window.IS_TOUCH ? 0.62 : 1);
      this.x += mx / d * spd * dt;
      this.y += my / d * spd * dt;
      this.engine += dt * (this.boosting ? 60 : 30);
      if (this.boosting && Math.random() < 0.6) {
        Particles.spawn(this.x + (Math.random() - 0.5) * 3, this.y + 9,
          { n: 1, colors: ['#f80', '#fc4', '#f42'], speed: 14, life: 0.35 });
      }
    }
    // slide-finger drag (touch): ship follows relative finger motion
    if (window.__dragDX || window.__dragDY) {
      this.x += window.__dragDX;
      this.y += window.__dragDY;
      this.engine += 0.03;
      window.__dragDX = 0;
      window.__dragDY = 0;
    }
    this.x = Math.max(8, Math.min(W - 8, this.x));
    this.y = Math.max(14, Math.min(H - 24, this.y));

    if (this.fireT > 0) this.fireT -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.shield > 0) this.shield -= dt;
    if (this.rapid > 0) this.rapid -= dt;
    if (this.triple > 0) this.triple -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;

    if (keys[' '] && this.fireT <= 0) {
      this.fireT = this.rapid > 0 ? CFG.rapidFireRate : CFG.fireRate;
      this.muzzle = 0.06;
      game.shotsFired++;
      AudioMan.shoot();
      if (this.triple > 0) {
        for (const k of [-1, 0, 1]) {
          game.bullets.push(new Bullet(this.x + k * 4, this.y - 8, k * 26, -CFG.bulletSpeed, true));
        }
      } else {
        game.bullets.push(new Bullet(this.x, this.y - 8, 0, -CFG.bulletSpeed, true));
      }
    }
  }
  hurt(d, game, pierce = false) {
    if (this.shield > 0) {
      Particles.ring(this.x, this.y, '#4df', 14, 0.3);
      return;
    }
    if (this.invuln > 0 && !pierce) return;   // contact hits pierce the blink
    this.hp -= d;
    this.invuln = CFG.invulnTime;
    Shake.add(1.5);
    AudioMan.hurt();
    Particles.spawn(this.x, this.y, { n: 14, colors: ['#fff', '#f84', '#4af'], speed: 45 });
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true;
      Particles.spawn(this.x, this.y, { n: 50, colors: ['#ff8', '#f80', '#f42', '#fff'], speed: 55, life: 0.9 });
      Particles.ring(this.x, this.y, '#fc8', 34, 0.6, 2);
      Shake.add(3);
      AudioMan.expBig();
    }
  }
  draw(ctx) {
    if (this.dead) return;
    const blink = this.invuln > 0 && (this.invuln * 12 | 0) % 2 === 0;
    if (blink) return;
    const x = Math.round(this.x), y = Math.round(this.y);
    // engine flame
    const fl = (this.boosting ? 5 : 2) + (Math.sin(this.engine) * 0.5 + 0.5) * (this.boosting ? 5 : 2);
    ctx.fillStyle = this.boosting ? '#f80' : '#4af';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(this.boosting ? x - 2 : x - 1, y + 6, this.boosting ? 4 : 2, fl + 2);
    ctx.fillStyle = this.boosting ? '#ffe08a' : '#adf';
    ctx.fillRect(x, y + 6, 1, fl);
    ctx.globalAlpha = 1;
    if (this.shield > 0) {
      drawSprite(ctx, 'player_shielded', x, y, 24, 23);
      ctx.globalAlpha = 0.5 + Math.sin(this.shield * 6) * 0.15;
      ctx.strokeStyle = '#4df';
      ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (!drawSprite(ctx, 'player_ship', x, y, 13, 17)) {
      drawFallback(ctx, 'player', x, y, this.r);
    }
    if (this.muzzle > 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 1, y - 12, 2, 4);
      ctx.fillStyle = '#ff8';
      ctx.fillRect(x - 2, y - 10, 4, 2);
    }
  }
}

class Earth {
  constructor() {
    this.hp = CFG.earthHp;
    this.x = CFG.earthX; this.y = CFG.earthY;
    this.r = CFG.earthRadius;
    this.flash = 0;
    this.t = 0;
  }
  damage(d, game) {
    this.hp = Math.max(0, this.hp - d);
    this.flash = 0.25;
    Shake.add(1.2);
    AudioMan.earthHit();
    Particles.spawn(this.x + (Math.random() - 0.5) * 20, this.y - 8,
      { n: 12, colors: ['#f80', '#f42', '#ff8'], speed: 35 });
    if (this.hp <= 0) {
      Particles.spawn(this.x, this.y, { n: 60, colors: ['#f80', '#f42', '#4af', '#3f4'], speed: 70, life: 1 });
      Particles.ring(this.x, this.y, '#f80', 50, 0.8, 3);
      Shake.add(3);
      AudioMan.bossDie();
    }
  }
  get state() {
    if (this.hp > 60) return 'earth1';
    if (this.hp > 30) return 'earth_dmg';
    return 'earth_crit';
  }
  update(dt) { this.t += dt; if (this.flash > 0) this.flash -= dt; }
  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    const px = this.state === 'earth_crit' ? 40 : 34;
    drawSprite(ctx, this.state, x, y, px, px) || drawFallback(ctx, 'earth', x, y, this.r);
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, this.flash * 3);
      ctx.globalCompositeOperation = 'lighter';
      drawSprite(ctx, this.state, x, y, px, px);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // faint atmosphere glow
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#4af';
    ctx.beginPath(); ctx.arc(x, y, this.r + 4 + Math.sin(this.t * 2), 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
