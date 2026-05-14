/**
 * unit.js — Unit class with procedural geometric sprites
 */
import { Container, Graphics } from 'pixi.js';
import { gsap } from 'gsap';

export const RARITY_COLORS = [
  0x94A3B8, // 1: Common (Gray)
  0x22C55E, // 2: Uncommon (Green)
  0x3B82F6, // 3: Rare (Blue)
  0xA855F7, // 4: Epic (Purple)
  0xEAB308, // 5: Legendary (Gold)
];

export const UNIT_DEFS = {
  // --- RARITY 1 (Cost 1) ---
  SQUARE:  { name:'SQUARE', rarity:1, hp:500, atk:40, spd:0.6, range:1, cost:1, shape:'square' },
  TRI:     { name:'TRI',    rarity:1, hp:300, atk:60, spd:1.0, range:2, cost:1, shape:'triangle' },
  CIRCLE:  { name:'CIRCLE', rarity:1, hp:250, atk:30, spd:0.8, range:3, cost:1, shape:'circle' },
  
  // --- RARITY 2 (Cost 2) ---
  HEXA:    { name:'HEXA',   rarity:2, hp:700, atk:50, spd:0.6, range:1, cost:2, shape:'hexagon' },
  SPIKE:   { name:'SPIKE',  rarity:2, hp:400, atk:90, spd:1.1, range:2, cost:2, shape:'triangle' },
  RING:    { name:'RING',   rarity:2, hp:350, atk:40, spd:0.9, range:3, cost:2, shape:'circle' },

  // --- RARITY 3 (Cost 3) ---
  GUARD:   { name:'GUARD',  rarity:3, hp:1000, atk:60, spd:0.5, range:1, cost:3, shape:'hexagon' },
  BLADE:   { name:'BLADE',  rarity:3, hp:600, atk:120, spd:1.2, range:1, cost:3, shape:'triangle' },
  MAGE:    { name:'MAGE',   rarity:3, hp:450, atk:80, spd:0.8, range:4, cost:3, shape:'circle' },

  // --- RARITY 4 (Cost 4) ---
  TITAN:   { name:'TITAN',  rarity:4, hp:1800, atk:80, spd:0.4, range:1, cost:4, shape:'hexagon' },
  STORM:   { name:'STORM',  rarity:4, hp:800, atk:150, spd:1.3, range:3, cost:4, shape:'triangle' },
  DIVINE:  { name:'DIVINE', rarity:4, hp:700, atk:100, spd:1.0, range:5, cost:4, shape:'circle' },

  // --- RARITY 5 (Cost 5) ---
  OMEGA:   { name:'OMEGA',  rarity:5, hp:3000, atk:150, spd:0.5, range:2, cost:5, shape:'hexagon' },
  VOID:    { name:'VOID',   rarity:5, hp:1200, atk:300, spd:1.5, range:2, cost:5, shape:'triangle' },
  AURA:    { name:'AURA',   rarity:5, hp:1000, atk:150, spd:1.2, range:6, cost:5, shape:'circle' },
};

export class Unit {
  constructor(type, side='player', tier=1) {
    const def = UNIT_DEFS[type];
    this.type = type; this.side = side; this.tier = tier; this.def = def;
    this.rarity = def.rarity;
    this.color = RARITY_COLORS[this.rarity - 1];

    // Stats scaling: Tier 2 = 2x, Tier 3 = 4x (standard auto-chess scaling)
    const tierMult = Math.pow(2, tier - 1);
    this.maxHp = Math.floor(def.hp * tierMult); this.hp = this.maxHp;
    this.atk = Math.floor(def.atk * tierMult); this.spd = def.spd;
    this.range = def.range; this.cost = def.cost;
    this.q = 0; this.r = 0;
    this.cooldown = 0; this.cooldownMax = 1/this.spd;
    this.alive = true; this.target = null; this.isDragging = false;

    this.container = new Container();
    this.spriteGfx = new Graphics();
    this.glowGfx = new Graphics();
    this.healthBarBg = new Graphics();
    this.healthBarFill = new Graphics();
    this.container.addChild(this.glowGfx, this.spriteGfx, this.healthBarBg, this.healthBarFill);
    this._drawSprite();
    this._drawHealthBar();
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
  }

  _polyShape(gfx, sides, size, color, alpha, offsetAngle=0) {
    const pts = [];
    for (let i=0; i<sides; i++) {
      const a = (Math.PI*2/sides)*i + offsetAngle;
      pts.push(Math.cos(a)*size, Math.sin(a)*size);
    }
    gfx.poly(pts); gfx.fill({color, alpha: alpha*0.2});
    gfx.poly(pts); gfx.stroke({color, width: this.tier>=2?2.5:1.5, alpha});
  }

  _drawSprite() {
    const g = this.spriteGfx, gl = this.glowGfx, s = 16 + (this.tier-1)*2;
    const c = this.color, a = this.side==='enemy'?0.85:1.0;
    g.clear(); gl.clear();
    
    // Draw based on shape
    if (this.def.shape==='hexagon') {
      this._polyShape(g,6,s,c,a,-Math.PI/6);
    } else if (this.def.shape==='triangle') {
      this._polyShape(g,3,s,c,a,-Math.PI/2);
    } else if (this.def.shape==='square') {
      this._polyShape(g,4,s,c,a,Math.PI/4);
    } else {
      g.circle(0,0,s); g.fill({color:c, alpha:a*0.15});
      g.circle(0,0,s); g.stroke({color:c, width:1.5, alpha:a});
    }

    // Glow for higher rarities or tiers
    if (this.rarity >= 4 || this.tier >= 2) {
      this._polyShape(gl, 6, s+4, c, 0.2, 0);
    }

    // Tier Indicators (Stars)
    if (this.tier >= 2) {
      g.beginFill(0xFFD700);
      for (let i=0; i < this.tier; i++) {
        const sx = -10 + i*10, sy = -s - 8;
        g.drawStar(sx, sy, 5, 4);
      }
    }
  }

  _drawHealthBar() {
    const w=28, h=3, y=22+this.tier*2;
    this.healthBarBg.clear();
    this.healthBarBg.roundRect(-w/2,y,w,h,1);
    this.healthBarBg.fill({color:0x1F2937, alpha:0.8});
    this.updateHealthBar();
  }

  updateHealthBar() {
    const w=28, h=3, y=22+this.tier*2, ratio=Math.max(0,this.hp/this.maxHp);
    this.healthBarFill.clear();
    if(ratio>0){
      const c = ratio>0.5?0x00F5FF:ratio>0.25?0xFFD700:0xFF007A;
      this.healthBarFill.roundRect(-w/2,y,w*ratio,h,1);
      this.healthBarFill.fill({color:c, alpha:0.9});
    }
  }

  takeDamage(amount) {
    if(!this.alive) return false;
    this.hp = Math.max(0, this.hp-amount);
    this.updateHealthBar();
    gsap.to(this.spriteGfx,{alpha:0.3,duration:0.08,yoyo:true,repeat:1,ease:'power2.out'});
    if(this.hp<=0){ this.alive=false; return true; }
    return false;
  }

  heal(target) {
    if(!target||!target.alive) return;
    target.hp = Math.min(target.maxHp, target.hp+this.atk);
    target.updateHealthBar();
  }

  setPosition(q,r,grid) {
    this.q=q; this.r=r;
    const p = grid.axialToPixel(q,r);
    this.container.x=p.x; this.container.y=p.y;
  }

  animateToPosition(q,r,grid) {
    this.q=q; this.r=r;
    const p = grid.axialToPixel(q,r);
    gsap.to(this.container,{x:p.x,y:p.y,duration:0.3,ease:'power2.out'});
  }

  playAttackAnim(tc) {
    const dx=tc.x-this.container.x, dy=tc.y-this.container.y;
    const d=Math.sqrt(dx*dx+dy*dy)||1;
    const lx=(dx/d)*12, ly=(dy/d)*12;
    const ox=this.container.x, oy=this.container.y;
    const tl = gsap.timeline();
    tl.to(this.container,{x:ox+lx,y:oy+ly,duration:0.12,ease:'expo.out'});
    tl.to(this.container.scale,{x:1.2,y:1.2,duration:0.08,ease:'expo.out'},'<');
    tl.to(this.container,{x:ox,y:oy,duration:0.25,ease:'expo.out'});
    tl.to(this.container.scale,{x:1,y:1,duration:0.2,ease:'expo.out'},'<');
    return tl;
  }

  playDeathAnim() {
    return gsap.to(this.container,{alpha:0,duration:0.4,ease:'power2.in',
      onComplete:()=>{if(this.container.parent)this.container.parent.removeChild(this.container);}});
  }

  /** Knockout animation — fade out but keep on stage (for player units) */
  playKnockoutAnim() {
    gsap.to(this.container, { alpha: 0.15, duration: 0.4, ease: 'power2.in' });
    gsap.to(this.container.scale, { x: 0.7, y: 0.7, duration: 0.3, ease: 'power2.in' });
  }

  enableDrag(grid, onDrop) {
    this.container.eventMode='static'; this.container.cursor='grab';
    let startPos=null, origQ, origR;
    this.container.on('pointerdown',(e)=>{
      if(this.side!=='player')return;
      startPos={x:this.container.x,y:this.container.y};
      origQ=this.q; origR=this.r; this.isDragging=true;
      this.container.cursor='grabbing'; this.container.alpha=0.7; this.container.zIndex=1000;
    });
    this.container.on('globalpointermove',(e)=>{
      if(!this.isDragging)return;
      const lp=this.container.parent.toLocal(e.global);
      this.container.x=lp.x; this.container.y=lp.y;
      const ax=grid.pixelToAxial(lp.x,lp.y), cell=grid.getCellAt(ax.q,ax.r);
      if(cell&&cell.side==='player') grid.highlightHex(ax.q,ax.r);
      else grid.clearHighlight();
    });
    const pointerUp = (e)=>{
      if(!this.isDragging)return;
      this.isDragging=false; this.container.cursor='grab';
      this.container.alpha=1; this.container.zIndex=1; grid.clearHighlight();
      if(e){
        const lp=this.container.parent.toLocal(e.global);
        const ax=grid.pixelToAxial(lp.x,lp.y), cell=grid.getCellAt(ax.q,ax.r);
        if(cell&&cell.side==='player'){if(onDrop)onDrop(this,origQ,origR,ax.q,ax.r);return;}
      }
      this.container.x=startPos.x; this.container.y=startPos.y;
    };
    this.container.on('pointerup',pointerUp);
    this.container.on('pointerupoutside',()=>pointerUp(null));
  }

  disableDrag(){this.container.eventMode='none';this.container.cursor='default';}

  /** Stop all active GSAP animations on this unit */
  stopAnimations() {
    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.spriteGfx);
    gsap.killTweensOf(this.glowGfx);
    gsap.killTweensOf(this.healthBarFill);
  }

  destroy(){
    this.stopAnimations();
    if(this.container.parent)this.container.parent.removeChild(this.container);
    this.container.destroy({children:true});
  }
}
