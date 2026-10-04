(function () {
  'use strict';

  /* ============================================================
     STORAGE
     ============================================================ */
  const KEY = 'tapfast_v3';
  const DEFAULT = {
    best: 0,
    coins: 0,
    xp: 0,
    level: 1,
    purchased: [],
    equipped: {
      target: 'classic_circle',
      theme: 'classic',
      effect: 'ripple',
      button: 'classic',
      background: 'clean_white'
    },
    achievements: {},
    stats: {
      games: 0,
      taps: 0,
      hits: 0,
      misses: 0,
      totalReaction: 0,
      reactionSamples: 0,
      bestCombo: 0,
      totalCoins: 0
    },
    settings: {
      sound: true,
      music: true,
      haptics: true,
      notifications: true,
      targetFeedback: true,
      animations: true,
      difficulty: 'normal'
    }
  };

  function loadData() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return deepMerge(JSON.parse(JSON.stringify(DEFAULT)), JSON.parse(raw));
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT));
  }
  function deepMerge(a, b) {
    const out = JSON.parse(JSON.stringify(a));
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) out[k] = deepMerge(out[k] || {}, b[k]);
      else out[k] = b[k];
    }
    return out;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(G.data)); } catch (e) {}
  }

  /* ============================================================
     STATE
     ============================================================ */
  const G = {
    data: loadData(),
    stack: ['splashScreen'],
    game: {
      active: false,
      paused: false,
      score: 0,
      timeLeft: 30,
      duration: 30,
      timerInt: null,
      countInt: null,
      spawnTO: null,
      targetEl: null,
      lastTap: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      taps: 0,
      reactionTotal: 0,
      reactionCount: 0,
      startTime: 0,
      difficulty: 0
    },
    storeCat: 'targets'
  };

  const $ = (id) => document.getElementById(id);

  /* ============================================================
     ICONS
     ============================================================ */
  const ICONS = {
    bolt: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    hand: '<svg viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 1 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>',
    star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>',
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M3 6l4 6 5-8 5 8 4-6-2 14H5z"/></svg>',
    hundred: '<svg viewBox="0 0 24 24"><path d="M5 8h4v10"/><circle cx="15" cy="13" r="4"/></svg>'
  };

  /* ============================================================
     AUDIO
     ============================================================ */
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function tone(freq, dur, type, vol) {
    if (!G.data.settings.sound || !audioCtx) return;
    try {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }
  const sfxTap = () => tone(880, 0.06, 'sine', 0.04);
  const sfxMiss = () => tone(150, 0.1, 'sine', 0.035);
  const sfxCount = () => tone(660, 0.09, 'sine', 0.045);
  const sfxResult = () => { tone(660, 0.13, 'sine', 0.045); setTimeout(() => tone(990, 0.22, 'sine', 0.045), 120); };

  /* ============================================================
     HAPTICS
     ============================================================ */
  function haptic(ms) {
    if (G.data.settings.haptics && navigator.vibrate) {
      try { navigator.vibrate(ms || 8); } catch (e) {}
    }
  }

  /* ============================================================
     NAVIGATION
     ============================================================ */
  function go(id, mode) {
    mode = mode || 'push';
    const fromId = G.stack[G.stack.length - 1];
    if (fromId === id) return;
    const from = $(fromId);
    const to = $(id);
    if (!from || !to) return;

    if (mode === 'push') G.stack.push(id);
    else if (mode === 'pop') G.stack.pop();
    else if (mode === 'replace') G.stack[G.stack.length - 1] = id;

    transition(from, to, mode);
  }

  function transition(from, to, mode) {
    to.classList.remove('hidden');
    to.style.transition = 'none';
    to.style.willChange = 'transform, opacity';

    if (mode === 'push') { to.style.transform = 'translateX(100%)'; to.style.opacity = '1'; }
    else if (mode === 'pop') { to.style.transform = 'translateX(-30%)'; to.style.opacity = '0.5'; }
    else { to.style.transform = 'translateX(0)'; to.style.opacity = '0'; }
    void to.offsetHeight;

    const dur = G.data.settings.animations ? '0.38s' : '0s';
    const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
    to.style.transition = `transform ${dur} ${ease}, opacity ${dur} ${ease}`;
    from.style.transition = `transform ${dur} ${ease}, opacity ${dur} ${ease}`;
    from.style.willChange = 'transform, opacity';

    to.style.transform = 'translateX(0)';
    to.style.opacity = '1';

    if (mode === 'push') { from.style.transform = 'translateX(-30%)'; from.style.opacity = '0.5'; }
    else if (mode === 'pop') { from.style.transform = 'translateX(100%)'; from.style.opacity = '0'; }
    else { from.style.opacity = '0'; }

    setTimeout(() => {
      from.classList.add('hidden');
      from.style.transition = '';
      from.style.transform = '';
      from.style.opacity = '';
      from.style.willChange = '';
      to.style.transition = '';
      to.style.transform = '';
      to.style.opacity = '';
      to.style.willChange = '';
    }, G.data.settings.animations ? 400 : 10);
  }

  /* ============================================================
     SHEET / ALERT / TOAST
     ============================================================ */
  function showSheet(html) {
    const overlay = $('sheetOverlay');
    $('sheetContent').innerHTML = html;
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('showing'));
  }
  function hideSheet() {
    const overlay = $('sheetOverlay');
    overlay.classList.remove('showing');
    setTimeout(() => overlay.classList.add('hidden'), 320);
  }
  $('sheetOverlay').addEventListener('click', (e) => {
    if (e.target === $('sheetOverlay')) hideSheet();
  });

  function showAlert(title, message, actions) {
    $('alertTitle').textContent = title || '';
    $('alertMessage').textContent = message || '';
    const actionsEl = $('alertActions');
    actionsEl.innerHTML = '';
    (actions || [{ label: 'OK', bold: true }]).forEach(a => {
      const btn = document.createElement('button');
      btn.textContent = a.label;
      if (a.bold) btn.classList.add('bold');
      if (a.destructive) btn.classList.add('destructive');
      btn.addEventListener('click', () => {
        hideAlert();
        if (a.onClick) setTimeout(a.onClick, 180);
      });
      actionsEl.appendChild(btn);
    });
    const overlay = $('alertOverlay');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('showing'));
  }
  function hideAlert() {
    const overlay = $('alertOverlay');
    overlay.classList.remove('showing');
    setTimeout(() => overlay.classList.add('hidden'), 280);
  }

  let toastTO = null;
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('showing');
    clearTimeout(toastTO);
    toastTO = setTimeout(() => t.classList.remove('showing'), 1800);
  }

  /* ============================================================
     COSMETICS
     ============================================================ */
  const COSMETICS = {
    targets: [
      { id: 'classic_circle', name: 'Classic Circle', price: 0, shape: 'circle' },
      { id: 'ring', name: 'Ring', price: 150, shape: 'ring' },
      { id: 'square', name: 'Square', price: 200, shape: 'square' },
      { id: 'star', name: 'Star', price: 350, shape: 'star' },
      { id: 'hexagon', name: 'Hexagon', price: 300, shape: 'hexagon' },
      { id: 'pulse', name: 'Pulse', price: 450, shape: 'pulse' },
      { id: 'neon_ring', name: 'Neon Ring', price: 600, shape: 'ring' },
      { id: 'minimal', name: 'Minimal', price: 500, shape: 'minimal' }
    ],
    themes: [
      { id: 'classic', name: 'Classic', price: 0, color: '#0A84FF' },
      { id: 'ocean', name: 'Ocean', price: 120, color: '#00B4D8' },
      { id: 'sunset', name: 'Sunset', price: 180, color: '#FF9500' },
      { id: 'electric', name: 'Electric', price: 250, color: '#5856D6' },
      { id: 'mono', name: 'Mono', price: 200, color: '#1C1C1E' },
      { id: 'retro', name: 'Retro', price: 300, color: '#FF3B30' },
      { id: 'soft', name: 'Soft', price: 280, color: '#AF52DE' },
      { id: 'cosmic', name: 'Cosmic', price: 500, color: '#5E5CE6' }
    ],
    effects: [
      { id: 'ripple', name: 'Ripple', price: 0, type: 'ring' },
      { id: 'circle_burst', name: 'Circle Burst', price: 100, type: 'fill' },
      { id: 'spark', name: 'Spark', price: 180, type: 'spark' },
      { id: 'pulse', name: 'Pulse', price: 220, type: 'pulse' },
      { id: 'ring_expansion', name: 'Ring Expansion', price: 280, type: 'ring' },
      { id: 'soft_particles', name: 'Soft Particles', price: 400, type: 'particles' }
    ],
    buttons: [
      { id: 'classic', name: 'Classic', price: 0, radius: '14px' },
      { id: 'rounded', name: 'Rounded', price: 80, radius: '22px' },
      { id: 'capsule', name: 'Capsule', price: 120, radius: '100px' },
      { id: 'minimal', name: 'Minimal', price: 100, radius: '8px' },
      { id: 'soft', name: 'Soft', price: 150, radius: '18px' }
    ],
    backgrounds: [
      { id: 'clean_white', name: 'Clean White', price: 0, bg: '#FAFAFB' },
      { id: 'soft_gray', name: 'Soft Gray', price: 60, bg: '#F2F2F5' },
      { id: 'blue', name: 'Blue', price: 120, bg: '#EFF6FF' },
      { id: 'dark', name: 'Dark', price: 100, bg: '#1C1C1E' },
      { id: 'gradient', name: 'Gradient', price: 200, bg: 'linear-gradient(180deg, #FAFAFB 0%, #E5E5EA 100%)' },
      { id: 'grid', name: 'Grid', price: 180, bg: 'repeating-linear-gradient(0deg, #FAFAFB 0px, #FAFAFB 28px, #EEEEF2 28px, #EEEEF2 29px)' },
      { id: 'minimal_dots', name: 'Minimal Dots', price: 160, bg: 'radial-gradient(circle, #D1D1D6 1px, transparent 1px) 0 0 / 22px 22px, #FAFAFB' }
    ]
  };

  const LEVEL_UNLOCKS = {
    ring: 3, square: 5, star: 8, hexagon: 7, pulse: 10, neon_ring: 12, minimal: 14,
    ocean: 2, sunset: 6, electric: 8, mono: 10, retro: 12, soft: 13, cosmic: 18,
    circle_burst: 4, spark: 6, pulse_effect: 9, ring_expansion: 11, soft_particles: 15,
    rounded: 2, capsule: 5, minimal_btn: 7, soft_btn: 9,
    soft_gray: 2, blue: 4, dark: 6, gradient: 10, grid: 12, minimal_dots: 14
  };

  function findItem(id) {
    for (const cat of Object.values(COSMETICS)) {
      const f = cat.find(i => i.id === id);
      if (f) return f;
    }
    return null;
  }
  const getPrice = (id) => { const it = findItem(id); return it ? it.price : 0; };
  const isOwned = (id) => G.data.purchased.includes(id) || getPrice(id) === 0;
  function isUnlocked(id) {
    const req = LEVEL_UNLOCKS[id];
    return !req || G.data.level >= req;
  }
  function eqKey(cat) {
    return { targets: 'target', themes: 'theme', effects: 'effect', buttons: 'button', backgrounds: 'background' }[cat];
  }
  function getEquipped(cat) {
    const k = eqKey(cat);
    const val = G.data.equipped[k];
    if (val && findItem(val)) return val;
    return COSMETICS[cat][0].id;
  }

  /* ============================================================
     ACHIEVEMENTS
     ============================================================ */
  const ACHIEVEMENTS = [
    { id: 'first_tap', icon: 'hand', color: '#0A84FF', title: 'First Tap', desc: 'Tap your first target', reward: 10 },
    { id: 'speed_demon', icon: 'bolt', color: '#FF9500', title: 'Speed Demon', desc: 'Score 30 in one round', reward: 50 },
    { id: 'perfect_run', icon: 'star', color: '#FFCC00', title: 'Perfect Run', desc: 'Score 50 with no misses', reward: 100 },
    { id: 'hundred_club', icon: 'hundred', color: '#34C759', title: '100 Club', desc: 'Reach a score of 100', reward: 200 },
    { id: 'tap_master', icon: 'crown', color: '#AF52DE', title: 'Tap Master', desc: 'Score 150 in one round', reward: 300 },
    { id: 'no_miss', icon: 'target', color: '#5E5CE6', title: 'No Miss', desc: 'Complete a round with zero misses', reward: 75 },
    { id: 'high_score', icon: 'chart', color: '#FF3B30', title: 'High Score', desc: 'Beat your best score 5 times', reward: 150 }
  ];

  function checkAchievements() {
    const a = G.data.achievements;
    const g = G.game;
    const newly = [];
    const unlock = (id) => { if (!a[id]) { a[id] = true; newly.push(id); } };

    if (G.data.stats.taps > 0) unlock('first_tap');
    if (g.score >= 30) unlock('speed_demon');
    if (g.score >= 50 && g.misses === 0 && g.hits >= 50) unlock('perfect_run');
    if (g.score >= 100) unlock('hundred_club');
    if (g.score >= 150) unlock('tap_master');
    if (g.misses === 0 && g.hits >= 20) unlock('no_miss');
    if (G.data.stats.games >= 5 && g.score >= G.data.best && g.score > 0) unlock('high_score');

    newly.forEach(id => {
      const ach = ACHIEVEMENTS.find(x => x.id === id);
      if (ach) G.data.coins += ach.reward;
    });
    if (newly.length) save();
    return newly;
  }

  /* ============================================================
     PROGRESSION
     ============================================================ */
  function xpForLevel(l) {
    if (l >= 20) return Infinity;
    return Math.floor(100 * Math.pow(1.35, l - 1));
  }
  function addXp(amount) {
    G.data.xp += amount;
    while (G.data.level < 20 && G.data.xp >= xpForLevel(G.data.level)) {
      G.data.xp -= xpForLevel(G.data.level);
      G.data.level++;
    }
    save();
  }
  function addCoins(amount) {
    G.data.coins += amount;
    G.data.stats.totalCoins += amount;
    save();
  }

  /* ============================================================
     APPLY COSMETICS
     ============================================================ */
  function applyCosmetics() {
    const eq = G.data.equipped;
    const bg = findItem(eq.background);
    const bgVal = bg ? bg.bg : '#FAFAFB';
    document.body.style.background = bgVal;
    $('app').style.background = bgVal;
    document.querySelectorAll('.screen').forEach(s => {
      if (s.id === 'gameScreen') return;
      s.style.background = bgVal;
    });

    const btn = findItem(eq.button);
    const radius = btn ? btn.radius : '14px';
    document.querySelectorAll('.btn-primary, .btn-secondary').forEach(b => {
      b.style.borderRadius = radius;
    });
    document.querySelectorAll('.store-card-btn').forEach(b => {
      b.style.borderRadius = Math.min(parseInt(radius), 100) + 'px';
    });

    if (G.data.settings.animations) document.body.classList.remove('no-anim');
    else document.body.classList.add('no-anim');
  }

  function getThemeColor() {
    const t = findItem(G.data.equipped.theme);
    return t ? t.color : '#0A84FF';
  }

  /* ============================================================
     HOME
     ============================================================ */
  function updateHome() {
    $('homeBest').textContent = G.data.best;
    $('homeLevel').textContent = G.data.level;
    $('homeCoins').textContent = G.data.coins;
  }

  /* ============================================================
     STORE UI
     ============================================================ */
  function renderStore() {
    $('storeCoins').textContent = G.data.coins;
    const cat = G.storeCat;
    const items = COSMETICS[cat];
    const grid = $('storeGrid');
    grid.innerHTML = '';

    items.forEach(item => {
      const owned = isOwned(item.id);
      const unlocked = isUnlocked(item.id);
      const equipped = getEquipped(cat) === item.id;

      const card = document.createElement('div');
      card.className = 'store-card';

      const preview = document.createElement('div');
      preview.className = 'store-card-preview';
      preview.appendChild(buildPreview(cat, item));

      if (equipped) addBadge(preview, 'Equipped', 'owned');
      else if (owned) addBadge(preview, 'Owned', 'owned');
      else if (!unlocked) addBadge(preview, 'Lv ' + LEVEL_UNLOCKS[item.id], 'level');
      else if (item.price >= 300) addBadge(preview, 'Premium', 'premium');
      else if (item.price === 0) addBadge(preview, 'Free', 'free');

      card.appendChild(preview);

      const body = document.createElement('div');
      body.className = 'store-card-body';

      const name = document.createElement('div');
      name.className = 'store-card-name';
      name.textContent = item.name;
      body.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'store-card-meta';
      meta.textContent = owned ? 'Owned' : (unlocked ? item.price + ' coins' : 'Level ' + LEVEL_UNLOCKS[item.id]);
      body.appendChild(meta);

      const btn = document.createElement('button');
      btn.className = 'store-card-btn';
      if (equipped) { btn.classList.add('equipped'); btn.textContent = 'Equipped'; }
      else if (owned) {
        btn.classList.add('equip'); btn.textContent = 'Equip';
        btn.addEventListener('click', () => equipItem(cat, item.id));
      } else if (!unlocked) {
        btn.classList.add('locked'); btn.textContent = 'Locked';
      } else {
        btn.classList.add('buy'); btn.textContent = 'Buy';
        btn.addEventListener('click', () => tryBuy(cat, item));
      }
      body.appendChild(btn);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function addBadge(parent, text, cls) {
    const b = document.createElement('div');
    b.className = 'badge ' + (cls || '');
    b.textContent = text;
    parent.appendChild(b);
  }

  function buildPreview(cat, item) {
    const wrap = document.createElement('div');
    const color = getThemeColor();

    if (cat === 'targets') {
      const s = 58;
      wrap.style.width = s + 'px';
      wrap.style.height = s + 'px';
      const shape = document.createElement('div');
      shape.style.width = s + 'px';
      shape.style.height = s + 'px';
      shape.className = 'shape-' + item.shape;
      if (item.shape === 'ring') {
        shape.style.border = '6px solid ' + color;
        shape.style.background = 'transparent';
      } else {
        shape.style.background = color;
      }
      if (item.id === 'minimal') {
        shape.style.opacity = '0.7';
        shape.style.width = '38px';
        shape.style.height = '38px';
      }
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = 'center';
      wrap.appendChild(shape);
    } else if (cat === 'themes') {
      const dot = document.createElement('div');
      dot.style.width = '46px';
      dot.style.height = '46px';
      dot.style.borderRadius = '50%';
      dot.style.background = item.color;
      dot.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10), inset 0 0 0 1px rgba(255,255,255,0.25)';
      wrap.appendChild(dot);
    } else if (cat === 'effects') {
      const ring = document.createElement('div');
      ring.style.width = '44px';
      ring.style.height = '44px';
      ring.style.borderRadius = '50%';
      if (item.type === 'fill') {
        ring.style.background = color;
        ring.style.opacity = '0.85';
      } else if (item.type === 'ring') {
        ring.style.border = '3px solid ' + color;
      } else {
        ring.style.border = '2px solid ' + color;
        ring.style.boxShadow = '0 0 0 6px ' + hexA(color, 0.15);
      }
      wrap.appendChild(ring);
    } else if (cat === 'buttons') {
      const pill = document.createElement('div');
      pill.style.width = '58px';
      pill.style.height = '28px';
      pill.style.background = color;
      pill.style.borderRadius = item.radius;
      wrap.appendChild(pill);
    } else if (cat === 'backgrounds') {
      const sw = document.createElement('div');
      sw.style.width = '52px';
      sw.style.height = '52px';
      sw.style.borderRadius = '12px';
      sw.style.background = item.bg;
      sw.style.boxShadow = 'inset 0 0 0 1px rgba(60,60,67,0.10)';
      wrap.appendChild(sw);
    }
    return wrap;
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function tryBuy(cat, item) {
    if (G.data.coins < item.price) {
      showToast('Not enough coins');
      haptic(12);
      return;
    }
    showSheet(`
      <div class="sheet-title">${item.name}</div>
      <div class="sheet-message">Unlock this item for ${item.price} coins?</div>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="sheetConfirm">Buy for ${item.price}</button>
        <button class="btn btn-glass" id="sheetCancel">Cancel</button>
      </div>
    `);
    $('sheetConfirm').addEventListener('click', () => {
      if (G.data.coins < item.price) { hideSheet(); showToast('Not enough coins'); return; }
      G.data.coins -= item.price;
      G.data.purchased.push(item.id);
      G.data.equipped[eqKey(cat)] = item.id;
      save();
      hideSheet();
      applyCosmetics();
      renderStore();
      updateHome();
      haptic(18);
      showToast('Purchased');
    });
    $('sheetCancel').addEventListener('click', hideSheet);
  }

  function equipItem(cat, id) {
    G.data.equipped[eqKey(cat)] = id;
    save();
    applyCosmetics();
    renderStore();
    haptic(8);
  }

  /* ============================================================
     STATS UI
     ============================================================ */
  function renderStats() {
    const s = G.data.stats;
    const avg = s.reactionSamples > 0 ? (s.totalReaction / s.reactionSamples) : 0;
    $('statHeroBest').textContent = G.data.best;

    const rows = [
      ['Games Played', s.games],
      ['Total Taps', s.taps],
      ['Successful Taps', s.hits],
      ['Missed Taps', s.misses],
      ['Avg Reaction', avg > 0 ? Math.round(avg) + ' ms' : '—'],
      ['Highest Combo', s.bestCombo],
      ['Total Coins', s.totalCoins],
      ['Level', G.data.level],
      ['XP', G.data.xp + ' / ' + (xpForLevel(G.data.level) === Infinity ? 'MAX' : xpForLevel(G.data.level))]
    ];

    const list = $('statsList');
    list.innerHTML = '';
    rows.forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'group-row no-icon';
      row.innerHTML = `<div class="row-main"><div class="row-title">${label}</div></div><div class="row-value num">${value}</div>`;
      list.appendChild(row);
    });

    const unlockedCount = ACHIEVEMENTS.filter(a => G.data.achievements[a.id]).length;
    $('achievementsProgress').textContent = unlockedCount + ' of ' + ACHIEVEMENTS.length + ' unlocked';
  }

  /* ============================================================
     ACHIEVEMENTS UI
     ============================================================ */
  function renderAchievements() {
    const list = $('achievementsList');
    list.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const unlocked = !!G.data.achievements[a.id];
      const row = document.createElement('div');
      row.className = 'group-row achv-row' + (unlocked ? '' : ' locked');
      row.innerHTML = `
        <div class="row-icon" style="background: ${a.color};">${ICONS[a.icon] || ''}</div>
        <div class="row-main">
          <div class="row-title">${a.title}</div>
          <div class="row-sub">${a.desc}</div>
          <div class="achv-reward">+${a.reward} coins</div>
        </div>
        <div class="achv-check">${unlocked ? ICONS.check : ''}</div>
      `;
      list.appendChild(row);
    });
  }

  /* ============================================================
     SETTINGS UI
     ============================================================ */
  function renderSettings() {
    const s = G.data.settings;
    ['sound', 'music', 'haptics', 'notifications', 'targetFeedback', 'animations'].forEach(k => {
      const sw = $('sw-' + k);
      if (sw) sw.classList.toggle('on', !!s[k]);
    });
    document.querySelectorAll('#difficultySegmented button').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === s.difficulty);
    });
  }

  /* ============================================================
     GAME LOGIC
     ============================================================ */
  const DIFFICULTY = {
    easy:   { duration: 36, baseSize: 96, minSize: 62, ramp: 160 },
    normal: { duration: 30, baseSize: 84, minSize: 50, ramp: 120 },
    hard:   { duration: 24, baseSize: 74, minSize: 44, ramp: 90 }
  };

  function startGame() {
    initAudio();
    const diff = DIFFICULTY[G.data.settings.difficulty] || DIFFICULTY.normal;

    const g = G.game;
    g.active = false;
    g.paused = false;
    g.score = 0;
    g.timeLeft = diff.duration;
    g.duration = diff.duration;
    g.combo = 0;
    g.maxCombo = 0;
    g.hits = 0;
    g.misses = 0;
    g.taps = 0;
    g.reactionTotal = 0;
    g.reactionCount = 0;
    g.lastTap = 0;
    g.difficulty = 0;

    $('gameScore').textContent = '0';
    $('gameTimer').textContent = diff.duration.toFixed(1);
    $('timerBar').style.width = '100%';
    $('timerBar').classList.remove('warn', 'danger');
    $('gameCombo').classList.remove('show');

    if (g.targetEl) { g.targetEl.remove(); g.targetEl = null; }
    if (g.spawnTO) { clearTimeout(g.spawnTO); g.spawnTO = null; }

    go('gameScreen', 'push');

    let count = 3;
    $('countdownNumber').textContent = count;
    $('countdownOverlay').classList.remove('hidden');
    sfxCount();
    haptic(12);

    g.countInt = setInterval(() => {
      count--;
      if (count > 0) {
        $('countdownNumber').textContent = count;
        const el = $('countdownNumber');
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = 'countPop 0.55s cubic-bezier(0.34, 1.4, 0.5, 1) both';
        sfxCount();
        haptic(12);
      } else {
        clearInterval(g.countInt);
        g.countInt = null;
        $('countdownOverlay').classList.add('hidden');
        haptic(22);
        g.active = true;
        g.startTime = performance.now();
        startTimer();
        spawnTarget();
      }
    }, 650);
  }

  function startTimer() {
    const g = G.game;
    const start = performance.now();
    const totalMs = g.duration * 1000;

    g.timerInt = setInterval(() => {
      if (!g.active) return;
      if (g.paused) {
        start += 50;
        return;
      }
      const elapsed = performance.now() - start;
      g.timeLeft = Math.max(0, (totalMs - elapsed) / 1000);
      const t = g.timeLeft;
      $('gameTimer').textContent = t.toFixed(1);
      const pct = t / g.duration * 100;
      const bar = $('timerBar');
      bar.style.width = pct + '%';
      bar.classList.toggle('warn', pct <= 50 && pct > 20);
      bar.classList.toggle('danger', pct <= 20);
      if (g.timeLeft <= 0) endGame();
    }, 50);
  }

  function spawnTarget() {
    const g = G.game;
    if (!g.active) return;
    if (g.targetEl) { g.targetEl.remove(); g.targetEl = null; }

    const area = $('gameArea');
    const W = area.clientWidth;
    const H = area.clientHeight;
    if (W <= 0 || H <= 0) return;

    const diff = DIFFICULTY[G.data.settings.difficulty] || DIFFICULTY.normal;
    const rampT = Math.min(1, g.score / diff.ramp);
    g.difficulty = rampT;

    const size = Math.round(diff.baseSize - rampT * (diff.baseSize - diff.minSize));
    // Safe internal margin — respects target size + safety buffer
    const pad = Math.max(16, Math.round(size * 0.35));
    const maxX = W - size - pad * 2;
    const maxY = H - size - pad * 2;
    if (maxX < 0 || maxY < 0) return;

    const x = pad + Math.random() * maxX;
    const y = pad + Math.random() * maxY;

    const target = document.createElement('div');
    target.className = 'target appear';

    const shapeItem = findItem(G.data.equipped.target);
    const shape = shapeItem ? shapeItem.shape : 'circle';
    target.classList.add('shape-' + shape);

    const color = getThemeColor();
    if (shape === 'ring') {
      target.style.border = '6px solid ' + color;
      target.style.background = 'transparent';
    } else {
      target.style.background = color;
    }
    if (G.data.equipped.target === 'minimal') {
      target.style.opacity = '0.75';
    }

    target.style.width = size + 'px';
    target.style.height = size + 'px';
    target.style.left = x + 'px';
    target.style.top = y + 'px';
    target.dataset.cx = (x + size / 2);
    target.dataset.cy = (y + size / 2);
    target.dataset.size = size;

    target.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onHit(target);
    }, { passive: false });

    area.appendChild(target);
    g.targetEl = target;
  }

  function onHit(target) {
    const g = G.game;
    if (!g.active || g.paused || !target || !target.parentNode) return;

    const now = performance.now();
    const rt = g.lastTap > 0 ? now - g.lastTap : 0;
    if (rt > 0 && rt < 2500) { g.reactionTotal += rt; g.reactionCount++; }
    g.lastTap = now;

    g.score++;
    g.combo++;
    if (g.combo > g.maxCombo) g.maxCombo = g.combo;
    g.hits++;
    g.taps++;

    const scoreEl = $('gameScore');
    scoreEl.textContent = g.score;
    scoreEl.classList.add('pop');
    setTimeout(() => scoreEl.classList.remove('pop'), 140);

    if (g.combo >= 3) {
      const cEl = $('gameCombo');
      cEl.textContent = 'Combo ×' + g.combo;
      cEl.classList.add('show');
    }

    G.data.stats.taps++;
    G.data.stats.hits++;
    if (g.maxCombo > G.data.stats.bestCombo) G.data.stats.bestCombo = g.maxCombo;
    if (rt > 0 && rt < 2500) {
      G.data.stats.totalReaction += rt;
      G.data.stats.reactionSamples++;
    }

    sfxTap();
    haptic(7);

    target.classList.add('hit');
    const cx = parseFloat(target.dataset.cx);
    const cy = parseFloat(target.dataset.cy);
    const size = parseFloat(target.dataset.size);
    spawnEffect(cx, cy, size);

    setTimeout(() => {
      if (target.parentNode) target.remove();
      if (g.targetEl === target) g.targetEl = null;
    }, 160);

    if (g.spawnTO) clearTimeout(g.spawnTO);
    g.spawnTO = setTimeout(() => { if (g.active && !g.paused) spawnTarget(); }, 50);
  }

  function onMiss() {
    const g = G.game;
    if (!g.active || g.paused) return;
    g.combo = 0;
    g.misses++;
    g.taps++;
    G.data.stats.taps++;
    G.data.stats.misses++;
    sfxMiss();
    haptic(5);
    $('gameCombo').classList.remove('show');

    const area = $('gameArea');
    area.style.transition = 'background 0.14s ease';
    area.style.background = 'rgba(255, 59, 48, 0.05)';
    setTimeout(() => { area.style.background = 'transparent'; }, 130);
  }

  function spawnEffect(cx, cy, size) {
    const effectItem = findItem(G.data.equipped.effect);
    const type = effectItem ? effectItem.type : 'ring';
    const color = getThemeColor();
    const area = $('gameArea');

    if (type === 'spark') {
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 / 5) * i;
        const el = document.createElement('div');
        el.className = 'hit-effect';
        el.style.left = cx + 'px';
        el.style.top = cy + 'px';
        el.style.width = '7px';
        el.style.height = '7px';
        el.style.background = color;
        el.style.animation = 'none';
        area.appendChild(el);
        const dx = Math.cos(angle) * 42;
        const dy = Math.sin(angle) * 42;
        requestAnimationFrame(() => {
          el.style.transition = 'transform 0.44s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.44s ease';
          el.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(0.2)`;
          el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 500);
      }
      return;
    }

    const el = document.createElement('div');
    el.className = 'hit-effect';
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';

    if (type === 'fill') {
      el.style.width = size + 'px'; el.style.height = size + 'px';
      el.style.background = color; el.style.opacity = '0.30';
    } else if (type === 'particles') {
      el.style.width = size * 1.2 + 'px'; el.style.height = size * 1.2 + 'px';
      el.style.background = hexA(color, 0.18);
    } else {
      el.style.width = size + 'px'; el.style.height = size + 'px';
      el.style.border = '3px solid ' + color; el.style.background = 'transparent';
    }
    area.appendChild(el);
    setTimeout(() => el.remove(), 550);

    if (G.data.settings.targetFeedback) {
      const pulse = document.createElement('div');
      pulse.className = 'hit-effect';
      pulse.style.left = cx + 'px';
      pulse.style.top = cy + 'px';
      pulse.style.width = size * 0.6 + 'px';
      pulse.style.height = size * 0.6 + 'px';
      pulse.style.border = '2px solid ' + color;
      pulse.style.background = 'transparent';
      pulse.style.opacity = '0.5';
      area.appendChild(pulse);
      setTimeout(() => pulse.remove(), 550);
    }
  }

  $('gameArea').addEventListener('pointerdown', (e) => {
    if (!G.game.active || G.game.paused) return;
    if (e.target.closest('.target')) return;
    if (G.game.targetEl) onMiss();
  });

  function endGame() {
    const g = G.game;
    if (!g.active) return;
    g.active = false;
    g.paused = false;

    if (g.timerInt) { clearInterval(g.timerInt); g.timerInt = null; }
    if (g.countInt) { clearInterval(g.countInt); g.countInt = null; }
    if (g.spawnTO) { clearTimeout(g.spawnTO); g.spawnTO = null; }
    if (g.targetEl) { g.targetEl.remove(); g.targetEl = null; }

    const coinsEarned = Math.floor(g.score * 1.5) + Math.floor(g.maxCombo * 2);
    const xpEarned = Math.floor(g.score * 2) + 10;
    const accuracy = g.taps > 0 ? Math.round(g.hits / g.taps * 100) : 0;
    const avgReaction = g.reactionCount > 0 ? Math.round(g.reactionTotal / g.reactionCount) : 0;

    G.data.stats.games++;

    const isNewBest = g.score > G.data.best;
    if (isNewBest) G.data.best = g.score;

    addCoins(coinsEarned);
    addXp(xpEarned);
    save();

    const newly = checkAchievements();

    sfxResult();
    haptic(28);

    $('resultScore').textContent = g.score;
    $('resultBest').textContent = G.data.best;
    $('resultAccuracy').textContent = accuracy + '%';
    $('resultReaction').textContent = avgReaction > 0 ? avgReaction + ' ms' : '—';
    $('resultMisses').textContent = g.misses;
    $('resultCoins').textContent = '+' + coinsEarned;
    $('resultXp').textContent = '+' + xpEarned;
    $('newBestBadge').classList.toggle('hidden', !isNewBest);

    go('resultScreen', 'replace');

    if (newly.length) {
      const first = ACHIEVEMENTS.find(a => a.id === newly[0]);
      if (first) setTimeout(() => showToast('Achievement: ' + first.title), 700);
    }
  }

  /* ============================================================
     PAUSE / RESUME / ABANDON
     ============================================================ */
  function pauseGame() {
    const g = G.game;
    if (!g.active) return;
    g.paused = true;
    if (g.spawnTO) { clearTimeout(g.spawnTO); g.spawnTO = null; }
    if (g.targetEl) { g.targetEl.style.pointerEvents = 'none'; }
  }

  function resumeGame() {
    const g = G.game;
    if (!g.active) return;
    g.paused = false;
    if (g.targetEl) { g.targetEl.style.pointerEvents = 'auto'; }
    if (!g.targetEl) spawnTarget();
  }

  function abandonGame() {
    const g = G.game;
    g.active = false;
    g.paused = false;
    if (g.timerInt) { clearInterval(g.timerInt); g.timerInt = null; }
    if (g.countInt) { clearInterval(g.countInt); g.countInt = null; }
    if (g.spawnTO) { clearTimeout(g.spawnTO); g.spawnTO = null; }
    if (g.targetEl) { g.targetEl.remove(); g.targetEl = null; }
  }

  /* ============================================================
     EVENT BINDINGS
     ============================================================ */

  // Splash → Home
  setTimeout(() => {
    const splash = $('splashScreen');
    splash.classList.add('splash-out');
    setTimeout(() => {
      go('homeScreen', 'replace');
      G.stack = ['homeScreen'];
    }, 420);
  }, 1500);

  // Home
  $('playBtn').addEventListener('click', () => { haptic(10); startGame(); });
  $('storeBtn').addEventListener('click', () => { haptic(8); renderStore(); go('storeScreen', 'push'); });
  $('statsBtn').addEventListener('click', () => { haptic(8); renderStats(); go('statsScreen', 'push'); });
  $('settingsBtn').addEventListener('click', () => { haptic(8); renderSettings(); go('settingsScreen', 'push'); });

  // Store
  $('storeBackBtn').addEventListener('click', () => { haptic(6); go('homeScreen', 'pop'); });
  document.querySelectorAll('#storeSegments button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#storeSegments button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      G.storeCat = btn.dataset.cat;
      haptic(6);
      renderStore();
    });
  });

  // Stats
  $('statsBackBtn').addEventListener('click', () => { haptic(6); go('homeScreen', 'pop'); });
  $('achievementsBtn').addEventListener('click', () => { haptic(6); renderAchievements(); go('achievementsScreen', 'push'); });
  $('achievementsBackBtn').addEventListener('click', () => { haptic(6); go('statsScreen', 'pop'); });

  // Settings
  $('settingsBackBtn').addEventListener('click', () => { haptic(6); go('homeScreen', 'pop'); });

  ['sound', 'music', 'haptics', 'notifications', 'targetFeedback', 'animations'].forEach(k => {
    const sw = $('sw-' + k);
    if (!sw) return;
    sw.addEventListener('click', () => {
      G.data.settings[k] = !G.data.settings[k];
      save();
      sw.classList.toggle('on', G.data.settings[k]);
      haptic(8);
      if (k === 'animations') applyCosmetics();
      if (k === 'sound' && G.data.settings[k]) initAudio();
    });
  });

  document.querySelectorAll('#difficultySegmented button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#difficultySegmented button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      G.data.settings.difficulty = btn.dataset.diff;
      save();
      haptic(6);
    });
  });

  $('restoreBtn').addEventListener('click', () => {
    haptic(8);
    showAlert('Restore Purchases', 'Your purchases are stored locally on this device and are automatically restored when you open the app.');
  });

  $('resetProgressBtn').addEventListener('click', () => {
    haptic(10);
    showAlert('Reset Progress', 'This will permanently erase all your scores, coins, and unlocks. This cannot be undone.', [
      { label: 'Cancel' },
      { label: 'Reset', destructive: true, bold: true, onClick: () => {
        localStorage.removeItem(KEY);
        G.data = JSON.parse(JSON.stringify(DEFAULT));
        save();
        applyCosmetics();
        renderSettings();
        updateHome();
        showToast('Progress reset');
        go('homeScreen', 'pop');
      }}
    ]);
  });

  $('privacyBtn').addEventListener('click', () => {
    haptic(6);
    showAlert('Privacy Policy', 'Tap Fast stores all data locally on your device. No personal information is collected, transmitted, or shared. Your scores, coins, and settings never leave your phone.');
  });
  $('termsBtn').addEventListener('click', () => {
    haptic(6);
    showAlert('Terms of Service', 'Tap Fast is provided as-is for entertainment purposes. Have fun and play responsibly.');
  });

  // Result
  $('playAgainBtn').addEventListener('click', () => { haptic(10); startGame(); });
  $('homeFromResultBtn').addEventListener('click', () => {
    haptic(6);
    updateHome();
    go('homeScreen', 'pop');
  });

  // Game Exit
  $('gameExitBtn').addEventListener('click', () => {
    const g = G.game;
    if (!g.active) {
      abandonGame();
      updateHome();
      go('homeScreen', 'pop');
      return;
    }
    haptic(10);
    pauseGame();
    showSheet(`
      <div class="sheet-title">Exit Game?</div>
      <div class="sheet-message">Your current round will be lost.</div>
      <div class="sheet-actions">
        <button class="btn btn-primary" id="exitContinue">Continue Playing</button>
        <button class="btn btn-glass" id="exitConfirm">Exit</button>
      </div>
    `);
    $('exitContinue').addEventListener('click', () => {
      hideSheet();
      haptic(8);
      setTimeout(resumeGame, 340);
    });
    $('exitConfirm').addEventListener('click', () => {
      hideSheet();
      haptic(12);
      abandonGame();
      setTimeout(() => {
        updateHome();
        go('homeScreen', 'pop');
      }, 240);
    });
  });

  /* ============================================================
     GLOBAL LISTENERS
     ============================================================ */
  document.addEventListener('pointerdown', function once() {
    initAudio();
    document.removeEventListener('pointerdown', once);
  }, { once: true });

  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('#gameScreen') || e.target.closest('#homeScreen')) {
      if (!e.target.closest('.screen-content') && !e.target.closest('.home-inner')) {
        e.preventDefault();
      }
    }
  }, { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.game.active && !G.game.paused) {
      pauseGame();
      showSheet(`
        <div class="sheet-title">Paused</div>
        <div class="sheet-message">Tap Continue to resume your round.</div>
        <div class="sheet-actions">
          <button class="btn btn-primary" id="pauseContinue">Continue</button>
        </div>
      `);
      $('pauseContinue').addEventListener('click', () => {
        hideSheet();
        setTimeout(resumeGame, 340);
      });
    }
  });

  // Re-place target on resize / orientation change so it stays in bounds
  let resizeTO = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      if (G.game.targetEl && G.game.active && !G.game.paused) {
        const t = G.game.targetEl;
        t.remove();
        G.game.targetEl = null;
        spawnTarget();
      }
    }, 150);
  });

  window.addEventListener('orientationchange', () => {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => {
      if (G.game.targetEl && G.game.active && !G.game.paused) {
        const t = G.game.targetEl;
        t.remove();
        G.game.targetEl = null;
        spawnTarget();
      }
    }, 250);
  });

  /* ============================================================
     INIT
     ============================================================ */
  applyCosmetics();
  updateHome();
  renderSettings();

})();