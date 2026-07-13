/* ============================================================
   ТЁМНАЯ ОХОТА — dark hunting ground + дерево улучшений
   + прокачка в бою (опыт/карты), оружие, боссы.
   Оффлайн, всё в одном файле. Данные в localStorage.
   ============================================================ */
"use strict";

/* ---------- Хранилище ---------- */
const SAVE_KEY = "darkhunt_v1";
const save = { coins: 0, bestNight: 1, owned: {} };
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    Object.assign(save, raw);
    if (!save.owned) save.owned = {};
  } catch (e) {}
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
load();

/* ---------- Дерево улучшений (мета-прокачка) ---------- */
const TREE = [
  { id:"root", branch:"root", name:"Костёр охотника", icon:"🔥", x:50, y:56, max:0,
    desc:"Твой очаг. Отсюда растут все навыки.", req:[], base:0, mul:1, eff:{} },
  // Оружие
  { id:"w1", branch:"weapon", name:"Урон I", icon:"⚔️", x:20, y:150, max:5, base:40, mul:1.6, req:["root"], desc:"Каждый выстрел бьёт сильнее.", eff:{damage:3} },
  { id:"w2", branch:"weapon", name:"Скорострельность", icon:"🔥", x:20, y:250, max:5, base:65, mul:1.6, req:["w1"], desc:"Охотник стреляет чаще.", eff:{fireRate:0.25} },
  { id:"w3", branch:"weapon", name:"Урон II", icon:"🗡️", x:20, y:350, max:5, base:130, mul:1.7, req:["w2"], desc:"Ещё больше урона по зверю.", eff:{damage:6} },
  { id:"w4", branch:"weapon", name:"Двойной выстрел", icon:"✳️", x:20, y:450, max:3, base:280, mul:2.2, req:["w3"], desc:"+1 снаряд за выстрел.", eff:{projectiles:1} },
  { id:"w5", branch:"weapon", name:"Точный глаз", icon:"🎯", x:20, y:550, max:5, base:190, mul:1.7, req:["w3"], desc:"Шанс критического урона (×2).", eff:{crit:0.06} },
  { id:"w6", branch:"weapon", name:"Пробитие", icon:"🏹", x:20, y:650, max:3, base:320, mul:2.2, req:["w4"], desc:"Снаряд прошивает +1 зверя насквозь.", eff:{pierce:1} },
  // Факел
  { id:"t1", branch:"torch", name:"Свет I", icon:"🔦", x:50, y:160, max:5, base:40, mul:1.6, req:["root"], desc:"Факел освещает больше пространства.", eff:{torch:26} },
  { id:"t2", branch:"torch", name:"Радиус добычи", icon:"🧲", x:50, y:260, max:5, base:55, mul:1.6, req:["t1"], desc:"Монеты и опыт притягиваются издалека.", eff:{pickup:24} },
  { id:"t3", branch:"torch", name:"Богатая добыча", icon:"💰", x:50, y:360, max:5, base:95, mul:1.7, req:["t2"], desc:"Больше монет с каждого зверя.", eff:{coinBonus:0.15} },
  { id:"t4", branch:"torch", name:"Морозный след", icon:"❄️", x:50, y:460, max:5, base:120, mul:1.7, req:["t2"], desc:"Звери движутся медленнее.", eff:{slow:0.08} },
  { id:"t5", branch:"torch", name:"Свет II", icon:"🌟", x:50, y:560, max:5, base:170, mul:1.7, req:["t1"], desc:"Ещё шире круг света.", eff:{torch:34} },
  { id:"t6", branch:"torch", name:"Дальний бой", icon:"🎇", x:50, y:660, max:5, base:150, mul:1.7, req:["t3"], desc:"Охотник замечает и бьёт врагов дальше.", eff:{range:26} },
  // Тело
  { id:"b1", branch:"body", name:"Здоровье I", icon:"❤️", x:80, y:150, max:5, base:40, mul:1.6, req:["root"], desc:"+запас здоровья.", eff:{maxHp:25} },
  { id:"b2", branch:"body", name:"Регенерация", icon:"✨", x:80, y:250, max:5, base:85, mul:1.7, req:["b1"], desc:"Здоровье восстанавливается со временем.", eff:{regen:0.8} },
  { id:"b3", branch:"body", name:"Ловкость", icon:"👟", x:80, y:350, max:5, base:70, mul:1.6, req:["b1"], desc:"Охотник двигается быстрее.", eff:{speed:12} },
  { id:"b4", branch:"body", name:"Здоровье II", icon:"💚", x:80, y:450, max:5, base:160, mul:1.7, req:["b2"], desc:"Ещё больше запаса здоровья.", eff:{maxHp:45} },
  { id:"b5", branch:"body", name:"Отбрасывание", icon:"💥", x:80, y:550, max:3, base:170, mul:1.9, req:["b3"], desc:"Выстрелы отбрасывают зверей.", eff:{knockback:45} },
  { id:"b6", branch:"body", name:"Толстая шкура", icon:"🛡️", x:80, y:650, max:5, base:180, mul:1.8, req:["b4"], desc:"Снижает получаемый урон.", eff:{armor:0.06} },
];
const NODE = Object.fromEntries(TREE.map(n => [n.id, n]));
const TREE_H = 730;
function nodeLevel(id){ return save.owned[id] || 0; }
function nodeCost(n){ return Math.floor(n.base * Math.pow(n.mul, nodeLevel(n.id))); }
function nodeUnlocked(n){ return n.req.every(r => r === "root" || nodeLevel(r) > 0); }
function nodeMaxed(n){ return n.max > 0 && nodeLevel(n.id) >= n.max; }
function canBuy(n){ return n.max > 0 && nodeUnlocked(n) && !nodeMaxed(n) && save.coins >= nodeCost(n); }

function computeStats(){
  const s = {
    maxHp:100, regen:0, speed:158,
    damage:8, fireRate:2.0, range:210, projectiles:1, spread:0.16,
    crit:0.05, critMul:2, pierce:0, bulletSpeed:430,
    torch:200, pickup:46, coinBonus:0, slow:0, knockback:0, armor:0,
  };
  for (const n of TREE){
    const lv = nodeLevel(n.id); if (!lv) continue;
    for (const k in n.eff) s[k] += n.eff[k] * lv;
  }
  s.slow = Math.min(s.slow, 0.6); s.armor = Math.min(s.armor, 0.6);
  return s;
}

/* ============================================================
   Движок
   ============================================================ */
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const dark = document.createElement("canvas");
const dctx = dark.getContext("2d");
let W = 0, H = 0, DPR = 1;
function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W*DPR; cv.height = H*DPR; dark.width = W*DPR; dark.height = H*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0); dctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize); resize();

const G = {
  mode:"menu", stats:null, run:null, eff:null,
  night:1, duration:45, time:0,
  player:null, enemies:[], bullets:[], loot:[], gems:[], pickups:[], parts:[], rings:[], dtexts:[],
  kills:0, coinRun:0, spawnT:0, fireT:0, screenShake:0, torchFlicker:0,
  level:1, xp:0, xpNext:5, pendingLevels:0,
  orbit:null, nova:null, boss:null, nextNight:1,
};

const rand=(a,b)=>a+Math.random()*(b-a);
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const fmt=n=>{n=Math.floor(n);return n>=10000?(n/1000).toFixed(n>=100000?0:1)+"k":""+n;};

const BEASTS = {
  shade:   { hp:16, spd:64,  r:15, dmg:8,  coin:2, xp:1, col:"#7b5cff", eye:"#c7b3ff" },
  wolf:    { hp:12, spd:112, r:13, dmg:6,  coin:3, xp:1, col:"#8a94a6", eye:"#ffe08a" },
  stalker: { hp:22, spd:126, r:12, dmg:10, coin:5, xp:2, col:"#e5484d", eye:"#ff9a9a" },
  brute:   { hp:60, spd:46,  r:26, dmg:18, coin:9, xp:4, col:"#3f5642", eye:"#8affab" },
};
function pickBeast(night){
  const pool = [["shade",0.5]];
  if (night>=2) pool.push(["wolf",0.32]);
  if (night>=3) pool.push(["stalker",0.16+night*0.01]);
  if (night>=4) pool.push(["brute",0.1+night*0.012]);
  let tot=pool.reduce((a,p)=>a+p[1],0), r=Math.random()*tot;
  for (const [k,w] of pool){ if ((r-=w)<=0) return k; } return "shade";
}

/* ---------- Эффективные характеристики (дерево × прокачка боя) ---------- */
function newRun(){
  return { hpAdd:0, regenAdd:0, speedMul:1, dmgMul:1, rateMul:1, rangeMul:1,
           projAdd:0, critAdd:0, pierceAdd:0, torchMul:1, pickupMul:1, slowAdd:0 };
}
function applyEff(){
  const s=G.stats, r=G.run;
  G.eff = {
    maxHp: Math.round(s.maxHp + r.hpAdd),
    regen: s.regen + r.regenAdd,
    speed: s.speed * r.speedMul,
    damage: s.damage * r.dmgMul,
    fireRate: s.fireRate * r.rateMul,
    range: s.range * r.rangeMul,
    projectiles: s.projectiles + r.projAdd,
    spread: s.spread,
    crit: Math.min(0.9, s.crit + r.critAdd),
    critMul: s.critMul,
    pierce: s.pierce + r.pierceAdd,
    bulletSpeed: s.bulletSpeed,
    torch: s.torch * r.torchMul,
    pickup: s.pickup * r.pickupMul,
    coinBonus: s.coinBonus,
    slow: Math.min(0.75, s.slow + r.slowAdd),
    knockback: s.knockback,
    armor: s.armor,
  };
  if (G.player) G.player.maxHp = G.eff.maxHp;
}

function startNight(night){
  G.stats = computeStats();
  G.run = newRun();
  G.night = night;
  G.duration = 45 + (night-1)*2;
  G.time = 0;
  G.enemies=[]; G.bullets=[]; G.loot=[]; G.gems=[]; G.pickups=[]; G.parts=[]; G.rings=[]; G.dtexts=[];
  G.kills=0; G.coinRun=0; G.spawnT=0; G.fireT=0; G.screenShake=0;
  G.level=1; G.xp=0; G.xpNext=5; G.pendingLevels=0;
  G.orbit=null; G.nova=null; G.boss=null;
  G.player={ x:0, y:0, hp:1, maxHp:1, hurtT:0, aim:0, face:0 };
  applyEff();
  G.player.hp = G.player.maxHp = G.eff.maxHp;
  G.mode="play";
  showOnly("hud");
  document.getElementById("nightNo").textContent = night;
  document.getElementById("bossWrap").classList.add("hidden");
  const isBoss = night%5===0;
  if (isBoss) spawnBoss();
  showToast(isBoss ? "🌙 Ночь "+night+" · БОСС!" : "🌙 Ночь "+night, isBoss?"#ff8a8a":"#8ec5ff");
  syncHud();
}

function spawnEnemy(){
  const p=G.player, st=G.eff;
  const ang=Math.random()*Math.PI*2;
  const d=st.torch + Math.max(W,H)*0.55;
  const type=pickBeast(G.night), b=BEASTS[type];
  const hpScale=1+(G.night-1)*0.42;
  G.enemies.push({
    x:p.x+Math.cos(ang)*d, y:p.y+Math.sin(ang)*d,
    type, r:b.r, spd:b.spd*(1+(G.night-1)*0.03),
    hp:b.hp*hpScale, maxHp:b.hp*hpScale, dmg:b.dmg, coin:b.coin, xp:b.xp,
    col:b.col, eye:b.eye, hitT:0, kb:0, kbx:0, kby:0, orbCd:0, phase:Math.random()*6.28,
  });
}
function spawnBoss(){
  const p=G.player;
  const ang=Math.random()*Math.PI*2, d=Math.max(W,H)*0.6;
  const hp=380 + G.night*130;
  const e={
    x:p.x+Math.cos(ang)*d, y:p.y+Math.sin(ang)*d, boss:true, name:"Лесной хозяин",
    type:"boss", r:44, spd:40, hp, maxHp:hp, dmg:26, coin:55+G.night*8, xp:26,
    col:"#3a2d4a", eye:"#ff5a5a", hitT:0, kb:0, kbx:0, kby:0, orbCd:0, phase:0,
  };
  G.enemies.push(e); G.boss=e;
  document.getElementById("bossName").textContent = e.name;
  document.getElementById("bossWrap").classList.remove("hidden");
}

function fireWeapon(){
  const p=G.player, st=G.eff;
  let best=null, bd=st.range*st.range;
  for (const e of G.enemies){ const dd=dist2(p.x,p.y,e.x,e.y); if (dd<bd){bd=dd;best=e;} }
  if (!best) return;
  const baseAng=Math.atan2(best.y-p.y, best.x-p.x); p.aim=baseAng;
  const n=st.projectiles;
  for (let i=0;i<n;i++){
    const off=(n===1)?0:(i-(n-1)/2)*st.spread, a=baseAng+off;
    const crit=Math.random()<st.crit;
    G.bullets.push({ x:p.x, y:p.y, vx:Math.cos(a)*st.bulletSpeed, vy:Math.sin(a)*st.bulletSpeed,
      dmg:st.damage*(crit?st.critMul:1), crit, pierce:st.pierce, life:st.range/st.bulletSpeed+0.15, r:5 });
  }
}

function damageEnemy(e, dmg, crit, fromx, fromy, kbForce){
  e.hp -= dmg; e.hitT=0.08;
  pushDmg(e.x, e.y-e.r, Math.round(dmg), crit);
  if (kbForce>0 && !e.boss){ const a=Math.atan2(e.y-fromy, e.x-fromx); e.kb=kbForce; e.kbx=Math.cos(a); e.kby=Math.sin(a); }
}
function pushDmg(x,y,val,crit){
  if (G.dtexts.length>34) G.dtexts.shift();
  G.dtexts.push({ x:x+rand(-6,6), y, val, crit, t:0, life:crit?0.7:0.5, vy:-46 });
}

function hurtPlayer(dmg){
  const p=G.player, st=G.eff;
  if (p.hurtT>0) return;
  p.hp -= dmg*(1-st.armor); p.hurtT=0.55;
  G.screenShake=Math.min(14, G.screenShake+6);
  if (p.hp<=0){ p.hp=0; endNight(false); }
}
function dropLoot(x,y,coin){
  const val=Math.max(1, Math.round(coin*(1+G.eff.coinBonus)));
  G.loot.push({ x, y, val, vx:rand(-40,40), vy:rand(-40,40), got:false, t:0 });
}
function dropGem(x,y,val){ G.gems.push({ x, y, val, vx:rand(-50,50), vy:rand(-50,50), t:0, got:false, magnet:false }); }
function maybeDropPickup(x,y){
  const roll=Math.random();
  if (roll<0.020) G.pickups.push({ x, y, type:"heal", t:0 });
  else if (roll<0.033) G.pickups.push({ x, y, type:"bomb", t:0 });
}
function boom(x,y,col,n,spd){
  for (let i=0;i<n;i++){ const a=Math.random()*6.28, s=rand(spd*0.3,spd);
    G.parts.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.3,.7), t:0, col, r:rand(1.5,3.5) }); }
}

/* ---------- Опыт и уровни ---------- */
function addXp(v){
  G.xp += v;
  while (G.xp>=G.xpNext){ G.xp-=G.xpNext; G.level++; G.xpNext=Math.round(G.xpNext*1.32)+3; G.pendingLevels++; }
  if (G.pendingLevels>0 && G.mode==="play") openLevelUp();
}

/* ---------- Бомба (взрыв на весь экран) ---------- */
function screenBomb(){
  const p=G.player;
  G.rings.push({ x:p.x, y:p.y, r:0, max:Math.max(W,H)*0.7, dmg:9999, hit:new Set(), col:"#ffd15c", life:0.5, t:0, big:true });
  G.screenShake=16;
  for (const e of G.enemies){ if (e.boss){ damageEnemy(e, 120, false, p.x, p.y, 0); } else { damageEnemy(e, 9999, false, p.x, p.y, 200); } }
  boom(p.x,p.y,"#ffd15c",30,260);
}

/* ---------- Обновление ---------- */
function update(dt){
  const p=G.player, st=G.eff;
  const mv=input.vec();
  p.x+=mv.x*st.speed*dt; p.y+=mv.y*st.speed*dt;
  if (mv.x||mv.y) p.face=Math.atan2(mv.y,mv.x);

  if (st.regen>0 && p.hp<p.maxHp) p.hp=Math.min(p.maxHp, p.hp+st.regen*dt);
  if (p.hurtT>0) p.hurtT-=dt;
  G.time+=dt;
  G.torchFlicker=Math.sin(performance.now()*0.006)*4+Math.sin(performance.now()*0.017)*2;
  if (G.screenShake>0) G.screenShake=Math.max(0,G.screenShake-dt*30);

  if (G.time>=G.duration){ endNight(true); return; }

  // спавн
  G.spawnT-=dt;
  if (G.spawnT<=0 && G.enemies.length<90){
    G.spawnT=Math.max(0.18, 0.9-G.night*0.06-G.time*0.008);
    spawnEnemy();
    if (Math.random()<0.3+G.night*0.03) spawnEnemy();
  }

  // стрельба
  G.fireT-=dt;
  if (G.fireT<=0){ fireWeapon(); G.fireT=1/st.fireRate; }

  // орбитальные клинки
  if (G.orbit){
    G.orbit.ang += dt*2.4;
    const dmg=st.damage*(0.45+0.28*G.orbit.level), R=G.orbit.radius;
    for (let i=0;i<G.orbit.blades;i++){
      const a=G.orbit.ang + i*(6.283/G.orbit.blades);
      const bx=p.x+Math.cos(a)*R, by=p.y+Math.sin(a)*R;
      for (const e of G.enemies){
        if (e.hp<=0 || e.orbCd>0) continue;
        const rr=e.r+13;
        if (dist2(bx,by,e.x,e.y)<rr*rr){ damageEnemy(e, dmg, false, bx, by, st.knockback*0.5); e.orbCd=0.28; }
      }
    }
  }
  for (const e of G.enemies) if (e.orbCd>0) e.orbCd-=dt;

  // взрыв света (nova)
  if (G.nova){
    G.nova.t-=dt;
    if (G.nova.t<=0){
      G.nova.t=Math.max(1.0, 2.4-G.nova.level*0.16);
      G.rings.push({ x:p.x, y:p.y, r:0, max:120+G.nova.level*28, dmg:st.damage*(0.7+0.45*G.nova.level),
        hit:new Set(), col:"#8ec5ff", life:0.45, t:0 });
    }
  }
  // кольца-волны
  for (const ring of G.rings){
    ring.t+=dt;
    const prog=ring.t/ring.life; ring.r=ring.max*prog;
    for (const e of G.enemies){
      if (e.hp<=0 || ring.hit.has(e)) continue;
      if (Math.abs(Math.hypot(e.x-ring.x,e.y-ring.y)-ring.r) < e.r+14){
        ring.hit.add(e); damageEnemy(e, ring.dmg, false, ring.x, ring.y, 120);
      }
    }
  }
  G.rings=G.rings.filter(r=>r.t<r.life);

  // пули
  for (const b of G.bullets){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    for (const e of G.enemies){
      if (e.hp<=0) continue;
      const rr=e.r+b.r;
      if (dist2(b.x,b.y,e.x,e.y)<rr*rr){
        damageEnemy(e, b.dmg, b.crit, b.x, b.y, st.knockback);
        boom(b.x,b.y, b.crit?"#ffd15c":"#ffe6b0", b.crit?7:3, 120);
        b.pierce--; if (b.pierce<0){ b.life=0; break; }
      }
    }
  }
  G.bullets=G.bullets.filter(b=>b.life>0);

  // враги
  for (const e of G.enemies){
    if (e.hp<=0) continue;
    const a=Math.atan2(p.y-e.y, p.x-e.x), sp=e.spd*(1-st.slow);
    e.x+=Math.cos(a)*sp*dt; e.y+=Math.sin(a)*sp*dt;
    if (e.kb>0){ e.x+=e.kbx*e.kb*dt*6; e.y+=e.kby*e.kb*dt*6; e.kb=Math.max(0,e.kb-e.kb*dt*8); }
    if (e.hitT>0) e.hitT-=dt;
    const rr=e.r+16;
    if (dist2(p.x,p.y,e.x,e.y)<rr*rr) hurtPlayer(e.dmg);
  }
  // смерти
  const alive=[];
  for (const e of G.enemies){
    if (e.hp<=0){
      G.kills++; dropGem(e.x,e.y,e.xp); boom(e.x,e.y,e.col,e.boss?26:10,e.boss?220:150);
      if (e.boss){ G.boss=null; document.getElementById("bossWrap").classList.add("hidden");
        for (let i=0;i<6;i++) dropLoot(e.x+rand(-30,30), e.y+rand(-30,30), Math.ceil(e.coin/6));
        showToast("👑 Босс повержен! +"+fmt(Math.round(e.coin*(1+st.coinBonus))), "#ffd15c");
      } else { dropLoot(e.x,e.y,e.coin); maybeDropPickup(e.x,e.y); }
    } else alive.push(e);
  }
  G.enemies=alive;

  // монеты
  for (const l of G.loot){
    l.t+=dt; const dd=dist2(p.x,p.y,l.x,l.y);
    if (dd<st.pickup*st.pickup || l.magnet){ l.magnet=true; const a=Math.atan2(p.y-l.y,p.x-l.x); const pull=240+l.t*260;
      l.x+=Math.cos(a)*pull*dt; l.y+=Math.sin(a)*pull*dt; if (dd<400){ l.got=true; G.coinRun+=l.val; } }
    else { l.x+=l.vx*dt; l.y+=l.vy*dt; l.vx*=0.9; l.vy*=0.9; }
  }
  G.loot=G.loot.filter(l=>!l.got);

  // опыт-кристаллы (радиус подбора крупнее)
  const gpick=st.pickup*1.5;
  for (const g of G.gems){
    g.t+=dt; const dd=dist2(p.x,p.y,g.x,g.y);
    if (dd<gpick*gpick || g.magnet){ g.magnet=true; const a=Math.atan2(p.y-g.y,p.x-g.x); const pull=260+g.t*300;
      g.x+=Math.cos(a)*pull*dt; g.y+=Math.sin(a)*pull*dt; if (dd<400){ g.got=true; addXp(g.val); } }
    else { g.x+=g.vx*dt; g.y+=g.vy*dt; g.vx*=0.9; g.vy*=0.9; }
  }
  G.gems=G.gems.filter(g=>!g.got);

  // предметы (лечение/бомба)
  for (const pk of G.pickups){
    pk.t+=dt;
    const rr=st.pickup+14;
    if (dist2(p.x,p.y,pk.x,pk.y)<rr*rr){
      pk.got=true;
      if (pk.type==="heal"){ p.hp=Math.min(p.maxHp, p.hp+p.maxHp*0.3); showToast("❤️ +"+Math.round(p.maxHp*0.3)+" HP","#ff9a9a"); boom(pk.x,pk.y,"#ff6b6b",12,140); }
      else { showToast("💣 Взрыв!","#ffd15c"); screenBomb(); }
    }
  }
  G.pickups=G.pickups.filter(pk=>!pk.got);

  // частицы и цифры
  for (const pt of G.parts){ pt.t+=dt; pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vx*=0.92; pt.vy*=0.92; }
  G.parts=G.parts.filter(pt=>pt.t<pt.life);
  for (const d of G.dtexts){ d.t+=dt; d.y+=d.vy*dt; d.vy*=0.9; }
  G.dtexts=G.dtexts.filter(d=>d.t<d.life);

  syncHud();
}

function syncHud(){
  const p=G.player;
  document.getElementById("hpFill").style.width=Math.max(0,p.hp/p.maxHp*100)+"%";
  document.getElementById("hpText").textContent=Math.ceil(p.hp);
  document.getElementById("coinRun").textContent=fmt(G.coinRun);
  document.getElementById("timeLeft").textContent=Math.max(0,Math.ceil(G.duration-G.time));
  document.getElementById("waveTimerFill").style.width=(G.time/G.duration*100)+"%";
  document.getElementById("xpFill").style.width=(G.xp/G.xpNext*100)+"%";
  document.getElementById("lvlNo").textContent=G.level;
  if (G.boss) document.getElementById("bossFill").style.width=Math.max(0,G.boss.hp/G.boss.maxHp*100)+"%";
}

/* ---------- Рендер ---------- */
function render(){
  const p=G.player, st=G.eff;
  let camx=p.x-W/2, camy=p.y-H/2;
  if (G.screenShake>0){ camx+=rand(-G.screenShake,G.screenShake); camy+=rand(-G.screenShake,G.screenShake); }
  const torchR=st.torch+G.torchFlicker;
  const sx=p.x-camx, sy=p.y-camy;

  ctx.fillStyle="#05060a"; ctx.fillRect(0,0,W,H);
  ctx.save(); ctx.translate(-camx,-camy);
  drawGround(camx,camy);

  // монеты
  for (const l of G.loot){ ctx.beginPath(); ctx.arc(l.x,l.y,6,0,6.28); ctx.fillStyle="#ffd15c"; ctx.shadowColor="#ffd15c"; ctx.shadowBlur=10; ctx.fill(); }
  // кристаллы опыта
  for (const g of G.gems){ ctx.save(); ctx.translate(g.x,g.y); ctx.rotate(Math.PI/4); ctx.fillStyle="#8affab"; ctx.shadowColor="#30c46b"; ctx.shadowBlur=9; ctx.fillRect(-4,-4,8,8); ctx.restore(); }
  ctx.shadowBlur=0;
  // предметы
  for (const pk of G.pickups){ const bob=Math.sin(pk.t*4)*3; ctx.font="22px serif"; ctx.textAlign="center"; ctx.shadowColor=pk.type==="heal"?"#ff6b6b":"#ffd15c"; ctx.shadowBlur=12; ctx.fillText(pk.type==="heal"?"❤️":"💣", pk.x, pk.y+bob+7); ctx.shadowBlur=0; }

  // кольца-волны
  for (const ring of G.rings){ ctx.globalAlpha=Math.max(0,1-ring.t/ring.life); ctx.strokeStyle=ring.col; ctx.lineWidth=ring.big?10:6; ctx.shadowColor=ring.col; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.arc(ring.x,ring.y,ring.r,0,6.28); ctx.stroke(); }
  ctx.globalAlpha=1; ctx.shadowBlur=0;

  for (const e of G.enemies) drawBeast(e);

  // пули
  for (const b of G.bullets){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28); ctx.fillStyle=b.crit?"#ffd15c":"#fff0c0"; ctx.shadowColor="#ffcf6b"; ctx.shadowBlur=8; ctx.fill(); }
  ctx.shadowBlur=0;

  // орбитальные клинки
  if (G.orbit){ const R=G.orbit.radius;
    for (let i=0;i<G.orbit.blades;i++){ const a=G.orbit.ang+i*(6.283/G.orbit.blades); const bx=p.x+Math.cos(a)*R, by=p.y+Math.sin(a)*R;
      ctx.save(); ctx.translate(bx,by); ctx.rotate(a); ctx.fillStyle="#bfe6ff"; ctx.shadowColor="#4f8cff"; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(0,-5); ctx.lineTo(12,0); ctx.lineTo(0,5); ctx.closePath(); ctx.fill(); ctx.restore(); } }
  ctx.shadowBlur=0;

  // частицы
  for (const pt of G.parts){ ctx.globalAlpha=1-pt.t/pt.life; ctx.fillStyle=pt.col; ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r,0,6.28); ctx.fill(); }
  ctx.globalAlpha=1;

  drawHunter(p);

  // цифры урона (в мире, освещены факелом)
  ctx.textAlign="center";
  for (const d of G.dtexts){ ctx.globalAlpha=Math.max(0,1-d.t/d.life);
    ctx.font=(d.crit?"bold 20px":"bold 14px")+" -apple-system,Arial";
    ctx.fillStyle=d.crit?"#ffd15c":"#ffffff"; ctx.strokeStyle="rgba(0,0,0,.6)"; ctx.lineWidth=3;
    ctx.strokeText(d.val,d.x,d.y); ctx.fillText(d.val,d.x,d.y); }
  ctx.globalAlpha=1;
  ctx.restore();

  // тьма + факел
  dctx.setTransform(DPR,0,0,DPR,0,0); dctx.clearRect(0,0,W,H);
  dctx.globalCompositeOperation="source-over"; dctx.fillStyle="rgba(3,4,9,0.94)"; dctx.fillRect(0,0,W,H);
  dctx.globalCompositeOperation="destination-out";
  const g=dctx.createRadialGradient(sx,sy,torchR*0.25,sx,sy,torchR);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.6,"rgba(255,255,255,0.92)"); g.addColorStop(1,"rgba(255,255,255,0)");
  dctx.fillStyle=g; dctx.beginPath(); dctx.arc(sx,sy,torchR,0,6.28); dctx.fill();
  dctx.globalCompositeOperation="source-over"; ctx.drawImage(dark,0,0,W,H);

  ctx.globalCompositeOperation="lighter";
  const wg=ctx.createRadialGradient(sx,sy,0,sx,sy,torchR*0.9);
  wg.addColorStop(0,"rgba(255,150,60,0.10)"); wg.addColorStop(1,"rgba(255,150,60,0)");
  ctx.fillStyle=wg; ctx.fillRect(0,0,W,H); ctx.globalCompositeOperation="source-over";

  // глаза в темноте
  for (const e of G.enemies){
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if (d>torchR*0.72){
      const ex=e.x-camx, ey=e.y-camy, a=Math.atan2(p.y-e.y,p.x-e.x);
      const gap=e.r*0.32, px=Math.cos(a+Math.PI/2), py=Math.sin(a+Math.PI/2);
      const pulse=0.6+0.4*Math.sin(performance.now()*0.008+e.phase);
      ctx.fillStyle=e.eye; ctx.shadowColor=e.eye; ctx.shadowBlur=(e.boss?16:10)*pulse;
      for (const s of [-1,1]){ ctx.beginPath(); ctx.arc(ex+px*gap*s,ey+py*gap*s,e.boss?4:2.3,0,6.28); ctx.fill(); }
    }
  }
  ctx.shadowBlur=0;

  const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3,W/2,H/2,Math.max(W,H)*0.75);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,0.55)");
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
}

function drawGround(camx,camy){
  const step=54, x0=Math.floor(camx/step)*step, y0=Math.floor(camy/step)*step;
  ctx.fillStyle="#0e1520";
  for (let x=x0;x<camx+W+step;x+=step) for (let y=y0;y<camy+H+step;y+=step){
    const h=((x*73856093)^(y*19349663))>>>0; ctx.fillRect(x+(h%37)-18, y+((h>>5)%37)-18, 3,3);
  }
}
function drawBeast(e){
  const wob=Math.sin(performance.now()*0.012+e.phase)*2;
  ctx.save(); ctx.translate(e.x,e.y);
  ctx.beginPath(); ctx.ellipse(0,wob*0.4,e.r,e.r*0.82,0,0,6.28);
  ctx.fillStyle=e.hitT>0?"#ffffff":e.col; ctx.shadowColor=e.col; ctx.shadowBlur=e.hitT>0?18:6; ctx.fill(); ctx.shadowBlur=0;
  if (e.boss){ ctx.fillStyle="#1a1420"; // рога
    ctx.beginPath(); ctx.moveTo(-e.r*0.5,-e.r*0.6); ctx.lineTo(-e.r*0.8,-e.r*1.2); ctx.lineTo(-e.r*0.3,-e.r*0.75); ctx.fill();
    ctx.beginPath(); ctx.moveTo(e.r*0.5,-e.r*0.6); ctx.lineTo(e.r*0.8,-e.r*1.2); ctx.lineTo(e.r*0.3,-e.r*0.75); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(0,-e.r*0.25,e.r*0.7,e.r*0.4,0,0,6.28); ctx.fillStyle="rgba(0,0,0,0.28)"; ctx.fill();
  ctx.fillStyle=e.eye;
  ctx.beginPath(); ctx.arc(-e.r*0.35,-e.r*0.2,e.r*0.16,0,6.28); ctx.fill();
  ctx.beginPath(); ctx.arc( e.r*0.35,-e.r*0.2,e.r*0.16,0,6.28); ctx.fill();
  if (e.hp<e.maxHp && !e.boss){ const w=e.r*2; ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(-w/2,-e.r-9,w,4);
    ctx.fillStyle="#e5484d"; ctx.fillRect(-w/2,-e.r-9,w*(e.hp/e.maxHp),4); }
  ctx.restore();
}
function drawHunter(p){
  const t=performance.now()*0.001;
  ctx.save(); ctx.translate(p.x,p.y);
  ctx.beginPath(); ctx.ellipse(0,10,16,7,0,0,6.28); ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fill();
  ctx.beginPath(); ctx.arc(0,0,13,0,6.28);
  const flash=p.hurtT>0 && Math.floor(t*20)%2===0;
  ctx.fillStyle=flash?"#ff8a8a":"#d9e2f2"; ctx.shadowColor="#cfe0ff"; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0;
  ctx.beginPath(); ctx.arc(0,-2,10,Math.PI*0.05,Math.PI*0.95); ctx.fillStyle="#2c3648"; ctx.fill();
  ctx.rotate(p.aim||0); ctx.fillStyle="#4a5568"; ctx.fillRect(4,-2.5,20,5); ctx.fillStyle="#8ea2c4"; ctx.fillRect(20,-2,7,4);
  ctx.restore();
}

/* ---------- Карты уровня ---------- */
function buildPool(){
  const P=[];
  const add=(id,name,desc,icon,cls,weight,apply)=>P.push({id,name,desc,icon,cls,weight,apply});
  add("pwr","Мощь","+20% урона","⚔️","common",10,()=>G.run.dmgMul*=1.2);
  add("rate","Ярость","+18% скорострельности","🔥","common",10,()=>G.run.rateMul*=1.18);
  add("swift","Прыть","+12% скорости","👟","common",9,()=>G.run.speedMul*=1.12);
  add("crit","Меткость","+8% шанс крита","🎯","common",8,()=>G.run.critAdd+=0.08);
  add("range","Зоркость","+18% дальность и свет","🎇","common",8,()=>{G.run.rangeMul*=1.18;G.run.torchMul*=1.12;});
  add("greed","Жадность","+35% радиус добычи","🧲","common",6,()=>G.run.pickupMul*=1.35);
  add("frost","Стужа","+12% замедление зверей","❄️","common",7,()=>G.run.slowAdd+=0.12);
  add("vigor","Стойкость","+30 макс. HP и лечение","❤️","common",9,()=>{G.run.hpAdd+=30;applyEff();G.player.hp=Math.min(G.player.maxHp,G.player.hp+30);});
  add("regen","Второе дыхание","+1.2 HP/сек","✨","common",6,()=>G.run.regenAdd+=1.2);
  add("proj","Залп","+1 снаряд за выстрел","✳️","rare",4,()=>G.run.projAdd+=1);
  add("pierce","Пробой","+1 пробитие снаряда","🏹","rare",4,()=>G.run.pierceAdd+=1);
  // оружие
  if (!G.orbit) add("orbit","Клинки-спутники","Два клинка кружат и рубят зверей","🌀","weapon",6,()=>{G.orbit={blades:2,level:1,radius:62,ang:0};});
  else if (G.orbit.blades<8) add("orbit","Клинки-спутники +","+1 клинок и больше урона","🌀","weapon",5,()=>{G.orbit.blades++;G.orbit.level++;G.orbit.radius+=4;});
  if (!G.nova) add("nova","Взрыв света","Периодическая волна урона по площади","💫","weapon",6,()=>{G.nova={level:1,t:1.2};});
  else if (G.nova.level<8) add("nova","Взрыв света +","Волна чаще, шире и сильнее","💫","weapon",5,()=>{G.nova.level++;});
  return P;
}
function pickCards(n){
  const pool=buildPool(); const chosen=[];
  while (chosen.length<n && pool.length){
    let tot=pool.reduce((a,c)=>a+c.weight,0), r=Math.random()*tot, idx=0;
    for (let i=0;i<pool.length;i++){ if ((r-=pool[i].weight)<=0){ idx=i; break; } }
    chosen.push(pool.splice(idx,1)[0]);
  }
  return chosen;
}
function openLevelUp(){
  G.mode="levelup";
  const cards=pickCards(3);
  const box=document.getElementById("cards"); box.innerHTML="";
  const tagText={common:"улучшение",rare:"редкое",weapon:"оружие"};
  for (const c of cards){
    const el=document.createElement("button");
    el.className="card "+c.cls;
    el.innerHTML=`<span class="c-ico">${c.icon}</span>
      <span class="c-body"><span class="c-name">${c.name}</span><span class="c-desc">${c.desc}</span></span>
      <span class="c-tag">${tagText[c.cls]}</span>`;
    el.onclick=()=>{ c.apply(); applyEff(); G.pendingLevels--;
      if (G.pendingLevels>0) openLevelUp(); else { G.mode="play"; lastT=performance.now(); showOnly("hud"); } };
    box.appendChild(el);
  }
  showOnly("levelup");
}

/* ---------- Конец ночи ---------- */
function endNight(survived){
  if (G.mode!=="play") return;
  G.mode="menu";
  save.coins+=G.coinRun;
  if (survived && G.night+1>save.bestNight) save.bestNight=G.night+1;
  persist();
  document.getElementById("resIco").textContent=survived?"🌅":"💀";
  document.getElementById("resTitle").textContent=survived?"Ночь пережита!":"Тебя настигли…";
  document.getElementById("resSub").textContent=survived
    ? "Рассвет прогнал зверей. Впереди — ночь потяжелее."
    : "Звери одолели охотника. Но добыча осталась при тебе.";
  document.getElementById("resNight").textContent=G.night;
  document.getElementById("resKills").textContent=G.kills;
  document.getElementById("resCoins").textContent="+"+fmt(G.coinRun);
  G.nextNight=survived?G.night+1:G.night;
  document.getElementById("bossWrap").classList.add("hidden");
  showOnly("result"); refreshMenuStats();
}

/* ---------- Цикл ---------- */
let lastT=performance.now();
function loop(now){
  const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
  if (G.mode==="play"){ update(dt); render(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- Управление ---------- */
const input=(()=>{
  let active=false,id=null,ox=0,oy=0,cx=0,cy=0; const R=52;
  const base=document.getElementById("stickBase"), knob=document.getElementById("stickKnob"), zone=document.getElementById("stickZone");
  const keys={};
  function set(x,y){ cx=x;cy=y; let dx=cx-ox,dy=cy-oy; const d=Math.hypot(dx,dy);
    if (d>R){dx=dx/d*R;dy=dy/d*R;} knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
  zone.addEventListener("pointerdown",e=>{ if (active) return; active=true; id=e.pointerId; ox=e.clientX; oy=e.clientY;
    base.style.left=ox+"px"; base.style.top=oy+"px"; base.classList.add("on"); set(ox,oy); zone.setPointerCapture(id); });
  zone.addEventListener("pointermove",e=>{ if (active&&e.pointerId===id) set(e.clientX,e.clientY); });
  const up=e=>{ if (active&&e.pointerId===id){ active=false; base.classList.remove("on"); knob.style.transform="translate(-50%,-50%)"; } };
  zone.addEventListener("pointerup",up); zone.addEventListener("pointercancel",up);
  window.addEventListener("keydown",e=>keys[e.key.toLowerCase()]=true);
  window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
  return { vec(){ let x=0,y=0;
    if (active){ let dx=cx-ox,dy=cy-oy; const d=Math.hypot(dx,dy); if (d>6){ const m=Math.min(1,d/R); x=dx/d*m; y=dy/d*m; } }
    let kx=(keys["d"]||keys["arrowright"]?1:0)-(keys["a"]||keys["arrowleft"]?1:0);
    let ky=(keys["s"]||keys["arrowdown"]?1:0)-(keys["w"]||keys["arrowup"]?1:0);
    if (kx||ky){ const m=Math.hypot(kx,ky); x=kx/m; y=ky/m; } return {x,y}; } };
})();

/* ---------- Экраны ---------- */
const screens=["menu","tree","result","pause","how","hud","levelup"];
function showOnly(idOrList){
  const list=Array.isArray(idOrList)?idOrList:[idOrList];
  for (const s of screens) document.getElementById(s).classList.toggle("hidden",!list.includes(s));
}
function refreshMenuStats(){
  document.getElementById("bestNight").textContent=save.bestNight;
  document.getElementById("coinBank").textContent=fmt(save.coins);
}
let toastH=null;
function showToast(txt,color){
  const t=document.getElementById("toast"); t.textContent=txt; t.style.color=color||"#fff";
  t.classList.add("show"); clearTimeout(toastH); toastH=setTimeout(()=>t.classList.remove("show"),1500);
}

document.getElementById("playBtn").onclick=()=>startNight(save.bestNight);
document.getElementById("resAgain").onclick=()=>startNight(G.nextNight||1);
document.getElementById("resMenu").onclick=()=>{ showOnly("menu"); refreshMenuStats(); };
document.getElementById("resTree").onclick=()=>openTree();
document.getElementById("treeBtn").onclick=()=>openTree();
document.getElementById("treeBack").onclick=()=>{ showOnly("menu"); refreshMenuStats(); };
document.getElementById("howBtn").onclick=()=>showOnly("how");
document.getElementById("howClose").onclick=()=>showOnly("menu");
document.getElementById("pauseBtn").onclick=()=>{ if (G.mode==="play"){ G.mode="pause"; showOnly(["hud","pause"]); } };
document.getElementById("resumeBtn").onclick=()=>{ if (G.mode==="pause"){ G.mode="play"; lastT=performance.now(); showOnly("hud"); } };
document.getElementById("quitBtn").onclick=()=>{ G.mode="menu"; showOnly("menu"); refreshMenuStats(); };

/* ---------- Дерево (DOM) ---------- */
let selNode=null;
function buildTree(){
  const nodesEl=document.getElementById("treeNodes"), svg=document.getElementById("treeLines");
  nodesEl.style.height=TREE_H+"px"; svg.setAttribute("height",TREE_H); svg.style.height=TREE_H+"px";
  nodesEl.innerHTML=""; svg.innerHTML="";
  const wpx=()=>nodesEl.clientWidth||Math.min(W,520);
  for (const n of TREE) for (const r of n.req){ const a=NODE[r]; if (!a) continue;
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",a.x/100*wpx()); line.setAttribute("y1",a.y);
    line.setAttribute("x2",n.x/100*wpx()); line.setAttribute("y2",n.y);
    line.setAttribute("data-to",n.id); line.setAttribute("stroke-width","3"); svg.appendChild(line); }
  for (const n of TREE){
    const el=document.createElement("div"); el.className="node b-"+n.branch; el.dataset.id=n.id;
    el.style.left=n.x+"%"; el.style.top=n.y+"px"; if (n.branch==="root") el.classList.add("root");
    el.innerHTML=`<span>${n.icon}</span>`+(n.max>0?`<span class="lvltag"></span>`:"");
    el.onclick=()=>selectNode(n.id); nodesEl.appendChild(el); n._el=el;
  }
  refreshTree();
}
function selectNode(id){
  selNode=id; refreshTree(); const n=NODE[id], info=document.getElementById("nodeInfo");
  if (n.branch==="root"){ info.classList.add("hidden"); return; }
  info.classList.remove("hidden");
  document.getElementById("niIcon").textContent=n.icon;
  document.getElementById("niName").textContent=n.name;
  document.getElementById("niDesc").textContent=n.desc;
  document.getElementById("niLvl").textContent=nodeLevel(n.id);
  document.getElementById("niMax").textContent="/"+n.max;
  const buy=document.getElementById("niBuy");
  if (nodeMaxed(n)){ buy.textContent="Максимум"; buy.classList.add("disabled"); buy.disabled=true; }
  else if (!nodeUnlocked(n)){ buy.textContent="🔒 Сначала открой предыдущий"; buy.classList.add("disabled"); buy.disabled=true; }
  else { const c=nodeCost(n); buy.textContent=`Открыть · 🪙 ${fmt(c)}`; const ok=save.coins>=c; buy.disabled=!ok; buy.classList.toggle("disabled",!ok); }
}
document.getElementById("niBuy").onclick=()=>{ const n=NODE[selNode]; if (!n||!canBuy(n)) return;
  save.coins-=nodeCost(n); save.owned[n.id]=nodeLevel(n.id)+1; persist(); flash(n._el); selectNode(n.id); refreshTree(); };
function refreshTree(){
  document.getElementById("coinTree").textContent=fmt(save.coins);
  for (const n of TREE){ const el=n._el; if (!el) continue;
    el.classList.remove("owned","locked","can","max","sel");
    if (n.branch==="root") el.classList.add("owned");
    else { const lv=nodeLevel(n.id);
      if (lv>0) el.classList.add("owned"); if (nodeMaxed(n)) el.classList.add("max");
      if (!nodeUnlocked(n)) el.classList.add("locked"); else if (canBuy(n)) el.classList.add("can");
      const tag=el.querySelector(".lvltag"); if (tag) tag.textContent=nodeMaxed(n)?"MAX":lv+"/"+n.max; }
    if (n.id===selNode) el.classList.add("sel");
  }
  const svg=document.getElementById("treeLines");
  for (const line of svg.querySelectorAll("line")){ const to=NODE[line.getAttribute("data-to")];
    line.setAttribute("stroke", nodeLevel(to.id)>0?"#f5a524":"#2a3140"); }
}
function flash(el){ el.animate([{transform:"translate(-50%,-50%) scale(1.35)"},{transform:"translate(-50%,-50%) scale(1)"}],{duration:280,easing:"ease-out"}); }
function openTree(){ showOnly("tree"); buildTree(); document.getElementById("treeScroll").scrollTop=0; }
window.addEventListener("resize",()=>{ if (!document.getElementById("tree").classList.contains("hidden")) buildTree(); });

/* ---------- Старт ---------- */
refreshMenuStats(); showOnly("menu");
if ("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
