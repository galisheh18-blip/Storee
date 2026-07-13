/* ============================================================
   ТЁМНАЯ ОХОТА — dark hunting ground + дерево улучшений
   Оффлайн, всё в одном файле. Данные в localStorage.
   ============================================================ */
"use strict";

/* ---------- Хранилище ---------- */
const SAVE_KEY = "darkhunt_v1";
const save = {
  coins: 0,
  bestNight: 1,
  owned: {},        // { nodeId: level }
};
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    Object.assign(save, raw);
    if (!save.owned) save.owned = {};
  } catch (e) {}
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
load();

/* ---------- Дерево улучшений ---------- */
// x — проценты ширины, y — пиксели по вертикали
const TREE = [
  { id:"root", branch:"root", name:"Костёр охотника", icon:"🔥", x:50, y:56, max:0,
    desc:"Твой очаг. Отсюда растут все навыки.", req:[], base:0, mul:1, eff:{} },

  // ── Оружие (красная ветвь) ──
  { id:"w1", branch:"weapon", name:"Урон I", icon:"⚔️", x:20, y:150, max:5, base:40, mul:1.6,
    req:["root"], desc:"Каждый выстрел бьёт сильнее.", eff:{damage:3} },
  { id:"w2", branch:"weapon", name:"Скорострельность", icon:"🔥", x:20, y:250, max:5, base:65, mul:1.6,
    req:["w1"], desc:"Охотник стреляет чаще.", eff:{fireRate:0.25} },
  { id:"w3", branch:"weapon", name:"Урон II", icon:"🗡️", x:20, y:350, max:5, base:130, mul:1.7,
    req:["w2"], desc:"Ещё больше урона по зверю.", eff:{damage:6} },
  { id:"w4", branch:"weapon", name:"Двойной выстрел", icon:"✳️", x:20, y:450, max:3, base:280, mul:2.2,
    req:["w3"], desc:"+1 снаряд за выстрел.", eff:{projectiles:1} },
  { id:"w5", branch:"weapon", name:"Точный глаз", icon:"🎯", x:20, y:550, max:5, base:190, mul:1.7,
    req:["w3"], desc:"Шанс критического урона (×2).", eff:{crit:0.06} },
  { id:"w6", branch:"weapon", name:"Пробитие", icon:"🏹", x:20, y:650, max:3, base:320, mul:2.2,
    req:["w4"], desc:"Снаряд прошивает +1 зверя насквозь.", eff:{pierce:1} },

  // ── Факел (янтарная ветвь) ──
  { id:"t1", branch:"torch", name:"Свет I", icon:"🔦", x:50, y:160, max:5, base:40, mul:1.6,
    req:["root"], desc:"Факел освещает больше пространства.", eff:{torch:26} },
  { id:"t2", branch:"torch", name:"Радиус добычи", icon:"🧲", x:50, y:260, max:5, base:55, mul:1.6,
    req:["t1"], desc:"Монеты притягиваются издалека.", eff:{pickup:24} },
  { id:"t3", branch:"torch", name:"Богатая добыча", icon:"💰", x:50, y:360, max:5, base:95, mul:1.7,
    req:["t2"], desc:"Больше монет с каждого зверя.", eff:{coinBonus:0.15} },
  { id:"t4", branch:"torch", name:"Морозный след", icon:"❄️", x:50, y:460, max:5, base:120, mul:1.7,
    req:["t2"], desc:"Звери движутся медленнее.", eff:{slow:0.08} },
  { id:"t5", branch:"torch", name:"Свет II", icon:"🌟", x:50, y:560, max:5, base:170, mul:1.7,
    req:["t1"], desc:"Ещё шире круг света.", eff:{torch:34} },
  { id:"t6", branch:"torch", name:"Дальний бой", icon:"🎇", x:50, y:660, max:5, base:150, mul:1.7,
    req:["t3"], desc:"Охотник замечает и бьёт врагов дальше.", eff:{range:26} },

  // ── Тело (зелёная ветвь) ──
  { id:"b1", branch:"body", name:"Здоровье I", icon:"❤️", x:80, y:150, max:5, base:40, mul:1.6,
    req:["root"], desc:"+запас здоровья.", eff:{maxHp:25} },
  { id:"b2", branch:"body", name:"Регенерация", icon:"✨", x:80, y:250, max:5, base:85, mul:1.7,
    req:["b1"], desc:"Здоровье восстанавливается со временем.", eff:{regen:0.8} },
  { id:"b3", branch:"body", name:"Ловкость", icon:"👟", x:80, y:350, max:5, base:70, mul:1.6,
    req:["b1"], desc:"Охотник двигается быстрее.", eff:{speed:12} },
  { id:"b4", branch:"body", name:"Здоровье II", icon:"💚", x:80, y:450, max:5, base:160, mul:1.7,
    req:["b2"], desc:"Ещё больше запаса здоровья.", eff:{maxHp:45} },
  { id:"b5", branch:"body", name:"Отбрасывание", icon:"💥", x:80, y:550, max:3, base:170, mul:1.9,
    req:["b3"], desc:"Выстрелы отбрасывают зверей.", eff:{knockback:45} },
  { id:"b6", branch:"body", name:"Толстая шкура", icon:"🛡️", x:80, y:650, max:5, base:180, mul:1.8,
    req:["b4"], desc:"Снижает получаемый урон.", eff:{armor:0.06} },
];
const NODE = Object.fromEntries(TREE.map(n => [n.id, n]));
const TREE_H = 730;

function nodeLevel(id){ return save.owned[id] || 0; }
function nodeCost(n){ return Math.floor(n.base * Math.pow(n.mul, nodeLevel(n.id))); }
function nodeUnlocked(n){ return n.req.every(r => r === "root" || nodeLevel(r) > 0); }
function nodeMaxed(n){ return n.max > 0 && nodeLevel(n.id) >= n.max; }
function canBuy(n){ return n.max > 0 && nodeUnlocked(n) && !nodeMaxed(n) && save.coins >= nodeCost(n); }

/* Базовые характеристики + сумма из дерева */
function computeStats(){
  const s = {
    maxHp:100, regen:0, speed:158,
    damage:8, fireRate:2.0, range:210, projectiles:1, spread:0.16,
    crit:0.05, critMul:2, pierce:0, bulletSpeed:430,
    torch:200, pickup:46, coinBonus:0, slow:0, knockback:0, armor:0,
  };
  for (const n of TREE){
    const lv = nodeLevel(n.id);
    if (!lv) continue;
    for (const k in n.eff) s[k] += n.eff[k] * lv;
  }
  s.slow = Math.min(s.slow, 0.6);
  s.armor = Math.min(s.armor, 0.6);
  return s;
}

/* ============================================================
   Игровой движок
   ============================================================ */
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const dark = document.createElement("canvas");
const dctx = dark.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  dark.width = W * DPR; dark.height = H * DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  dctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize);
resize();

/* Состояние забега */
const G = {
  mode: "menu",     // menu | play | pause
  stats: null,
  night: 1,
  duration: 45,
  time: 0,
  player: null,
  enemies: [],
  bullets: [],
  loot: [],
  parts: [],
  kills: 0,
  coinRun: 0,
  spawnT: 0,
  fireT: 0,
  screenShake: 0,
  torchFlicker: 0,
};

function rand(a,b){ return a + Math.random()*(b-a); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function fmt(n){ n=Math.floor(n); return n>=10000 ? (n/1000).toFixed(n>=100000?0:1)+"k" : ""+n; }

/* Типы зверей */
const BEASTS = {
  shade:   { hp:16, spd:64,  r:15, dmg:8,  coin:2, col:"#7b5cff", eye:"#c7b3ff", w:0.5 },
  wolf:    { hp:12, spd:112, r:13, dmg:6,  coin:3, col:"#8a94a6", eye:"#ffe08a", w:0.28 },
  stalker: { hp:22, spd:126, r:12, dmg:10, coin:5, col:"#e5484d", eye:"#ff9a9a", w:0.14 },
  brute:   { hp:60, spd:46,  r:26, dmg:18, coin:9, col:"#3f5642", eye:"#8affab", w:0.08 },
};
function pickBeast(night){
  // с ростом ночи появляются более опасные звери
  const pool = [["shade", 0.5]];
  if (night >= 2) pool.push(["wolf", 0.3]);
  if (night >= 3) pool.push(["stalker", 0.16 + night*0.01]);
  if (night >= 4) pool.push(["brute", 0.1 + night*0.012]);
  let tot = pool.reduce((a,p)=>a+p[1],0), r = Math.random()*tot;
  for (const [k,w] of pool){ if ((r-=w) <= 0) return k; }
  return "shade";
}

function startNight(night){
  const st = computeStats();
  G.stats = st;
  G.night = night;
  G.duration = 45 + (night-1)*2;
  G.time = 0;
  G.enemies = []; G.bullets = []; G.loot = []; G.parts = [];
  G.kills = 0; G.coinRun = 0; G.spawnT = 0; G.fireT = 0; G.screenShake = 0;
  G.player = { x:0, y:0, hp:st.maxHp, maxHp:st.maxHp, hurtT:0, aim:0 };
  G.mode = "play";
  showOnly("hud");
  document.getElementById("nightNo").textContent = night;
  syncHud();
}

function spawnEnemy(){
  const p = G.player, st = G.stats;
  const ang = Math.random()*Math.PI*2;
  const d = st.torch + Math.max(W,H)*0.55;
  const type = pickBeast(G.night);
  const b = BEASTS[type];
  const hpScale = 1 + (G.night-1)*0.42;
  G.enemies.push({
    x: p.x + Math.cos(ang)*d,
    y: p.y + Math.sin(ang)*d,
    type, r:b.r, spd:b.spd*(1+ (G.night-1)*0.03),
    hp:b.hp*hpScale, maxHp:b.hp*hpScale, dmg:b.dmg, coin:b.coin,
    col:b.col, eye:b.eye, hitT:0, kb:0, kbx:0, kby:0, phase:Math.random()*6.28,
  });
}

function fireWeapon(){
  const p = G.player, st = G.stats;
  // ближайший враг в радиусе
  let best=null, bd=st.range*st.range;
  for (const e of G.enemies){
    const dd = dist2(p.x,p.y,e.x,e.y);
    if (dd < bd){ bd=dd; best=e; }
  }
  if (!best) return;
  const baseAng = Math.atan2(best.y-p.y, best.x-p.x);
  p.aim = baseAng;
  const n = st.projectiles;
  for (let i=0;i<n;i++){
    const off = (n===1) ? 0 : (i-(n-1)/2)*st.spread;
    const a = baseAng + off;
    const crit = Math.random() < st.crit;
    G.bullets.push({
      x:p.x, y:p.y,
      vx:Math.cos(a)*st.bulletSpeed, vy:Math.sin(a)*st.bulletSpeed,
      dmg: st.damage*(crit?st.critMul:1), crit,
      pierce: st.pierce, life:st.range/st.bulletSpeed + 0.15, r:5,
    });
  }
}

function hurtPlayer(dmg){
  const p = G.player, st = G.stats;
  if (p.hurtT > 0) return;
  const real = dmg * (1 - st.armor);
  p.hp -= real;
  p.hurtT = 0.55;
  G.screenShake = Math.min(14, G.screenShake + 6);
  if (p.hp <= 0){ p.hp = 0; endNight(false); }
}

function dropLoot(x,y,coin){
  const val = Math.max(1, Math.round(coin * (1 + G.stats.coinBonus)));
  G.loot.push({ x, y, val, vx:rand(-40,40), vy:rand(-40,40), got:false, t:0 });
}

function boom(x,y,col,n,spd){
  for (let i=0;i<n;i++){
    const a=Math.random()*6.28, s=rand(spd*0.3,spd);
    G.parts.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:rand(.3,.7), t:0, col, r:rand(1.5,3.5) });
  }
}

/* ---------- Обновление ---------- */
function update(dt){
  const p = G.player, st = G.stats;

  // движение игрока
  const mv = input.vec();
  p.x += mv.x * st.speed * dt;
  p.y += mv.y * st.speed * dt;
  if (mv.x||mv.y) p.face = Math.atan2(mv.y, mv.x);

  // реген / таймеры
  if (st.regen>0 && p.hp<p.maxHp) p.hp = Math.min(p.maxHp, p.hp + st.regen*dt);
  if (p.hurtT>0) p.hurtT -= dt;
  G.time += dt;
  G.torchFlicker = Math.sin(performance.now()*0.006)*4 + Math.sin(performance.now()*0.017)*2;
  if (G.screenShake>0) G.screenShake = Math.max(0, G.screenShake - dt*30);

  // конец ночи по времени
  if (G.time >= G.duration){ endNight(true); return; }

  // спавн врагов
  G.spawnT -= dt;
  if (G.spawnT <= 0 && G.enemies.length < 70){
    const rate = Math.max(0.26, 1.15 - G.night*0.07 - G.time*0.006);
    G.spawnT = rate;
    spawnEnemy();
    if (G.night>=5 && Math.random()<0.4) spawnEnemy();
  }

  // стрельба
  G.fireT -= dt;
  if (G.fireT <= 0){ fireWeapon(); G.fireT = 1/st.fireRate; }

  // пули
  for (const b of G.bullets){
    b.x += b.vx*dt; b.y += b.vy*dt; b.life -= dt;
    for (const e of G.enemies){
      if (e.hp<=0) continue;
      const rr = e.r + b.r;
      if (dist2(b.x,b.y,e.x,e.y) < rr*rr){
        e.hp -= b.dmg;
        e.hitT = 0.08;
        if (st.knockback>0){
          const a=Math.atan2(e.y-b.y, e.x-b.x);
          e.kb = st.knockback; e.kbx=Math.cos(a); e.kby=Math.sin(a);
        }
        boom(b.x,b.y, b.crit?"#ffd15c":"#ffe6b0", b.crit?7:3, 120);
        b.pierce--;
        if (b.pierce < 0){ b.life = 0; break; }
      }
    }
  }
  G.bullets = G.bullets.filter(b => b.life>0);

  // враги
  for (const e of G.enemies){
    if (e.hp<=0) continue;
    const a = Math.atan2(p.y-e.y, p.x-e.x);
    const sp = e.spd * (1 - st.slow);
    e.x += Math.cos(a)*sp*dt;
    e.y += Math.sin(a)*sp*dt;
    if (e.kb>0){ e.x += e.kbx*e.kb*dt*6; e.y += e.kby*e.kb*dt*6; e.kb=Math.max(0,e.kb-e.kb*dt*8); }
    if (e.hitT>0) e.hitT -= dt;
    // контакт с игроком
    const rr = e.r + 16;
    if (dist2(p.x,p.y,e.x,e.y) < rr*rr) hurtPlayer(e.dmg);
  }
  // смерть врагов
  const alive=[];
  for (const e of G.enemies){
    if (e.hp<=0){ G.kills++; dropLoot(e.x,e.y,e.coin); boom(e.x,e.y,e.col,10,150); }
    else alive.push(e);
  }
  G.enemies = alive;

  // лут
  for (const l of G.loot){
    l.t += dt;
    const dd = dist2(p.x,p.y,l.x,l.y);
    if (dd < st.pickup*st.pickup || l.magnet){
      l.magnet = true;
      const a=Math.atan2(p.y-l.y, p.x-l.x);
      const pull = 240 + l.t*260;
      l.x += Math.cos(a)*pull*dt; l.y += Math.sin(a)*pull*dt;
      if (dd < 20*20){ l.got=true; G.coinRun += l.val; boom(l.x,l.y,"#ffd15c",4,90); }
    } else {
      l.x += l.vx*dt; l.y += l.vy*dt; l.vx*=0.9; l.vy*=0.9;
    }
  }
  G.loot = G.loot.filter(l=>!l.got);

  // частицы
  for (const pt of G.parts){ pt.t+=dt; pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; pt.vx*=0.92; pt.vy*=0.92; }
  G.parts = G.parts.filter(pt=>pt.t<pt.life);

  syncHud();
}

function syncHud(){
  const p=G.player;
  const pct = Math.max(0, p.hp/p.maxHp*100);
  document.getElementById("hpFill").style.width = pct+"%";
  document.getElementById("hpText").textContent = Math.ceil(p.hp);
  document.getElementById("coinRun").textContent = fmt(G.coinRun);
  const tl = Math.max(0, Math.ceil(G.duration - G.time));
  document.getElementById("timeLeft").textContent = tl;
  document.getElementById("waveTimerFill").style.width = (G.time/G.duration*100)+"%";
}

/* ---------- Рендер ---------- */
function render(){
  const p = G.player, st = G.stats;
  let camx = p.x - W/2, camy = p.y - H/2;
  if (G.screenShake>0){ camx += rand(-G.screenShake,G.screenShake); camy += rand(-G.screenShake,G.screenShake); }
  const torchR = st.torch + G.torchFlicker;
  const sx = p.x - camx, sy = p.y - camy; // экранные коорд. игрока

  // фон
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(-camx, -camy);

  // земля — редкая травяная сетка (видна только в свете)
  drawGround(camx, camy, torchR, sx, sy);

  // лут
  for (const l of G.loot){
    ctx.beginPath(); ctx.arc(l.x,l.y,6,0,6.28);
    ctx.fillStyle="#ffd15c"; ctx.shadowColor="#ffd15c"; ctx.shadowBlur=10; ctx.fill();
  }
  ctx.shadowBlur=0;

  // враги (тела) — освещённые покажутся, тёмные скроет мрак, глаза дорисуем позже
  for (const e of G.enemies){
    drawBeast(e);
  }

  // пули
  for (const b of G.bullets){
    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28);
    ctx.fillStyle = b.crit?"#ffd15c":"#fff0c0";
    ctx.shadowColor="#ffcf6b"; ctx.shadowBlur=8; ctx.fill();
  }
  ctx.shadowBlur=0;

  // частицы
  for (const pt of G.parts){
    ctx.globalAlpha = 1 - pt.t/pt.life;
    ctx.fillStyle = pt.col;
    ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r,0,6.28); ctx.fill();
  }
  ctx.globalAlpha=1;

  // игрок
  drawHunter(p);

  ctx.restore();

  // === Тьма с дырой факела ===
  dctx.setTransform(DPR,0,0,DPR,0,0);
  dctx.clearRect(0,0,W,H);
  dctx.globalCompositeOperation="source-over";
  dctx.fillStyle="rgba(3,4,9,0.94)";
  dctx.fillRect(0,0,W,H);
  dctx.globalCompositeOperation="destination-out";
  const g = dctx.createRadialGradient(sx,sy,torchR*0.25, sx,sy,torchR);
  g.addColorStop(0,"rgba(255,255,255,1)");
  g.addColorStop(0.6,"rgba(255,255,255,0.92)");
  g.addColorStop(1,"rgba(255,255,255,0)");
  dctx.fillStyle=g;
  dctx.beginPath(); dctx.arc(sx,sy,torchR,0,6.28); dctx.fill();
  dctx.globalCompositeOperation="source-over";
  ctx.drawImage(dark, 0,0, W,H);

  // тёплый отсвет костра
  ctx.globalCompositeOperation="lighter";
  const wg = ctx.createRadialGradient(sx,sy,0, sx,sy,torchR*0.9);
  wg.addColorStop(0,"rgba(255,150,60,0.10)");
  wg.addColorStop(1,"rgba(255,150,60,0)");
  ctx.fillStyle=wg; ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation="source-over";

  // глаза зверей в темноте
  for (const e of G.enemies){
    const d = Math.hypot(e.x-p.x, e.y-p.y);
    if (d > torchR*0.72){
      const ex = e.x - camx, ey = e.y - camy;
      const a = Math.atan2(p.y-e.y, p.x-e.x);
      const gap = e.r*0.32;
      const px = Math.cos(a+Math.PI/2), py = Math.sin(a+Math.PI/2);
      const pulse = 0.6 + 0.4*Math.sin(performance.now()*0.008 + e.phase);
      ctx.fillStyle = e.eye; ctx.shadowColor=e.eye; ctx.shadowBlur=10*pulse;
      for (const s of [-1,1]){
        ctx.beginPath();
        ctx.arc(ex + px*gap*s, ey + py*gap*s, 2.3, 0, 6.28); ctx.fill();
      }
    }
  }
  ctx.shadowBlur=0;

  // виньетка по краям
  const vg = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.3, W/2,H/2,Math.max(W,H)*0.75);
  vg.addColorStop(0,"rgba(0,0,0,0)"); vg.addColorStop(1,"rgba(0,0,0,0.55)");
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
}

function drawGround(camx,camy,torchR,sx,sy){
  const step=54;
  const x0=Math.floor(camx/step)*step, y0=Math.floor(camy/step)*step;
  ctx.fillStyle="#0e1520";
  for (let x=x0; x<camx+W+step; x+=step){
    for (let y=y0; y<camy+H+step; y+=step){
      // псевдослучайное смещение — травинки
      const h = ((x*73856093) ^ (y*19349663)) >>> 0;
      const ox = (h%37)-18, oy=((h>>5)%37)-18;
      ctx.fillRect(x+ox, y+oy, 3, 3);
    }
  }
}

function drawBeast(e){
  const wob = Math.sin(performance.now()*0.012 + e.phase)*2;
  ctx.save();
  ctx.translate(e.x, e.y);
  // тело
  ctx.beginPath();
  ctx.ellipse(0, wob*0.4, e.r, e.r*0.82, 0, 0, 6.28);
  ctx.fillStyle = e.hitT>0 ? "#ffffff" : e.col;
  ctx.shadowColor=e.col; ctx.shadowBlur=e.hitT>0?18:6;
  ctx.fill();
  ctx.shadowBlur=0;
  // тёмная спина
  ctx.beginPath();
  ctx.ellipse(0,-e.r*0.25, e.r*0.7, e.r*0.4, 0,0,6.28);
  ctx.fillStyle="rgba(0,0,0,0.28)"; ctx.fill();
  // глаза
  ctx.fillStyle=e.eye;
  ctx.beginPath(); ctx.arc(-e.r*0.35,-e.r*0.2,e.r*0.16,0,6.28); ctx.fill();
  ctx.beginPath(); ctx.arc( e.r*0.35,-e.r*0.2,e.r*0.16,0,6.28); ctx.fill();
  // полоска здоровья при уроне
  if (e.hp < e.maxHp){
    const w=e.r*2;
    ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(-w/2,-e.r-9,w,4);
    ctx.fillStyle="#e5484d"; ctx.fillRect(-w/2,-e.r-9,w*(e.hp/e.maxHp),4);
  }
  ctx.restore();
}

function drawHunter(p){
  const t = performance.now()*0.001;
  ctx.save();
  ctx.translate(p.x, p.y);
  // тень
  ctx.beginPath(); ctx.ellipse(0,10,16,7,0,0,6.28);
  ctx.fillStyle="rgba(0,0,0,0.4)"; ctx.fill();
  // тело
  ctx.beginPath(); ctx.arc(0,0,13,0,6.28);
  const flash = p.hurtT>0 && Math.floor(t*20)%2===0;
  ctx.fillStyle = flash ? "#ff8a8a" : "#d9e2f2";
  ctx.shadowColor="#cfe0ff"; ctx.shadowBlur=12; ctx.fill(); ctx.shadowBlur=0;
  // капюшон
  ctx.beginPath(); ctx.arc(0,-2,10,Math.PI*0.05,Math.PI*0.95);
  ctx.fillStyle="#2c3648"; ctx.fill();
  // ружьё в сторону прицела
  ctx.rotate(p.aim||0);
  ctx.fillStyle="#4a5568";
  ctx.fillRect(4,-2.5,20,5);
  ctx.fillStyle="#8ea2c4"; ctx.fillRect(20,-2,7,4);
  ctx.restore();
}

/* ---------- Конец ночи ---------- */
function endNight(survived){
  if (G.mode !== "play") return;
  G.mode = "menu";
  save.coins += G.coinRun;
  if (survived && G.night+1 > save.bestNight) save.bestNight = G.night+1;
  persist();
  document.getElementById("resIco").textContent = survived ? "🌅" : "💀";
  document.getElementById("resTitle").textContent = survived ? "Ночь пережита!" : "Тебя настигли…";
  document.getElementById("resSub").textContent = survived
    ? "Рассвет прогнал зверей. Впереди — ночь потяжелее."
    : "Звери одолели охотника. Но добыча осталась при тебе.";
  document.getElementById("resNight").textContent = G.night;
  document.getElementById("resKills").textContent = G.kills;
  document.getElementById("resCoins").textContent = "+"+fmt(G.coinRun);
  // следующая ночь: успех → +1, провал → та же
  G.nextNight = survived ? G.night+1 : G.night;
  showOnly("result");
  refreshMenuStats();
}

/* ---------- Главный цикл ---------- */
let lastT = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now-lastT)/1000);
  lastT = now;
  if (G.mode === "play"){ update(dt); render(); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ============================================================
   Управление (виртуальный джойстик + клавиатура)
   ============================================================ */
const input = (() => {
  let active=false, id=null, ox=0, oy=0, cx=0, cy=0;
  const R=52;
  const base=document.getElementById("stickBase");
  const knob=document.getElementById("stickKnob");
  const zone=document.getElementById("stickZone");
  const keys={};
  function set(x,y){
    cx=x; cy=y;
    let dx=cx-ox, dy=cy-oy;
    const d=Math.hypot(dx,dy);
    if (d>R){ dx=dx/d*R; dy=dy/d*R; }
    knob.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
  zone.addEventListener("pointerdown", e=>{
    if (active) return;
    active=true; id=e.pointerId; ox=e.clientX; oy=e.clientY;
    base.style.left=ox+"px"; base.style.top=oy+"px"; base.classList.add("on");
    set(ox,oy); zone.setPointerCapture(id);
  });
  zone.addEventListener("pointermove", e=>{ if (active && e.pointerId===id) set(e.clientX,e.clientY); });
  const up = e=>{ if (active && e.pointerId===id){ active=false; base.classList.remove("on"); knob.style.transform="translate(-50%,-50%)"; } };
  zone.addEventListener("pointerup", up);
  zone.addEventListener("pointercancel", up);
  window.addEventListener("keydown", e=>keys[e.key.toLowerCase()]=true);
  window.addEventListener("keyup", e=>keys[e.key.toLowerCase()]=false);
  return {
    vec(){
      let x=0,y=0;
      if (active){
        let dx=cx-ox, dy=cy-oy; const d=Math.hypot(dx,dy);
        if (d>6){ const m=Math.min(1,d/R); x=dx/d*m; y=dy/d*m; }
      }
      let kx=(keys["d"]||keys["arrowright"]?1:0)-(keys["a"]||keys["arrowleft"]?1:0);
      let ky=(keys["s"]||keys["arrowdown"]?1:0)-(keys["w"]||keys["arrowup"]?1:0);
      if (kx||ky){ const m=Math.hypot(kx,ky); x=kx/m; y=ky/m; }
      return {x,y};
    }
  };
})();

/* ============================================================
   Экраны / меню
   ============================================================ */
const screens = ["menu","tree","result","pause","how","hud"];
function showOnly(idOrList){
  const list = Array.isArray(idOrList)?idOrList:[idOrList];
  for (const s of screens){
    document.getElementById(s).classList.toggle("hidden", !list.includes(s));
  }
}
function refreshMenuStats(){
  document.getElementById("bestNight").textContent = save.bestNight;
  document.getElementById("coinBank").textContent = fmt(save.coins);
}

document.getElementById("playBtn").onclick = ()=> startNight(save.bestNight);
document.getElementById("resAgain").onclick = ()=> startNight(G.nextNight || 1);
document.getElementById("resMenu").onclick = ()=>{ showOnly("menu"); refreshMenuStats(); };
document.getElementById("resTree").onclick = ()=> openTree();
document.getElementById("treeBtn").onclick = ()=> openTree();
document.getElementById("treeBack").onclick = ()=>{ showOnly("menu"); refreshMenuStats(); };
document.getElementById("howBtn").onclick = ()=> showOnly("how");
document.getElementById("howClose").onclick = ()=> showOnly("menu");
document.getElementById("pauseBtn").onclick = ()=>{ if (G.mode==="play"){ G.mode="pause"; showOnly(["hud","pause"]); } };
document.getElementById("resumeBtn").onclick = ()=>{ if (G.mode==="pause"){ G.mode="play"; lastT=performance.now(); showOnly("hud"); } };
document.getElementById("quitBtn").onclick = ()=>{ G.mode="menu"; showOnly("menu"); refreshMenuStats(); };

/* ---------- Дерево: построение DOM ---------- */
let selNode = null;
function buildTree(){
  const nodesEl = document.getElementById("treeNodes");
  const svg = document.getElementById("treeLines");
  nodesEl.style.height = TREE_H+"px";
  svg.setAttribute("height", TREE_H);
  svg.style.height = TREE_H+"px";
  nodesEl.innerHTML=""; svg.innerHTML="";
  const wpx = ()=> nodesEl.clientWidth || Math.min(W,520);
  // линии
  for (const n of TREE){
    for (const r of n.req){
      const a=NODE[r]; if (!a) continue;
      const line=document.createElementNS("http://www.w3.org/2000/svg","line");
      line.setAttribute("x1",(a.x/100*wpx()));
      line.setAttribute("y1",a.y);
      line.setAttribute("x2",(n.x/100*wpx()));
      line.setAttribute("y2",n.y);
      line.setAttribute("data-to", n.id);
      line.setAttribute("stroke-width","3");
      svg.appendChild(line);
    }
  }
  // узлы
  for (const n of TREE){
    const el=document.createElement("div");
    el.className="node b-"+n.branch;
    el.dataset.id=n.id;
    el.style.left=n.x+"%"; el.style.top=n.y+"px";
    if (n.branch==="root") el.classList.add("root");
    el.innerHTML=`<span>${n.icon}</span>`+(n.max>0?`<span class="lvltag"></span>`:"");
    el.onclick=()=> selectNode(n.id);
    nodesEl.appendChild(el);
    n._el=el;
  }
  refreshTree();
}
function selectNode(id){
  selNode=id;
  refreshTree();
  const n=NODE[id];
  const info=document.getElementById("nodeInfo");
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
  else {
    const c=nodeCost(n);
    buy.textContent=`Открыть · 🪙 ${fmt(c)}`;
    const ok=save.coins>=c; buy.disabled=!ok; buy.classList.toggle("disabled",!ok);
  }
}
document.getElementById("niBuy").onclick=()=>{
  const n=NODE[selNode]; if (!n||!canBuy(n)) return;
  save.coins -= nodeCost(n);
  save.owned[n.id] = nodeLevel(n.id)+1;
  persist();
  flash(n._el);
  selectNode(n.id);
  refreshTree();
};
function refreshTree(){
  document.getElementById("coinTree").textContent = fmt(save.coins);
  for (const n of TREE){
    const el=n._el; if (!el) continue;
    el.classList.remove("owned","locked","can","max","sel");
    if (n.branch==="root"){ el.classList.add("owned"); }
    else {
      const lv=nodeLevel(n.id);
      if (lv>0) el.classList.add("owned");
      if (nodeMaxed(n)) el.classList.add("max");
      if (!nodeUnlocked(n)) el.classList.add("locked");
      else if (canBuy(n)) el.classList.add("can");
      const tag=el.querySelector(".lvltag");
      if (tag) tag.textContent = nodeMaxed(n) ? "MAX" : lv+"/"+n.max;
    }
    if (n.id===selNode) el.classList.add("sel");
  }
  // подсветка активных линий
  const svg=document.getElementById("treeLines");
  for (const line of svg.querySelectorAll("line")){
    const to=NODE[line.getAttribute("data-to")];
    line.setAttribute("stroke", nodeLevel(to.id)>0 ? "#f5a524" : "#2a3140");
  }
}
function flash(el){ el.animate([{transform:"translate(-50%,-50%) scale(1.35)"},{transform:"translate(-50%,-50%) scale(1)"}],{duration:280,easing:"ease-out"}); }
function openTree(){
  showOnly("tree");
  buildTree();
  document.getElementById("treeScroll").scrollTop=0;
}
window.addEventListener("resize", ()=>{ if (!document.getElementById("tree").classList.contains("hidden")) buildTree(); });

/* ---------- Старт ---------- */
refreshMenuStats();
showOnly("menu");

/* Service worker */
if ("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
