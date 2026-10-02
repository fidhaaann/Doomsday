// Boot, input, loop, scaling
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  window.RENDER_SCALE = 2;
  function fit() {
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
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
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
  bindHold('padUp', 'w');
  bindHold('padLeft', 'a');
  bindHold('padDown', 's');
  bindHold('padRight', 'd');
  bindHold('tFire', ' ');
  document.getElementById('tBoost').addEventListener('pointerdown', e => {
    e.preventDefault();
    keys['shift'] = !keys['shift'];
    e.currentTarget.classList.toggle('on', keys['shift']);
    AudioMan.init();
  });
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
    const S = window.RENDER_SCALE || 2;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.fillStyle = '#020210';
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
    const lines = [
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
