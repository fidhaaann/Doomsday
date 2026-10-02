// Particles + screen shake
const Particles = {
  pool: [],
  rings: [],
  spawn(x, y, opts = {}) {
    const n = opts.n || 10;
    const colors = opts.colors || ['#ff8', '#f80', '#f42', '#a86'];
    const spd = opts.speed || 40;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.3 + Math.random() * 0.9);
      this.pool.push({
        x, y,
        vx: Math.cos(a) * v + (opts.vx || 0),
        vy: Math.sin(a) * v + (opts.vy || 0),
        life: 0.3 + Math.random() * (opts.life || 0.5),
        t: 0,
        c: colors[(Math.random() * colors.length) | 0],
        s: opts.size || (Math.random() < 0.3 ? 2 : 1),
      });
    }
  },
  ring(x, y, color = '#8ff', maxR = 30, life = 0.4, lw = 2) {
    this.rings.push({ x, y, r: 2, maxR, t: 0, life, color, lw });
  },
  update(dt) {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.t += dt;
      if (p.t >= p.life) { this.pool.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      r.r = 2 + (r.maxR - 2) * (r.t / r.life);
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
  },
  draw(ctx) {
    for (const p of this.pool) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    for (const r of this.rings) {
      ctx.globalAlpha = Math.max(0, 1 - r.t / r.life);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lw;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  },
  clear() { this.pool.length = 0; this.rings.length = 0; },
};

const Shake = {
  mag: 0,
  add(m) { this.mag = Math.min(3, this.mag + m); },
  update(dt) { this.mag = Math.max(0, this.mag - dt * 12); },
  ox() { return this.mag > 0.1 ? (Math.random() - 0.5) * this.mag * 2 : 0; },
  oy() { return this.mag > 0.1 ? (Math.random() - 0.5) * this.mag * 2 : 0; },
};
