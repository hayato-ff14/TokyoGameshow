/**
 * battle.js — Auto-battle state machine
 */
import { Unit, UNIT_DEFS } from './unit.js';

const UNIT_TYPES = ['TANK','DPS','HEALER'];

export class BattleManager {
  constructor(grid, unitContainer, particleSystem) {
    this.grid = grid;
    this.unitContainer = unitContainer;
    this.particles = particleSystem;
    this.state = 'PREP'; // PREP | COMBAT | RESULT
    this.round = 1;
    this.playerHP = 100;
    this.gold = 10;
    
    // --- New Progression Systems ---
    this.playerLevel = 1;
    this.playerXP = 0;
    this.xpToNextLevel = 2; // XP to level up increases
    this.unitCap = 1;      // Board units limit
    
    this.playerUnits = []; // All units owned (board + bench)
    this.enemyUnits = [];
    this.allUnits = [];
    this.combatTimer = 0;
    this.onStateChange = null; // callback
    this.onStatsChange = null;
  }

  // Shop Rarity Odds based on Player Level
  static SHOP_ODDS = {
    1: [100, 0, 0, 0, 0],
    2: [100, 0, 0, 0, 0],
    3: [75, 25, 0, 0, 0],
    4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0],
    6: [30, 40, 25, 5, 0],
    7: [19, 30, 35, 15, 1],
    8: [14, 20, 35, 25, 6],
    9: [10, 15, 30, 30, 15],
  };

  /* ── Shop ── */
  getShopOffers() {
    const offers = [];
    const odds = BattleManager.SHOP_ODDS[this.playerLevel] || BattleManager.SHOP_ODDS[9];
    const unitPool = Object.values(UNIT_DEFS);

    for (let i = 0; i < 5; i++) {
      // Pick rarity
      const roll = Math.random() * 100;
      let rarity = 1, sum = 0;
      for (let r=0; r<5; r++) {
        sum += odds[r];
        if (roll < sum) { rarity = r+1; break; }
      }
      
      const subPool = unitPool.filter(u => u.rarity === rarity);
      const def = subPool[Math.floor(Math.random() * subPool.length)];
      offers.push({ type: def.name, def });
    }
    return offers;
  }

  buyXP() {
    if (this.gold < 4) return false;
    this.gold -= 4;
    this.addXP(4);
    if (this.onStatsChange) this.onStatsChange();
    return true;
  }

  addXP(amt) {
    this.playerXP += amt;
    while (this.playerXP >= this.xpToNextLevel && this.playerLevel < 9) {
      this.playerXP -= this.xpToNextLevel;
      this.playerLevel++;
      this.unitCap = this.playerLevel;
      this.xpToNextLevel = (this.playerLevel + 1) * 2;
    }
  }

  buyUnit(type) {
    const def = UNIT_DEFS[type];
    if (this.gold < def.cost) return null;
    
    // Check bench space
    const emptyBench = this.grid.getEmptyCells('bench');
    if (emptyBench.length === 0) return null;

    this.gold -= def.cost;
    const unit = new Unit(type, 'player', 1);
    const cell = emptyBench[0];
    
    cell.unit = unit;
    this._setUnitPosition(unit, cell);
    
    this.playerUnits.push(unit);
    this.unitContainer.addChild(unit.container);
    unit.enableDrag(this.grid, (u, oq, or, nq, nr, cell) => this._onUnitDrop(u, oq, or, nq, nr, cell));
    
    // Triple check
    this.checkCombines(type, 1);

    if (this.onStatsChange) this.onStatsChange();
    return unit;
  }

  /** Centralized unit positioning (handles bench vs grid) */
  _setUnitPosition(unit, cell) {
    unit.q = cell.q || 0;
    unit.r = cell.r || 0;
    if (cell.side === 'bench') {
      unit.container.x = cell.x;
      unit.container.y = cell.y;
    } else {
      unit.setPosition(cell.q, cell.r, this.grid);
    }
  }

  checkCombines(type, tier) {
    if (tier >= 3) return; // Max tier
    const same = this.playerUnits.filter(u => u.type === type && u.tier === tier);
    if (same.length >= 3) {
      // Merge!
      const targets = same.slice(0, 3);
      const finalPos = { cell: null };
      
      targets.forEach((u, i) => {
        // Find cell
        const cell = [...this.grid.cells.values(), ...this.grid.benchCells].find(c => c.unit === u);
        if (i === 0 && cell) finalPos.cell = cell;
        if (cell) cell.unit = null;
        
        // Visual effect: fly to first unit
        if (i > 0 && finalPos.cell) {
          const targetX = finalPos.cell.side === 'bench' ? finalPos.cell.x : this.grid.axialToPixel(finalPos.cell.q, finalPos.cell.r).x;
          const targetY = finalPos.cell.side === 'bench' ? finalPos.cell.y : this.grid.axialToPixel(finalPos.cell.q, finalPos.cell.r).y;
          gsap.to(u.container, { x: targetX, y: targetY, duration: 0.4, onComplete: () => u.destroy() });
        } else if (i > 0) {
          u.destroy();
        }
        // Remove from list
        this.playerUnits = this.playerUnits.filter(p => p !== u);
      });

      // Create higher tier unit
      setTimeout(() => {
        const upgraded = new Unit(type, 'player', tier + 1);
        this.playerUnits.push(upgraded);
        this.unitContainer.addChild(upgraded.container);
        
        const cell = finalPos.cell || this.grid.getEmptyCells('bench')[0];
        cell.unit = upgraded;
        this._setUnitPosition(upgraded, cell);
        upgraded.enableDrag(this.grid, (u, oq, or, nq, nr, c) => this._onUnitDrop(u, oq, or, nq, nr, c));
        
        this.particles.spawnBurst(upgraded.container.x, upgraded.container.y, upgraded.color, 40);
        
        // Recurse for 3-star
        this.checkCombines(type, tier + 1);
      }, 450);
    }
  }

  _onUnitDrop(unit, oldQ, oldR, newQ, newR, targetCell) {
    // Note: oldQ/oldR might be 0 if from bench. Use finding logic.
    const oldCell = [...this.grid.cells.values(), ...this.grid.benchCells].find(c => c.unit === unit);
    const newCell = targetCell || this.grid.findCellAt(unit.container.x + this.grid.container.x, unit.container.y + this.grid.container.y);

    if (!newCell || (newCell.side === 'enemy')) {
      if (oldCell) this._setUnitPosition(unit, oldCell);
      return;
    }

    // Board unit cap check
    if (newCell.side === 'player' && (!oldCell || oldCell.side !== 'player')) {
      const boardCount = this.playerUnits.filter(u => {
         const c = [...this.grid.cells.values()].find(cell => cell.unit === u);
         return c && c.side === 'player';
      }).length;
      if (boardCount >= this.unitCap) {
        if (oldCell) this._setUnitPosition(unit, oldCell);
        return;
      }
    }

    // Swap logic
    if (newCell.unit && newCell.unit !== unit) {
      const other = newCell.unit;
      if (oldCell) {
        oldCell.unit = other;
        this._setUnitPosition(other, oldCell);
      } else {
        // Nowhere to put the swapped unit? (shouldn't happen with bench)
        const emptyBench = this.grid.getEmptyCells('bench');
        if (emptyBench.length > 0) {
          emptyBench[0].unit = other;
          this._setUnitPosition(other, emptyBench[0]);
        }
      }
    } else if (oldCell) {
      oldCell.unit = null;
    }

    newCell.unit = unit;
    this._setUnitPosition(unit, newCell);
  }

  /* ── Enemy Spawning ── */
  spawnEnemies() {
    // Clear old enemies
    for (const u of this.enemyUnits) u.destroy();
    this.enemyUnits = [];
    const emptyCells = this.grid.getEmptyCells('enemy');
    
    // Neutral Rounds: 1, 5, 10...
    const isNeutral = (this.round % 5 === 0) || this.round === 1;
    const count = isNeutral ? 3 : Math.min(2 + Math.floor(this.round * 0.5), 8);
    const shuffled = emptyCells.sort(() => Math.random()-0.5);

    for (let i = 0; i < count; i++) {
      const type = isNeutral ? 'SQUARE' : Object.keys(UNIT_DEFS)[Math.floor(Math.random() * 8)]; // Lower rarity for early
      const tier = isNeutral ? 1 : (this.round >= 6 ? 2 : 1);
      const unit = new Unit(type, 'enemy', tier);
      const cell = shuffled[i];
      cell.unit = unit;
      unit.setPosition(cell.q, cell.r, this.grid);
      this.enemyUnits.push(unit);
      this.unitContainer.addChild(unit.container);
    }
  }

  /* ── Battle Flow ── */
  startCombat() {
    if (this.state !== 'PREP') return;
    if (this.playerUnits.filter(u=>u.alive).length === 0) return;
    this.state = 'COMBAT';
    // Save pre-battle positions for all player units
    this._preBattlePositions = new Map();
    for (const u of this.playerUnits) {
      this._preBattlePositions.set(u, { q: u.q, r: u.r });
    }
    this.spawnEnemies();
    // Disable drag on all player units
    for (const u of this.playerUnits) u.disableDrag();
    // Build allUnits sorted by speed
    this.allUnits = [...this.playerUnits, ...this.enemyUnits].filter(u=>u.alive);
    for (const u of this.allUnits) { u.cooldown = 0; u.target = null; }
    this.combatTimer = 0;
    if (this.onStateChange) this.onStateChange('COMBAT');
  }

  tick(dt) {
    if (this.state !== 'COMBAT') return;
    this.combatTimer += dt;

    const alive_p = this.playerUnits.filter(u=>u.alive);
    const alive_e = this.enemyUnits.filter(u=>u.alive);

    if (alive_p.length===0 || alive_e.length===0) {
      this._endCombat(alive_p.length > 0 ? 'player' : 'enemy');
      return;
    }

    for (const unit of this.allUnits) {
      if (!unit.alive) continue;
      unit.cooldown += dt;
      if (unit.cooldown < unit.cooldownMax) continue;
      unit.cooldown = 0;

      const enemies = unit.side==='player' ? alive_e : alive_p;
      const allies = unit.side==='player' ? alive_p : alive_e;

      if (unit.type === 'HEALER') {
        // Heal lowest HP ally
        const wounded = (unit.side==='player'?alive_p:alive_e)
          .filter(a=>a!==unit && a.hp<a.maxHp)
          .sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp));
        if (wounded.length>0) {
          const target = wounded[0];
          unit.playAttackAnim(target.container);
          unit.heal(target);
          const px = this.grid.axialToPixel(target.q, target.r);
          this.particles.spawnHeal(px.x, px.y);
        }
        continue;
      }

      // Find nearest enemy
      let nearest=null, nearDist=Infinity;
      for (const e of enemies) {
        const d = this.grid.hexDistance({q:unit.q,r:unit.r},{q:e.q,r:e.r});
        if (d < nearDist) { nearDist=d; nearest=e; }
      }
      if (!nearest) continue;

      if (nearDist <= unit.range) {
        // Attack
        unit.playAttackAnim(nearest.container);
        const px = this.grid.axialToPixel(nearest.q, nearest.r);
        this.particles.spawnImpact(px.x, px.y);
        this.particles.spawnDamageNumber(px.x, px.y - 20, unit.atk);
        const died = nearest.takeDamage(unit.atk);
        if (died) {
          this.particles.spawnBurst(px.x, px.y, nearest.def.color, 60);
          const cell = this.grid.getCellAt(nearest.q, nearest.r);
          if (cell) cell.unit = null;
          // Enemy units disappear; player units stay visible but knocked out
          if (nearest.side === 'enemy') {
            nearest.playDeathAnim();
          } else {
            nearest.playKnockoutAnim();
          }
        }
      } else {
        // Move toward enemy
        this._moveToward(unit, nearest);
      }
    }
  }

  _moveToward(unit, target) {
    const neighbors = this.grid.getNeighbors(unit.q, unit.r);
    let bestCell=null, bestDist=Infinity;
    for (const n of neighbors) {
      const cell = this.grid.getCellAt(n.q, n.r);
      if (!cell || cell.unit) continue;
      const d = this.grid.hexDistance(n, {q:target.q,r:target.r});
      if (d < bestDist) { bestDist=d; bestCell=cell; }
    }
    if (bestCell) {
      const oldCell = this.grid.getCellAt(unit.q, unit.r);
      if (oldCell) oldCell.unit = null;
      bestCell.unit = unit;
      unit.animateToPosition(bestCell.q, bestCell.r, this.grid);
    }
  }

  _endCombat(winner) {
    this.state = 'RESULT';
    if (winner === 'enemy') {
      const remaining = this.enemyUnits.filter(u=>u.alive).length;
      this.playerHP -= remaining * 5;
    }
    // Clear enemy units from grid
    for (const u of this.enemyUnits) {
      const cell = this.grid.getCellAt(u.q, u.r);
      if (cell) cell.unit = null;
      u.destroy();
    }
    this.enemyUnits = [];

    // Clear ENTIRE grid of unit references to be safe
    for (const [, cell] of this.grid.cells) {
      cell.unit = null;
    }

    // Restore ALL player units (including dead ones) to pre-battle positions
    for (const u of this.playerUnits) {
      u.stopAnimations();
      u.alive = true;
      u.hp = u.maxHp;
      u.updateHealthBar();
      
      // Force reset visual state
      gsap.set(u.container, { alpha: 1, visible: true });
      gsap.set(u.container.scale, { x: 1, y: 1 });
      
      // Restore to pre-battle position
      if (this._preBattlePositions && this._preBattlePositions.has(u)) {
        const saved = this._preBattlePositions.get(u);
        const cell = this.grid.getCellAt(saved.q, saved.r);
        if (cell) cell.unit = u;
        // Animate back to original position
        u.animateToPosition(saved.q, saved.r, this.grid);
      }
      u.enableDrag(this.grid, (unit,oq,or,nq,nr)=>this._onUnitDrop(unit,oq,or,nq,nr));
    }
    this._preBattlePositions = null;

    // Round rewards & XP
    this.round++;
    this.gold += 5 + Math.min(Math.floor(this.gold / 10), 5); // Interest up to 5
    this.addXP(2);
    
    if (this.onStatsChange) this.onStatsChange();
    if (this.onStateChange) this.onStateChange('RESULT', winner);

    // Auto-transition back to PREP
    setTimeout(() => {
      if (this.playerHP <= 0) {
        if (this.onStateChange) this.onStateChange('GAMEOVER');
        return;
      }
      this.state = 'PREP';
      if (this.onStateChange) this.onStateChange('PREP');
    }, 2000);
  }
}
