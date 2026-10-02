// Boot, input, loop, scaling
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  window.IS_TOUCH = isTouch;

  window.RENDER_SCALE = 2;
  window.RENDER_SX = 2; window.RENDER_SY = 2;
  function fit() {
    if (isTouch) {
      // phone: fill the whole screen, render at device pixel resolution.
      // world scale is capped at 1.5x aspect distortion — the nebula bg
      // still covers the full canvas so there are no plain black bars.
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.imageSmoothingEnabled = false;
      window.RENDER_SX = canvas.width / W;        // full-fill scale (bg)
      window.RENDER_SY = canvas.height / H;
      const portrait = canvas.height > canvas.width;
      // notch / status-bar safe area in device px
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;top:0;left:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
      window.SAFE_TOP_PX = Math.round((probe.offsetHeight || 0) * dpr) + Math.round(8 * dpr);
      probe.remove();
      if (portrait) {
        // Game Boy layout: framed screen up top, console body + buttons below.
        // The screen never reaches the URL bar, so the in-screen HUD stays visible.
        window.HUD_PX = 0;                       // HUD draws inside the screen
        const scrX = Math.round(canvas.width * 0.045);
        const scrW = canvas.width - 2 * scrX;
        const scrY = window.SAFE_TOP_PX + Math.round(canvas.width * 0.16);
        // bezel sized to the world's aspect (1.75x vertical) so the game
        // fills the screen edge to edge — no gaps inside the frame
        const scrH = Math.round(scrW * (H / W) * 1.75);
        const bz = Math.max(4, Math.round(canvas.width * 0.008));
        window.CONSOLE = { x: scrX, y: scrY, w: scrW, h: scrH, b: bz };
        window.RENDER_WX = (scrW - 2 * bz) / W;
        window.RENDER_WY = (scrH - 2 * bz) / H;
        window.RENDER_OX = scrX + bz;
        window.RENDER_OY = scrY + bz;
        window.RENDER_SCALE = Math.min(window.RENDER_WX, window.RENDER_WY);
        return;
      }
      window.HUD_PX = 0;
      window.CONSOLE = null;
      let wx = window.RENDER_SX;
      let wy = window.RENDER_SY;
      const MAX_DISTORT = 1.5;
      if (wx / wy > MAX_DISTORT) wx = wy * MAX_DISTORT;
      if (wy / wx > MAX_DISTORT) wy = wx * MAX_DISTORT;
      window.RENDER_WX = wx;
      window.RENDER_WY = wy;
      window.RENDER_OX = (canvas.width - W * wx) / 2;
      window.RENDER_OY = (canvas.height - H * wy) / 2;
      window.RENDER_SCALE = Math.min(wx, wy);
      return;
    }
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = (W * scale | 0) + 'px';
    canvas.style.height = (H * scale | 0) + 'px';
    // render at ~integer multiple of logical res: sprites stay pixel-sharp,
    // text rasterizes at real device resolution
    const S = Math.max(1, Math.min(6, Math.round(scale)));
    if (canvas.width !== W * S) {
      canvas.width = W * S;
      canvas.height = H * S;
      ctx.imageSmoothingEnabled = false;
      window.RENDER_SCALE = S;
      window.RENDER_SX = S; window.RENDER_SY = S;
      window.RENDER_WX = S; window.RENDER_WY = S;
      window.RENDER_OX = 0; window.RENDER_OY = 0;
      window.HUD_PX = 0;
      window.CONSOLE = null;
    }
  }
  window.addEventListener('resize', fit);
  fit();

  const keys = {};
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ([' ', 'w', 'a', 's', 'd', 'e', 'p', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
    if (!keys[k] && game) game.handleKey(k);
    keys[k] = true;
    AudioMan.init();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('mousedown', () => AudioMan.init());

  // ---- mobile touch controls ----
  const touchUI = document.getElementById('touch');
  const powBadge = document.getElementById('tPowN');
  function bindHold(id, k) {
    const b = document.getElementById(id);
    const on = e => {
      e.preventDefault();
      if (!keys[k] && game) game.handleKey(k);
      keys[k] = true;
      AudioMan.init();
      b.classList.add('on');
    };
    const off = e => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  }
  bindHold('tFire', ' ');
  // slide-finger movement: drag anywhere on the canvas, the ship follows
  // relative finger motion (like Galaxy Attack / 1945 style controls)
  let dragId = null, lastTX = 0, lastTY = 0;
  window.__dragDX = 0; window.__dragDY = 0;
  canvas.addEventListener('pointerdown', e => {
    if (!isTouch || !game) return;
    if (!['intro', 'playing', 'dying'].includes(game.state)) return;
    dragId = e.pointerId; lastTX = e.clientX; lastTY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== dragId) return;
    const dpr = window.devicePixelRatio || 1;
    window.__dragDX += (e.clientX - lastTX) * dpr / (window.RENDER_WX || 1) * 1.15;
    window.__dragDY += (e.clientY - lastTY) * dpr / (window.RENDER_WY || 1) * 1.15;
    lastTX = e.clientX; lastTY = e.clientY;
  });
  const dragEnd = e => { if (e.pointerId === dragId) dragId = null; };
  canvas.addEventListener('pointerup', dragEnd);
  canvas.addEventListener('pointercancel', dragEnd);
  document.getElementById('tPow').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (game) game.handleKey('e');
    AudioMan.init();
  });
  document.getElementById('tPause').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (game) game.handleKey('p');
  });
  // tap anywhere = SPACE when not in gameplay (menus / transitions)
  canvas.addEventListener('pointerdown', () => {
    if (!game) return;
    AudioMan.init();
    if (!['intro', 'playing', 'dying', 'paused'].includes(game.state)) game.handleKey(' ');
  });

  // console shell: body gradient, screen bezel, logo, LED, hints
  window.drawConsoleShell = function () {
    const R = window.CONSOLE;
    if (!R) return;
    const cw = canvas.width, chh = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, chh);
    g.addColorStop(0, '#45455e'); g.addColorStop(0.55, '#33334a'); g.addColorStop(1, '#23232f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, chh);
    const ls = Math.max(4, Math.round(cw * 0.013));
    ctx.fillStyle = '#f33';
    ctx.fillRect(Math.round(cw * 0.07), R.y - Math.round(cw * 0.075), Math.round(cw * 0.018), Math.round(cw * 0.018));
    pixText(ctx, 'POWER', Math.round(cw * 0.10), R.y - Math.round(cw * 0.068), Math.max(2, Math.round(ls * 0.55)), '#889', 'left');
    ctx.fillStyle = '#101018';
    ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.strokeStyle = 'rgba(130,140,200,0.4)';
    ctx.lineWidth = Math.max(2, Math.round(cw * 0.003));
    ctx.strokeRect(R.x + 1, R.y + 1, R.w - 2, R.h - 2);
    ctx.fillStyle = '#02040e';
    ctx.fillRect(window.RENDER_OX, window.RENDER_OY, W * window.RENDER_WX, H * window.RENDER_WY);
    // speaker grille + control hints on the console body
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const gy = Math.round(chh * 0.80);
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(Math.round(cw * 0.05) + i * Math.round(cw * 0.022), gy, Math.round(cw * 0.008), Math.round(cw * 0.10));
    }
    pixText(ctx, 'SLIDE ON SCREEN TO MOVE', cw / 2, Math.round(chh * 0.56), Math.max(2, Math.round(cw * 0.005)), '#667', 'center');
  };

  let game = null;
  function startGame() {
    game = new Game(ctx);
    window.__game = game;   // debug/testing handle
    let last = performance.now();
    function loop(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;   // clamp big frames
      requestAnimationFrame(loop);  // schedule first: one bad frame can't freeze the game
      try {
        game.update(dt, keys);
        game.draw();
        if (isTouch) {
          const inGame = ['intro', 'playing', 'dying', 'paused'].includes(game.state);
          touchUI.style.display = inGame ? 'block' : 'none';
          const n = game.player ? game.player.stored.length : 0;
          powBadge.style.display = n ? 'block' : 'none';
          powBadge.textContent = n;
        }
      } catch (e) {
        console.error(e);
      }
    }
    requestAnimationFrame(loop);
  }

  // ---- loading / instructions screen ----
  const bootStart = performance.now();
  const BOOT_MIN = 2800;                 // long enough to read the controls
  let loadDone = false, loadProgress = 0;
  function drawBoot(t) {
    const WX = window.RENDER_WX || 2, WY = window.RENDER_WY || 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (window.CONSOLE) window.drawConsoleShell();
    ctx.setTransform(WX, 0, 0, WY, window.RENDER_OX || 0, window.RENDER_OY || 0);
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.001 + i * 1.7));
      ctx.fillStyle = i % 9 === 0 ? '#9cf' : '#778';
      ctx.fillRect((i * 73) % W, (i * 41) % H, 1, 1);
    }
    ctx.globalAlpha = 1;
    pixText(ctx, 'DOOMSDAY', W / 2, 14, 5, '#f66', 'center');
    const bw = 120;
    ctx.strokeStyle = '#345';
    ctx.strokeRect(W / 2 - bw / 2 - 0.5, 50.5, bw + 1, 6);
    ctx.fillStyle = '#4f8';
    ctx.fillRect(W / 2 - bw / 2, 52, bw * loadProgress, 3);
    pixText(ctx, loadDone ? 'READY' : 'LOADING...', W / 2, 62, 1, '#678', 'center');
    const touch = navigator.maxTouchPoints > 0;
    const lines = touch ? [
      ['HOW TO PLAY', '#8ef'],
      ['SLIDE - MOVE   FIRE - SHOOT', '#cde'],
      ['PWR - USE POWER-UP', '#cde'],
      ['', '#000'],
      ['SURVIVE 60 SECONDS EACH LEVEL', '#fc8'],
      ['DESTROY THE MOTHERSHIP IN LEVEL 5', '#f8a'],
    ] : [
      ['HOW TO PLAY', '#8ef'],
      ['WASD / ARROWS - MOVE', '#cde'],
      ['SPACE - SHOOT', '#cde'],
      ['E - USE POWER-UP', '#cde'],
      ['SHIFT - ROCKET BOOST', '#cde'],
      ['P - PAUSE   M - MUTE', '#cde'],
      ['MOBILE: ON-SCREEN CONTROLS', '#8af'],
      ['', '#000'],
      ['SURVIVE 60 SECONDS EACH LEVEL', '#fc8'],
      ['DESTROY THE MOTHERSHIP IN LEVEL 5', '#f8a'],
    ];
    lines.forEach(([txt, c], i) => { if (txt) pixText(ctx, txt, W / 2, 80 + i * 9, 1, c, 'center'); });
  }
  Assets.load(() => { loadDone = true; }, (n, t) => { loadProgress = n / t; });
  (function boot() {
    drawBoot(performance.now());
    if (!loadDone || performance.now() - bootStart < BOOT_MIN) {
      requestAnimationFrame(boot);
    } else {
      startGame();
    }
  })();
})();
