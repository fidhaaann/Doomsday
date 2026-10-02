// Sprite loader: loads extracted sheet sprites, falls back to procedural pixels.
const SPRITES = {};
const SPRITE_FILES = [
  'player_ship','player_ship2','player_shielded',
  'bullet_blue','bullet_blue2','bullet_red','bullet_red2','orb_purple','missile_purple',
  'exp1_a','exp1_b','exp1_c','exp1_d',
  'expA_a','expA_b','expA_c','expA_d',
  'expB_a','expB_b','expB_c','expB_d',
  'exp_blue_a','exp_blue_b','exp_blue_c','exp_purple','exp_purple2',
  'ast_s1','ast_s2','ast_m1','ast_m2','ast_l1','ast_l2',
  'alien1','alien2','alien3','alien4',
  'mothership','mothership2','boss_turret','shield_sphere',
  'earth1','earth_dmg','earth_crit',
  'pw_shield','pw_rapid','pw_triple','pw_emp',
];

const Assets = {
  loaded: false,
  load(cb, onProgress) {
    let left = SPRITE_FILES.length;
    const total = left;
    if (!left) { this.loaded = true; cb(); return; }
    const done = () => {
      left--;
      if (onProgress) onProgress(total - left, total);
      if (left === 0) { this.loaded = true; cb(); }
    };
    for (const name of SPRITE_FILES) {
      const im = new Image();
      im.onload = () => { SPRITES[name] = im; done(); };
      im.onerror = done;
      im.src = 'assets/' + name + '.png';
    }
  },
  get(name) { return SPRITES[name] || null; },
};

function drawSprite(ctx, name, x, y, w, h) {
  const im = SPRITES[name];
  if (im) {
    ctx.drawImage(im, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    return true;
  }
  return false;
}

// Procedural fallbacks (used only if a png failed to load)
function drawFallback(ctx, kind, x, y, r) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  switch (kind) {
    case 'player':
      ctx.fillStyle = '#cde';
      ctx.fillRect(-2, -6, 4, 10);
      ctx.fillRect(-6, 0, 12, 4);
      ctx.fillStyle = '#4af';
      ctx.fillRect(-1, -8, 2, 3);
      ctx.fillStyle = '#f44';
      ctx.fillRect(-5, 3, 2, 2); ctx.fillRect(3, 3, 2, 2);
      break;
    case 'asteroid':
      ctx.fillStyle = '#8a7f74';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#6a5f55';
      ctx.beginPath(); ctx.arc(-r/3, -r/4, r/3, 0, 7); ctx.fill();
      break;
    case 'alien':
      ctx.fillStyle = '#a4f';
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = '#4f4';
      ctx.fillRect(-2, -1, 4, 3);
      break;
    case 'earth':
      ctx.fillStyle = '#2a6fd4';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#3fae4a';
      ctx.beginPath(); ctx.arc(-r/3, -r/4, r/2.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(r/3, r/3, r/3.2, 0, 7); ctx.fill();
      break;
  }
  ctx.restore();
}
