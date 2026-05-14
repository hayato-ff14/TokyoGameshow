/**
 * particles.js — Geometric particle effects with GSAP
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';

export class ParticleSystem {
  constructor(stage) {
    this.container = new Container();
    this.container.zIndex = 500;
    stage.addChild(this.container);
  }

  /** Burst of geometric particles (death / big hit) */
  spawnBurst(x, y, color=0x00F5FF, count=40) {
    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const shapeType = Math.floor(Math.random()*3);
      const sz = 2 + Math.random()*5;
      if (shapeType===0) { // triangle
        g.poly([-sz,-sz, sz,-sz, 0,sz]);
        g.fill({color, alpha:0.9});
      } else if (shapeType===1) { // square
        g.rect(-sz/2,-sz/2,sz,sz);
        g.fill({color, alpha:0.9});
      } else { // diamond
        g.poly([0,-sz, sz,0, 0,sz, -sz,0]);
        g.fill({color, alpha:0.9});
      }
      g.x = x; g.y = y;
      this.container.addChild(g);

      const angle = (Math.PI*2/count)*i + (Math.random()-0.5)*0.5;
      const dist = 60 + Math.random()*120;
      const dx = Math.cos(angle)*dist;
      const dy = Math.sin(angle)*dist;

      gsap.to(g, {
        x: x+dx, y: y+dy,
        rotation: Math.random()*Math.PI*4,
        alpha: 0,
        duration: 0.6+Math.random()*0.4,
        ease: 'expo.out',
        delay: i*0.008,
        onComplete: () => { this.container.removeChild(g); g.destroy(); }
      });
      gsap.to(g.scale, {
        x: 0.2, y: 0.2,
        duration: 0.8,
        ease: 'power2.in',
        delay: i*0.008
      });
    }
  }

  /** Impact ring (attack hit) */
  spawnImpact(x, y, color=0x00F5FF) {
    // Ring
    const ring = new Graphics();
    ring.circle(0,0,5);
    ring.stroke({color, width:2, alpha:0.9});
    ring.x=x; ring.y=y;
    this.container.addChild(ring);
    gsap.to(ring.scale, {x:4,y:4, duration:0.35, ease:'expo.out'});
    gsap.to(ring, {alpha:0, duration:0.35, ease:'power2.in',
      onComplete:()=>{this.container.removeChild(ring);ring.destroy();}});

    // Flash
    const flash = new Graphics();
    flash.circle(0,0,8);
    flash.fill({color:0xFFFFFF, alpha:0.8});
    flash.x=x; flash.y=y;
    this.container.addChild(flash);
    gsap.to(flash, {alpha:0, duration:0.2, ease:'power2.out',
      onComplete:()=>{this.container.removeChild(flash);flash.destroy();}});
    gsap.to(flash.scale, {x:2.5,y:2.5, duration:0.2, ease:'expo.out'});

    // Small particles
    for (let i=0;i<8;i++) {
      const p = new Graphics();
      p.rect(-1,-1,2,2);
      p.fill({color, alpha:0.8});
      p.x=x; p.y=y;
      this.container.addChild(p);
      const a = (Math.PI*2/8)*i;
      gsap.to(p,{x:x+Math.cos(a)*25, y:y+Math.sin(a)*25, alpha:0,
        duration:0.3, ease:'expo.out',
        onComplete:()=>{this.container.removeChild(p);p.destroy();}});
    }
  }

  /** Heal effect (rising sparkles) */
  spawnHeal(x, y) {
    for (let i=0;i<6;i++) {
      const p = new Graphics();
      p.circle(0,0,2);
      p.fill({color:0xFFD700, alpha:0.9});
      p.x = x + (Math.random()-0.5)*20;
      p.y = y;
      this.container.addChild(p);
      gsap.to(p, {
        y: y-40-Math.random()*20, alpha:0,
        duration:0.6+Math.random()*0.3,
        ease:'power2.out', delay:i*0.06,
        onComplete:()=>{this.container.removeChild(p);p.destroy();}
      });
    }
    // Plus sign
    const plus = new Graphics();
    plus.rect(-6,-1.5,12,3); plus.fill({color:0xFFD700,alpha:0.7});
    plus.rect(-1.5,-6,3,12); plus.fill({color:0xFFD700,alpha:0.7});
    plus.x=x; plus.y=y;
    this.container.addChild(plus);
    gsap.to(plus,{y:y-30,alpha:0,duration:0.5,ease:'power2.out',
      onComplete:()=>{this.container.removeChild(plus);plus.destroy();}});
    gsap.to(plus.scale,{x:1.5,y:1.5,duration:0.5,ease:'power2.out'});
  }

  /** Floating damage number */
  spawnDamageNumber(x, y, value) {
    const style = new TextStyle({
      fontFamily:'JetBrains Mono', fontSize:16, fontWeight:'bold',
      fill:0xFFFFFF, stroke:{color:0x000000, width:3},
    });
    const txt = new Text({text:String(value), style});
    txt.anchor = {x:0.5, y:0.5};
    txt.x=x; txt.y=y;
    this.container.addChild(txt);
    gsap.to(txt,{y:y-40, alpha:0, duration:0.8, ease:'power2.out',
      onComplete:()=>{this.container.removeChild(txt);txt.destroy();}});
    gsap.fromTo(txt.scale,{x:0.5,y:0.5},{x:1.2,y:1.2,duration:0.15,ease:'back.out',
      onComplete:()=>gsap.to(txt.scale,{x:1,y:1,duration:0.1})});
  }

  /** Screen shake — uses timeline to guarantee position reset */
  screenShake(target, intensity=4) {
    const ox = target.x, oy = target.y;
    const tl = gsap.timeline({
      onComplete: () => { target.x = ox; target.y = oy; }
    });
    for (let i = 0; i < 6; i++) {
      const ix = (Math.random() - 0.5) * intensity * 2;
      const iy = (Math.random() - 0.5) * intensity * 2;
      tl.to(target, { x: ox + ix, y: oy + iy, duration: 0.03, ease: 'none' });
    }
    tl.to(target, { x: ox, y: oy, duration: 0.05, ease: 'power2.out' });
  }
}
