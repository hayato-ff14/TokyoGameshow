/**
 * main.js — HEX-BURST Entry Point
 */
import { Application, Container } from 'pixi.js';
import { BloomFilter } from 'pixi-filters';
import { gsap } from 'gsap';
import { HexGrid } from './engine/board.js';
import { BattleManager } from './engine/battle.js';
import { UNIT_DEFS, RARITY_COLORS } from './engine/unit.js';
import { ParticleSystem } from './effects/particles.js';
import './styles/main.css';

// ── Design Constants ──
const BASE_W = 1920, BASE_H = 1080;
const BG_COLOR = 0x0A0A0B;

(async () => {
  // ── PixiJS App ──
  const app = new Application();
  await app.init({
    background: BG_COLOR,
    resizeTo: window,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  document.getElementById('game-container').appendChild(app.canvas);

  // ── Main Containers ──
  const worldContainer = new Container();
  worldContainer.sortableChildren = true;
  app.stage.addChild(worldContainer);

  // ── Bloom Filter ──
  const bloom = new BloomFilter({ strength: 2, quality: 4 });
  worldContainer.filters = [bloom];

  // ── Hex Grid (8 rows: 4 enemy + 4 player, 7 cols) ──
  const grid = new HexGrid(8, 7, 42);
  worldContainer.addChild(grid.container);
  grid.drawGrid();

  // ── Unit layer lives INSIDE grid.container so coordinates match ──
  const unitLayer = new Container();
  unitLayer.zIndex = 10;
  unitLayer.sortableChildren = true;
  grid.container.addChild(unitLayer);

  // ── Particles (also inside grid.container for coordinate consistency) ──
  const particles = new ParticleSystem(grid.container);

  // ── Battle Manager ──
  const battle = new BattleManager(grid, unitLayer, particles);

  // ── HUD Elements ──
  const hudRound = document.getElementById('hud-round');
  const hudHP = document.getElementById('hud-hp');
  const hudGold = document.getElementById('hud-gold');
  const hudLevel = document.getElementById('hud-level');
  const hudXPText = document.getElementById('hud-xp-text');
  const hudXPFill = document.getElementById('hud-xp-fill');
  const shopCards = document.getElementById('shop-cards');
  const btnReroll = document.getElementById('btn-reroll');
  const btnBuyXP = document.getElementById('btn-buy-xp');
  const btnBattle = document.getElementById('btn-battle');
  const banner = document.getElementById('battle-banner');

  // ── Update HUD ──
  function updateHUD() {
    hudRound.textContent = battle.round;
    hudHP.textContent = battle.playerHP;
    hudGold.textContent = battle.gold;
    hudLevel.textContent = battle.playerLevel;
    hudXPText.textContent = `${battle.playerXP}/${battle.xpToNextLevel}`;
    const xpRatio = Math.min(1, battle.playerXP / battle.xpToNextLevel);
    hudXPFill.style.width = `${xpRatio * 100}%`;
  }

  // ── Shop Rendering ──
  let currentOffers = [];
  function renderShop() {
    currentOffers = battle.getShopOffers();
    shopCards.innerHTML = '';
    currentOffers.forEach((offer, i) => {
      const def = offer.def;
      if (!def) return; // Safety check
      
      const card = document.createElement('div');
      card.className = `unit-card rarity-${def.rarity} glass`;
      card.id = `shop-card-${i}`;

      // Shape icon via inline SVG
      let svgShape = '';
      const col = '#' + (RARITY_COLORS[def.rarity-1] || 0xFFFFFF).toString(16).padStart(6, '0');
      if (def.shape === 'hexagon') {
        svgShape = `<svg width="40" height="40" viewBox="-20 -20 40 40">
          <polygon points="17,-10 17,10 0,20 -17,10 -17,-10 0,-20"
            fill="${col}33" stroke="${col}" stroke-width="2.5"/>
        </svg>`;
      } else if (def.shape === 'triangle') {
        svgShape = `<svg width="40" height="40" viewBox="-20 -20 40 40">
          <polygon points="0,-18 16,12 -16,12"
            fill="${col}33" stroke="${col}" stroke-width="2.5"/>
        </svg>`;
      } else if (def.shape === 'square') {
        svgShape = `<svg width="40" height="40" viewBox="-20 -20 40 40">
          <rect x="-14" y="-14" width="28" height="28"
            fill="${col}33" stroke="${col}" stroke-width="2.5"/>
        </svg>`;
      } else {
        svgShape = `<svg width="40" height="40" viewBox="-20 -20 40 40">
          <circle r="14" fill="${col}33" stroke="${col}" stroke-width="2.5"/>
        </svg>`;
      }

      card.innerHTML = `
        <div class="card-icon">${svgShape}</div>
        <div class="card-name">${def.name}</div>
        <div class="card-stats">HP:${def.hp} ATK:${def.atk}</div>
        <div class="card-cost">${def.cost}G</div>
      `;
      card.addEventListener('click', () => {
        const unit = battle.buyUnit(offer.type);
        if (unit) {
          updateHUD();
          renderShop();
          // Spawn effect
          particles.spawnBurst(
            unit.container.x,
            unit.container.y,
            unit.color, 20
          );
        }
      });
      shopCards.appendChild(card);
    });
  }

  // ── Buy XP ──
  btnBuyXP.addEventListener('click', () => {
    if (battle.buyXP()) {
      updateHUD();
    }
  });

  // ── Reroll ──
  btnReroll.addEventListener('click', () => {
    if (battle.gold < 2 || battle.state !== 'PREP') return;
    battle.gold -= 2;
    updateHUD();
    renderShop();
  });

  // ── Battle Start ──
  btnBattle.addEventListener('click', () => {
    if (battle.state !== 'PREP') return;
    battle.startCombat();
  });

  // ── Battle State Changes ──
  battle.onStateChange = (state, winner) => {
    if (state === 'COMBAT') {
      btnBattle.style.display = 'none';
      btnReroll.style.display = 'none';
      shopCards.style.display = 'none';
      gsap.to(bloom, { strength: 6, duration: 0.5, ease: 'power2.out' });
    } else if (state === 'RESULT') {
      // Show banner
      banner.textContent = winner === 'player' ? 'VICTORY' : 'DEFEAT';
      banner.className = 'battle-banner ' + (winner === 'player' ? 'victory' : 'defeat');
      gsap.fromTo(banner,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }
      );
      gsap.to(banner, { opacity: 0, delay: 1.5, duration: 0.5 });
      if (winner === 'enemy') particles.screenShake(grid.container, 6);
    } else if (state === 'PREP') {
      btnBattle.style.display = '';
      btnReroll.style.display = '';
      shopCards.style.display = 'flex';
      gsap.to(bloom, { strength: 2, duration: 0.8, ease: 'power2.out' });
      updateHUD();
      renderShop();
    } else if (state === 'GAMEOVER') {
      banner.textContent = 'GAME OVER';
      banner.className = 'battle-banner defeat';
      gsap.fromTo(banner,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(2)' }
      );
    }
  };
  battle.onStatsChange = updateHUD;

  // ── Resize Handler ──
  function handleResize() {
    const w = app.screen.width;
    const h = app.screen.height;
    grid.centerIn(w, h);
    grid.drawGrid();
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // ── Grid Intro Animation ──
  grid.container.alpha = 0;
  gsap.to(grid.container, { alpha: 1, duration: 1.2, ease: 'power2.out', delay: 0.3 });

  // ── Hover Detection ──
  app.canvas.addEventListener('pointermove', (e) => {
    if (battle.state !== 'PREP') { grid.clearHighlight(); return; }
    const rect = app.canvas.getBoundingClientRect();
    const scaleX = app.screen.width / rect.width;
    const scaleY = app.screen.height / rect.height;
    const gx = (e.clientX - rect.left) * scaleX;
    const gy = (e.clientY - rect.top) * scaleY;
    
    const cell = grid.findCellAt(gx, gy);
    if (cell) {
      const color = cell.side === 'enemy' ? 0xFF007A : 0x00F5FF;
      grid.highlightCell(cell, color);
    } else {
      grid.clearHighlight();
    }
  });

  // ── Game Loop ──
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime / 60; // normalize to seconds
    battle.tick(dt);
  });

  // ── Init ──
  updateHUD();
  renderShop();
})();
