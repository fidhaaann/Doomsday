// Tiny WebAudio synth for retro SFX + music. No external files.
const AudioMan = {
  ctx: null,
  master: null,
  muted: false,
  nextBeat: 0,
  beat: 0,
  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1.0;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.ctx) this.nextBeat = this.ctx.currentTime;
  },
  tone(freq, dur, type = 'square', vol = 0.12, slide = 0, delay = 0) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol = 0.16, freq = 1200, slide = 0, delay = 0) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },
  // chiptune loop, call each frame while playing
  music() {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const beatLen = 0.16;
    const bass = [110, 0, 110, 131, 0, 110, 98, 0, 110, 0, 131, 147, 131, 0, 98, 0];
    while (this.nextBeat < this.ctx.currentTime + 0.05) {
      const b = this.beat % 16;
      const f = bass[b];
      const t = Math.max(this.ctx.currentTime, this.nextBeat);
      if (f) {
        const t0 = t;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.06, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + beatLen * 0.9);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + beatLen);
      }
      if (b % 8 === 4) { // hat-ish tick on offbeat
        const t0 = t;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(6000, t0);
        g.gain.setValueAtTime(0.015, t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03);
        o.connect(g); g.connect(this.master);
        o.start(t0); o.stop(t0 + 0.04);
      }
      this.beat++;
      this.nextBeat += beatLen;
    }
  },
  shoot()   { this.tone(900, 0.06, 'square', 0.09, -500); },
  hitAst()  { this.noise(0.06, 0.14, 2500); },
  expAst()  { this.noise(0.28, 0.24, 1400, -1200); this.tone(120, 0.25, 'sawtooth', 0.1, -80); },
  expBig()  { this.noise(0.55, 0.32, 900, -820); this.tone(90, 0.5, 'sawtooth', 0.14, -60); },
  expAlien(){ this.tone(500, 0.2, 'sawtooth', 0.12, -420); this.noise(0.22, 0.16, 1800, -1400); },
  hurt()    { this.tone(160, 0.16, 'square', 0.16, -60); this.noise(0.1, 0.12, 700); },
  earthHit(){ this.tone(70, 0.3, 'sawtooth', 0.18, -30); this.noise(0.25, 0.18, 500); },
  pickup()  { this.tone(660, 0.07, 'square', 0.12); this.tone(990, 0.09, 'square', 0.12, 0, 0.07); },
  shieldOn(){ this.tone(330, 0.3, 'sine', 0.16, 330); },
  emp()     { this.noise(0.5, 0.28, 3000, -2800); this.tone(1200, 0.4, 'sine', 0.16, -1100); },
  alarm()   { this.tone(700, 0.12, 'square', 0.12); this.tone(500, 0.12, 'square', 0.12, 0, 0.15); },
  warn()    { this.tone(440, 0.1, 'square', 0.12); this.tone(440, 0.1, 'square', 0.12, 0, 0.2); },
  bossIn()  { this.tone(60, 1.1, 'sawtooth', 0.18, 40); this.noise(0.9, 0.09, 300); },
  bossHit() { this.tone(300, 0.05, 'square', 0.09, -100); },
  shieldSmash() { this.tone(1100, 0.06, 'square', 0.16, -700); this.noise(0.22, 0.3, 2400, -1900); this.tone(280, 0.18, 'sawtooth', 0.14, -140); },
  charge()  { this.tone(140, 1.4, 'sawtooth', 0.1, 520); },
  beam()    { this.noise(0.9, 0.3, 600, -480); this.tone(160, 0.9, 'sawtooth', 0.18, -60); },
  bossDie() { this.noise(1.4, 0.35, 2000, -1900); this.tone(50, 1.2, 'sawtooth', 0.2, -30); },
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'square', 0.12, 0, i * 0.1)); },
  gameOver(){ [400, 300, 220, 140].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.14, -40, i * 0.22)); },
  count()   { this.tone(880, 0.08, 'square', 0.1); },
};
