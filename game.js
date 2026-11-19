const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const livesDisplay = document.getElementById('lives-display');
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');
const startBtn = document.getElementById('start-btn');
const muteBtn = document.getElementById('mute-btn');

// --- Áudio Retrô (Web Audio API) ---
let audioCtx = null;
let isMuted = false;

function playSound(type) {
  if (isMuted) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'jump') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'coin') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.07);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'stomp') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.start(now);
    osc.stop(now + 0.13);
  } else if (type === 'hurt') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.28);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'win') {
    osc.type = 'triangle';
    [523, 659, 784, 1046].forEach((freq, i) => {
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
    });
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.45);
  }
}

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? '🔇' : '🔊';
});

// --- Estado do Jogo ---
const GRAVITY = 0.55;
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, VICTORY
let currentLevelIndex = 0;
let score = 0;
let lives = 3;
let cameraX = 0;
let frameCount = 0;
let particles = [];
let magicOrbs = [];

const keys = { left: false, right: false, jump: false };

const player = {
  x: 60,
  y: 260,
  w: 28,
  h: 34,
  vx: 0,
  vy: 0,
  speed: 3.8,
  jumpForce: -11.2,
  grounded: false,
  facing: 1,
  invulnTimer: 0
};

// --- Fases (3 Fases Progressivas) ---
const LEVELS = [
  {
    name: '1-1',
    width: 2400,
    goalX: 2260,
    platforms: [
      { x: 0, y: 390, w: 680, h: 60 },
      { x: 750, y: 390, w: 540, h: 60 },
      { x: 1360, y: 390, w: 1040, h: 60 },
      // Plataformas flutuantes
      { x: 240, y: 295, w: 120, h: 22 },
      { x: 440, y: 230, w: 120, h: 22 },
      { x: 840, y: 285, w: 140, h: 22 },
      { x: 1060, y: 220, w: 130, h: 22 },
      { x: 1480, y: 295, w: 150, h: 22 },
      { x: 1720, y: 235, w: 140, h: 22 },
      { x: 1960, y: 295, w: 130, h: 22 }
    ],
    fairies: [
      { x: 380, y: 354, minX: 260, maxX: 560, type: 'patrol', speed: 1.5 },
      { x: 920, y: 245, minX: 830, maxX: 1050, type: 'wave', speed: 1.7, baseY: 245 },
      { x: 1550, y: 354, minX: 1420, maxX: 1750, type: 'patrol', speed: 1.8 },
      { x: 1980, y: 240, minX: 1900, maxX: 2120, type: 'wave', speed: 2.0, baseY: 240 }
    ],
    items: [
      { x: 280, y: 260, type: 'strawberry' },
      { x: 320, y: 260, type: 'strawberry' },
      { x: 485, y: 190, type: 'star' },
      { x: 890, y: 250, type: 'strawberry' },
      { x: 1110, y: 180, type: 'star' },
      { x: 1530, y: 260, type: 'strawberry' },
      { x: 1775, y: 195, type: 'strawberry' },
      { x: 2015, y: 255, type: 'star' }
    ]
  },
  {
    name: '1-2',
    width: 2800,
    goalX: 2650,
    platforms: [
      { x: 0, y: 390, w: 500, h: 60 },
      { x: 580, y: 390, w: 420, h: 60 },
      { x: 1100, y: 390, w: 480, h: 60 },
      { x: 1680, y: 390, w: 450, h: 60 },
      { x: 2220, y: 390, w: 580, h: 60 },
      // Plataformas
      { x: 220, y: 290, w: 110, h: 22 },
      { x: 640, y: 280, w: 120, h: 22 },
      { x: 840, y: 210, w: 120, h: 22 },
      { x: 1220, y: 275, w: 140, h: 22 },
      { x: 1450, y: 205, w: 120, h: 22 },
      { x: 1780, y: 275, w: 130, h: 22 },
      { x: 2010, y: 215, w: 130, h: 22 }
    ],
    fairies: [
      { x: 350, y: 354, minX: 240, maxX: 460, type: 'patrol', speed: 1.9 },
      { x: 750, y: 230, minX: 620, maxX: 920, type: 'wave', speed: 2.1, baseY: 230 },
      { x: 1320, y: 345, minX: 1150, maxX: 1500, type: 'caster', speed: 1.3, cooldown: 110 },
      { x: 1850, y: 230, minX: 1730, maxX: 2060, type: 'wave', speed: 2.2, baseY: 230 },
      { x: 2380, y: 354, minX: 2250, maxX: 2540, type: 'patrol', speed: 2.3 }
    ],
    items: [
      { x: 260, y: 255, type: 'strawberry' },
      { x: 685, y: 245, type: 'strawberry' },
      { x: 885, y: 170, type: 'star' },
      { x: 1270, y: 240, type: 'strawberry' },
      { x: 1495, y: 165, type: 'star' },
      { x: 1830, y: 240, type: 'strawberry' },
      { x: 2060, y: 175, type: 'star' },
      { x: 2400, y: 340, type: 'strawberry' }
    ]
  },
  {
    name: '1-3',
    width: 3100,
    goalX: 2940,
    platforms: [
      { x: 0, y: 390, w: 450, h: 60 },
      { x: 540, y: 350, w: 150, h: 22 },
      { x: 770, y: 290, w: 150, h: 22 },
      { x: 1000, y: 390, w: 500, h: 60 },
      { x: 1590, y: 330, w: 140, h: 22 },
      { x: 1810, y: 260, w: 140, h: 22 },
      { x: 2040, y: 390, w: 460, h: 60 },
      { x: 2590, y: 390, w: 510, h: 60 },
      // Extras
      { x: 1140, y: 260, w: 130, h: 22 },
      { x: 2180, y: 265, w: 140, h: 22 }
    ],
    fairies: [
      { x: 320, y: 354, minX: 200, maxX: 420, type: 'patrol', speed: 2.1 },
      { x: 780, y: 230, minX: 600, maxX: 920, type: 'wave', speed: 2.4, baseY: 230 },
      { x: 1260, y: 345, minX: 1040, maxX: 1440, type: 'caster', speed: 1.5, cooldown: 95 },
      { x: 1750, y: 210, minX: 1600, maxX: 1940, type: 'wave', speed: 2.5, baseY: 210 },
      { x: 2260, y: 345, minX: 2070, maxX: 2450, type: 'caster', speed: 1.6, cooldown: 90 },
      { x: 2720, y: 354, minX: 2610, maxX: 2860, type: 'patrol', speed: 2.5 }
    ],
    items: [
      { x: 600, y: 315, type: 'strawberry' },
      { x: 830, y: 255, type: 'star' },
      { x: 1190, y: 220, type: 'star' },
      { x: 1645, y: 295, type: 'strawberry' },
      { x: 1865, y: 220, type: 'star' },
      { x: 2235, y: 225, type: 'star' },
      { x: 2750, y: 340, type: 'strawberry' }
    ]
  }
];

let activeLevel = null;

function loadLevel(index) {
  const template = LEVELS[index];
  activeLevel = {
    name: template.name,
    width: template.width,
    goalX: template.goalX,
    platforms: template.platforms.map(p => ({ ...p })),
    fairies: template.fairies.map(f => ({
      ...f,
      w: 28,
      h: 28,
      dir: 1,
      alive: true,
      timer: f.cooldown || 80
    })),
    items: template.items.map(it => ({
      ...it,
      w: 18,
      h: 18,
      collected: false
    }))
  };

  player.x = 60;
  player.y = 260;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.invulnTimer = 0;
  cameraX = 0;
  magicOrbs = [];
  particles = [];
  updateHUD();
}

function updateHUD() {
  livesDisplay.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives));
  levelDisplay.textContent = activeLevel ? activeLevel.name : '1-1';
  scoreDisplay.textContent = String(score).padStart(5, '0');
}

function spawnParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.8) * 5,
      size: Math.floor(Math.random() * 4) + 3,
      color,
      life: 28 + Math.random() * 14
    });
  }
}

// --- Controles Teclado & Touch ---
window.addEventListener('keydown', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
    keys.jump = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') keys.jump = false;
});

function bindTouch(btnId, keyName) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    keys[keyName] = true;
  });
  btn.addEventListener('touchend', e => {
    e.preventDefault();
    keys[keyName] = false;
  });
}
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-jump', 'jump');

startBtn.addEventListener('click', () => {
  score = 0;
  lives = 3;
  currentLevelIndex = 0;
  loadLevel(currentLevelIndex);
  gameState = 'PLAYING';
  overlay.classList.add('hidden');
});

// --- Atualização Lógica ---
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function damagePlayer() {
  if (player.invulnTimer > 0) return;
  lives--;
  playSound('hurt');
  spawnParticles(player.x + 14, player.y + 16, '#ff1744', 14);
  updateHUD();

  if (lives <= 0) {
    gameState = 'GAMEOVER';
    overlayTitle.textContent = 'AS FADAS TE ENFEITIÇARAM!';
    overlaySubtitle.textContent = `Pontuação final: ${score} pontos. Tente novamente!`;
    startBtn.textContent = 'JOGAR DE NOVO 🌸';
    overlay.classList.remove('hidden');
  } else {
    player.invulnTimer = 85;
    player.vy = -7;
  }
}

function update() {
  frameCount++;
  if (gameState !== 'PLAYING') return;

  if (player.invulnTimer > 0) player.invulnTimer--;

  // Movimento Horizontal
  if (keys.left) {
    player.vx = -player.speed;
    player.facing = -1;
  } else if (keys.right) {
    player.vx = player.speed;
    player.facing = 1;
  } else {
    player.vx *= 0.78;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
  }

  // Pulo
  if (keys.jump && player.grounded) {
    player.vy = player.jumpForce;
    player.grounded = false;
    playSound('jump');
    spawnParticles(player.x + 14, player.y + player.h, '#ffc1e3', 6);
  }

  // Física X
  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > activeLevel.width) player.x = activeLevel.width - player.w;

  for (const plat of activeLevel.platforms) {
    if (rectOverlap(player, plat)) {
      if (player.vx > 0) player.x = plat.x - player.w;
      else if (player.vx < 0) player.x = plat.x + plat.w;
    }
  }

  // Física Y
  player.vy += GRAVITY;
  player.y += player.vy;
  player.grounded = false;

  for (const plat of activeLevel.platforms) {
    if (rectOverlap(player, plat)) {
      if (player.vy > 0) {
        player.y = plat.y - player.h;
        player.vy = 0;
        player.grounded = true;
      } else if (player.vy < 0) {
        player.y = plat.y + plat.h;
        player.vy = 0;
      }
    }
  }

  // Queda em buraco
  if (player.y > canvas.height + 40) {
    damagePlayer();
    if (lives > 0) {
      player.x = Math.max(40, player.x - 140);
      player.y = 140;
      player.vy = 0;
    }
  }

  // Fadas (Inimigas)
  for (const fairy of activeLevel.fairies) {
    if (!fairy.alive) continue;

    fairy.x += fairy.speed * fairy.dir;
    if (fairy.x <= fairy.minX) {
      fairy.x = fairy.minX;
      fairy.dir = 1;
    } else if (fairy.x >= fairy.maxX) {
      fairy.x = fairy.maxX;
      fairy.dir = -1;
    }

    if (fairy.type === 'wave') {
      fairy.y = fairy.baseY + Math.sin(frameCount * 0.07 + fairy.x * 0.02) * 26;
    } else if (fairy.type === 'caster') {
      fairy.timer--;
      if (fairy.timer <= 0) {
        fairy.timer = fairy.cooldown;
        const dirToPlayer = player.x < fairy.x ? -1 : 1;
        magicOrbs.push({
          x: fairy.x + 10,
          y: fairy.y + 12,
          w: 10,
          h: 10,
          vx: dirToPlayer * 3.1,
          life: 160
        });
      }
    }

    // Colisão Jogador vs Fada
    if (rectOverlap(player, fairy)) {
      const isStomp = player.vy > 0 && player.y + player.h - player.vy <= fairy.y + 14;
      if (isStomp) {
        fairy.alive = false;
        player.vy = -8.5;
        score += 100;
        playSound('stomp');
        spawnParticles(fairy.x + 14, fairy.y + 14, '#ff80ab', 16);
        updateHUD();
      } else {
        damagePlayer();
      }
    }
  }

  // Orbes Mágicos das Fadas Feiticeiras
  for (let i = magicOrbs.length - 1; i >= 0; i--) {
    const orb = magicOrbs[i];
    orb.x += orb.vx;
    orb.life--;
    if (rectOverlap(player, orb)) {
      damagePlayer();
      magicOrbs.splice(i, 1);
      continue;
    }
    if (orb.life <= 0) magicOrbs.splice(i, 1);
  }

  // Coletáveis (Morangos e Estrelas)
  for (const item of activeLevel.items) {
    if (!item.collected && rectOverlap(player, item)) {
      item.collected = true;
      score += item.type === 'star' ? 150 : 50;
      playSound('coin');
      spawnParticles(item.x + 9, item.y + 9, item.type === 'star' ? '#fff176' : '#ff4081', 12);
      updateHUD();
    }
  }

  // Partículas
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Chegada na Árvore de Cristal
  if (player.x + player.w >= activeLevel.goalX) {
    score += 300;
    playSound('win');
    updateHUD();

    if (currentLevelIndex + 1 < LEVELS.length) {
      currentLevelIndex++;
      loadLevel(currentLevelIndex);
    } else {
      gameState = 'VICTORY';
      overlayTitle.textContent = 'VOCÊ SALVOU A FLORESTA ROSA! 🌸';
      overlaySubtitle.textContent = `Parabéns! Você venceu todas as fadas com ${score} pontos!`;
      startBtn.textContent = 'JOGAR NOVAMENTE ✨';
      overlay.classList.remove('hidden');
    }
  }

  // Câmera suave
  const targetCam = player.x - canvas.width * 0.35;
  cameraX += (targetCam - cameraX) * 0.12;
  cameraX = Math.max(0, Math.min(activeLevel.width - canvas.width, cameraX));
}

// --- Renderização Pixel Art ---
function drawBackground() {
  // Céu rosa pastel em faixas retrô
  const bands = ['#ffe6f2', '#ffd6ea', '#ffc4e1', '#ffb2d8'];
  const bandH = canvas.height / bands.length;
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * bandH, canvas.width, bandH + 1);
  });

  // Nuvens fofas (parallax lento)
  ctx.fillStyle = '#fff5fa';
  for (let i = 0; i < 10; i++) {
    const cx = ((i * 260 - cameraX * 0.2) % (canvas.width + 260) + (canvas.width + 260)) % (canvas.width + 260) - 100;
    const cy = 50 + (i % 3) * 35;
    ctx.fillRect(cx, cy, 64, 18);
    ctx.fillRect(cx + 12, cy - 10, 40, 12);
  }

  // Árvores rosas ao fundo (parallax médio)
  for (let i = 0; i < 16; i++) {
    const tx = ((i * 190 - cameraX * 0.45) % (canvas.width + 220) + (canvas.width + 220)) % (canvas.width + 220) - 90;
    // Tronco lilás-rosado
    ctx.fillStyle = '#b35c85';
    ctx.fillRect(tx + 26, 250, 18, 150);
    // Copa sakura pixelada
    ctx.fillStyle = '#ff9ec7';
    ctx.fillRect(tx, 195, 70, 58);
    ctx.fillStyle = '#ffb8d7';
    ctx.fillRect(tx + 10, 178, 50, 24);
  }
}

function drawPlatforms() {
  for (const plat of activeLevel.platforms) {
    const sx = Math.floor(plat.x - cameraX);
    if (sx + plat.w < 0 || sx > canvas.width) continue;

    // Terra rosa-chocolate
    ctx.fillStyle = '#c96b96';
    ctx.fillRect(sx, plat.y, plat.w, plat.h);

    // Topo de grama sakura
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(sx, plat.y, plat.w, 10);
    ctx.fillStyle = '#ffb6d9';
    ctx.fillRect(sx, plat.y, plat.w, 4);

    // Flores decorativas no chão
    if (plat.h > 30) {
      for (let fx = sx + 16; fx < sx + plat.w - 20; fx += 58) {
        ctx.fillStyle = '#fff0f6';
        ctx.fillRect(fx, plat.y - 6, 6, 6);
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(fx + 2, plat.y - 4, 2, 2);
      }
    }
  }
}

function drawGoalTree() {
  const gx = Math.floor(activeLevel.goalX - cameraX);
  // Tronco brilhante
  ctx.fillStyle = '#8e24aa';
  ctx.fillRect(gx + 24, 240, 28, 150);
  // Copa gigante rosa-cristal
  ctx.fillStyle = '#ff4081';
  ctx.fillRect(gx - 14, 165, 104, 80);
  ctx.fillStyle = '#ff80ab';
  ctx.fillRect(gx, 140, 76, 32);
  // Estrela no topo
  ctx.fillStyle = '#fff59d';
  ctx.fillRect(gx + 32, 122, 12, 12);
}

function drawPlayer() {
  if (player.invulnTimer > 0 && Math.floor(frameCount / 4) % 2 === 0) return;
  const px = Math.floor(player.x - cameraX);
  const py = Math.floor(player.y);

  // Vestido rosa
  ctx.fillStyle = '#ff4081';
  ctx.fillRect(px + 4, py + 14, 20, 14);
  // Cabeça
  ctx.fillStyle = '#ffe0d6';
  ctx.fillRect(px + 6, py + 4, 16, 12);
  // Cabelo rosa-claro
  ctx.fillStyle = '#ff80ab';
  ctx.fillRect(px + 4, py + 2, 20, 6);
  ctx.fillRect(px + 4, py + 6, 4, 10);
  // Laço grande no topo
  ctx.fillStyle = '#d5006d';
  ctx.fillRect(px + 8, py - 2, 12, 5);
  // Olhos
  ctx.fillStyle = '#4a0e2e';
  const eyeX = player.facing === 1 ? px + 16 : px + 8;
  ctx.fillRect(eyeX, py + 9, 3, 3);
  // Botinhas
  ctx.fillStyle = '#ad1457';
  const step = Math.abs(player.vx) > 0.3 ? Math.sin(frameCount * 0.3) * 2 : 0;
  ctx.fillRect(px + 6, py + 28 + step, 6, 6);
  ctx.fillRect(px + 16, py + 28 - step, 6, 6);
}

function drawFairies() {
  for (const fairy of activeLevel.fairies) {
    if (!fairy.alive) continue;
    const fx = Math.floor(fairy.x - cameraX);
    const fy = Math.floor(fairy.y);
    const wingFlap = Math.sin(frameCount * 0.45) * 4;

    // Asas brilhantes
    ctx.fillStyle = '#e1f5fe';
    ctx.fillRect(fx - 4, fy + 4 - wingFlap, 10, 12);
    ctx.fillRect(fx + 22, fy + 4 - wingFlap, 10, 12);

    // Corpo da Fada (cor varia por tipo)
    ctx.fillStyle = fairy.type === 'caster' ? '#ab47bc' : fairy.type === 'wave' ? '#ec407a' : '#f06292';
    ctx.fillRect(fx + 6, fy + 10, 16, 14);

    // Cabeça
    ctx.fillStyle = '#fff3e0';
    ctx.fillRect(fx + 8, fy + 2, 12, 10);

    // Coroa / Brilho
    ctx.fillStyle = '#fff176';
    ctx.fillRect(fx + 10, fy - 2, 8, 4);

    // Olhinhos travessos
    ctx.fillStyle = '#880e4f';
    ctx.fillRect(fx + 10, fy + 6, 2, 2);
    ctx.fillRect(fx + 16, fy + 6, 2, 2);
  }
}

function drawItemsAndEffects() {
  // Morangos e Estrelas
  for (const item of activeLevel.items) {
    if (item.collected) continue;
    const ix = Math.floor(item.x - cameraX);
    const bob = Math.sin(frameCount * 0.1 + item.x) * 3;
    const iy = Math.floor(item.y + bob);

    if (item.type === 'strawberry') {
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(ix + 2, iy + 4, 14, 14);
      ctx.fillStyle = '#69f0ae';
      ctx.fillRect(ix + 4, iy, 10, 4);
    } else {
      ctx.fillStyle = '#ffee58';
      ctx.fillRect(ix + 3, iy + 3, 12, 12);
      ctx.fillStyle = '#fff';
      ctx.fillRect(ix + 7, iy + 6, 4, 4);
    }
  }

  // Orbes mágicos
  for (const orb of magicOrbs) {
    const ox = Math.floor(orb.x - cameraX);
    ctx.fillStyle = '#ea80fc';
    ctx.fillRect(ox, orb.y, orb.w, orb.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox + 3, orb.y + 3, 4, 4);
  }

  // Partículas
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x - cameraX), Math.floor(p.y), p.size, p.size);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  if (activeLevel) {
    drawPlatforms();
    drawGoalTree();
    drawItemsAndEffects();
    drawFairies();
    drawPlayer();
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Inicializa visualização inicial
loadLevel(0);
gameLoop();