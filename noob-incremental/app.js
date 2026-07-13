/* ============================================================
   НУБ ИНКРЕМЕНТАЛ — 2D incremental
   Тапай нубов → Oof → нубы → сотни улучшений → руны → престиж
   (призмы) → вознесение (звёзды). Оффлайн, localStorage.
   ============================================================ */
"use strict";

/* ============ Форматирование чисел ============ */
const SUF = ["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc","UDc","DDc","TDc","QaDc","QiDc","SxDc","SpDc","OcDc","NoDc","Vg"];
function fmt(n){
  if(n===Infinity) return "∞";
  if(n<0) return "-"+fmt(-n);
  if(n<1000){ return (n>=100||n===Math.floor(n))? Math.floor(n).toString() : (n>=10? n.toFixed(1): n.toFixed(2)); }
  let t=Math.floor(Math.log10(n)/3);
  if(t<SUF.length){
    let v=n/Math.pow(1000,t);
    return (v<10? v.toFixed(2): v<100? v.toFixed(1): Math.floor(v).toString())+SUF[t];
  }
  return n.toExponential(2).replace("e+","e");
}
function fmtInt(n){ return Math.floor(n).toLocaleString("ru-RU"); }

/* ============ Определения контента ============ */
// Нубы (юниты, генерят Oof/с)
const NOOBS = [
  { id:"noob",   name:"Нуб",          icon:"🧍", base:15,      prod:0.1,   color:"#ffd23f" },
  { id:"guest",  name:"Гость",        icon:"👤", base:120,     prod:1,     color:"#9aa3d4" },
  { id:"pro",    name:"Про",          icon:"😎", base:1.3e3,   prod:8,     color:"#3ddc84" },
  { id:"builder",name:"Строитель",    icon:"👷", base:14e3,    prod:47,    color:"#ff9f40" },
  { id:"cheater",name:"Читер",        icon:"🕶️", base:170e3,   prod:260,   color:"#ff5d6c" },
  { id:"admin",  name:"Админ",        icon:"🛡️", base:2e6,     prod:1400,  color:"#5b9bff" },
  { id:"boss",   name:"Босс",         icon:"👹", base:30e6,    prod:7800,  color:"#b06cff" },
  { id:"legend", name:"Легенда",      icon:"🌟", base:450e6,   prod:44000, color:"#ffd23f" },
  { id:"dragon", name:"Дракон",       icon:"🐉", base:8e9,     prod:2.6e5, color:"#3ddc84" },
  { id:"god",    name:"Бог",          icon:"👑", base:1.2e11,  prod:1.6e6, color:"#ffb84d" },
  { id:"void",   name:"Пустота",      icon:"🌀", base:2e12,    prod:1e7,   color:"#7cf3ff" },
  { id:"guru",   name:"Гуру",         icon:"✨", base:4e13,    prod:7e7,   color:"#ff4d8d" },
];
const NOOB = Object.fromEntries(NOOBS.map(n=>[n.id,n]));
const COST_MUL = 1.15;

// ---- Улучшения ----  (генерируются: клик / глобальные / по каждому нубу)
const UPS = [];
// клик-улучшения
const CLICK_UPS = [
  { mul:2, cost:60 }, { mul:2, cost:900 }, { mul:2, cost:12e3 }, { mul:3, cost:2e5 },
  { mul:3, cost:4e6 }, { mul:4, cost:8e7 }, { mul:5, cost:2e9 }, { mul:5, cost:6e10 },
  { mul:7, cost:1e12 }, { mul:10, cost:3e13 },
];
CLICK_UPS.forEach((u,i)=>UPS.push({
  id:"clk"+i, kind:"click", icon:"👆", name:"Крепкий палец "+toRoman(i+1),
  desc:"Oof за тап ×"+u.mul, cost:u.cost, cur:"oof",
  req:()=> save.lifetimeClicks >= (i===0?1:0) && save.lifetimeOof >= u.cost/8,
  apply:m=>{ m.click*=u.mul; }
}));
// «сила народа»: клик получает % от Oof/с
[{p:0.02,c:5e3},{p:0.03,c:1e6},{p:0.05,c:2e8},{p:0.08,c:5e10},{p:0.12,c:2e13}].forEach((u,i)=>UPS.push({
  id:"clkps"+i, kind:"clickps", icon:"🖐️", name:"Сила народа "+toRoman(i+1),
  desc:"+"+(u.p*100)+"% от Oof/с к тапу", cost:u.c, cur:"oof",
  req:()=> save.lifetimeOof >= u.c/6,
  apply:m=>{ m.clickFromPs += u.p; }
}));
// по каждому нубу: пороги владения удваивают выработку
const NOOB_THRESH = [10,25,50,100,150,200,300,400];
NOOBS.forEach((nb,ti)=>{
  NOOB_THRESH.forEach((t,i)=>{
    const cost = nb.base * t * 10 * Math.pow(5,i);
    UPS.push({
      id:nb.id+"u"+i, kind:"noob", noob:nb.id, icon:nb.icon,
      name:nb.name+" ×2 ("+t+")", desc:nb.name+" делают Oof вдвое быстрее",
      cost:cost, cur:"oof",
      req:()=> (save.noobs[nb.id]||0) >= t,
      apply:m=>{ m.noob[nb.id]=(m.noob[nb.id]||1)*2; }
    });
  });
});
// глобальные множители всех нубов
const GLOB_UPS = [
  { mul:1.5, cost:1e4, need:"noob" }, { mul:1.5, cost:5e5, need:"pro" },
  { mul:2, cost:2e7, need:"admin" }, { mul:2, cost:1e9, need:"boss" },
  { mul:2, cost:5e10, need:"god" }, { mul:3, cost:2e12, need:"void" },
  { mul:3, cost:8e13, need:"guru" },
];
GLOB_UPS.forEach((u,i)=>UPS.push({
  id:"glob"+i, kind:"global", icon:"🌍", name:"Мем-волна "+toRoman(i+1),
  desc:"Все нубы ×"+u.mul, cost:u.cost, cur:"oof",
  req:()=> (save.noobs[u.need]||0) >= 1,
  apply:m=>{ m.global*=u.mul; }
}));
// крит
[{c:0.05,cost:3e4},{c:0.05,cost:5e6},{c:0.05,cost:1e9},{c:0.05,cost:3e11}].forEach((u,i)=>UPS.push({
  id:"crit"+i, kind:"crit", icon:"💥", name:"Удача нуба "+toRoman(i+1),
  desc:"+"+(u.c*100)+"% шанс крита тапа", cost:u.cost, cur:"oof",
  req:()=> save.lifetimeOof >= u.cost/6,
  apply:m=>{ m.crit += u.c; }
}));
[{p:0.5,cost:2e5},{p:1,cost:2e8},{p:2,cost:1e12}].forEach((u,i)=>UPS.push({
  id:"critp"+i, kind:"critp", icon:"⚡", name:"Мощь крита "+toRoman(i+1),
  desc:"Крит-урон +"+(u.p*100)+"%", cost:u.cost, cur:"oof",
  req:()=> save.lifetimeOof >= u.cost/6,
  apply:m=>{ m.critPow += u.p; }
}));
const UP = Object.fromEntries(UPS.map(u=>[u.id,u]));

// ---- Руны ----
const RARITIES = [
  { name:"Обычная",    w:58, cls:"rar-0", mul:1 },
  { name:"Необычная",  w:26, cls:"rar-1", mul:1.7 },
  { name:"Редкая",     w:10, cls:"rar-2", mul:2.8 },
  { name:"Эпическая",  w:4.4,cls:"rar-3", mul:4.6 },
  { name:"Легендарная",w:1.3,cls:"rar-4", mul:8 },
  { name:"Мифическая", w:0.3,cls:"rar-5", mul:15 },
];
const RUNE_TYPES = [
  { id:"ops",   icon:"🌀", name:"руна Oof/с",   base:6,   fmt:v=>"+"+v.toFixed(0)+"% Oof/с",   apply:(m,v)=>m.global*= (1+v/100) },
  { id:"click", icon:"👆", name:"руна тапа",     base:8,   fmt:v=>"+"+v.toFixed(0)+"% к тапу",   apply:(m,v)=>m.click*= (1+v/100) },
  { id:"cost",  icon:"🏷️", name:"руна скидки",   base:2.5, fmt:v=>"-"+v.toFixed(1)+"% цена нубов", apply:(m,v)=>m.cost*= (1-Math.min(v,80)/100) },
  { id:"crit",  icon:"💥", name:"руна крита",     base:3,   fmt:v=>"+"+v.toFixed(1)+"% крит",     apply:(m,v)=>m.crit+= v/100 },
  { id:"prism", icon:"💎", name:"руна призм",     base:5,   fmt:v=>"+"+v.toFixed(0)+"% призм",    apply:(m,v)=>m.prism*= (1+v/100) },
  { id:"energy",icon:"⚡", name:"руна энергии",   base:8,   fmt:v=>"+"+v.toFixed(0)+"% скор. рун", apply:(m,v)=>m.runeRegen*= (1+v/100) },
  { id:"all",   icon:"✨", name:"руна силы",      base:4,   fmt:v=>"+"+v.toFixed(0)+"% всего",    apply:(m,v)=>{m.global*=(1+v/100);m.click*=(1+v/100);} },
];
const RTYPE = Object.fromEntries(RUNE_TYPES.map(r=>[r.id,r]));
function runeValue(r){ // сила руны по типу/редкости/уровню
  const t=RTYPE[r.type], rar=RARITIES[r.rar];
  return t.base * rar.mul * (1 + 0.25*(r.lvl-1));
}
function runeUpCost(r){ return Math.ceil(6 * Math.pow(1.8, r.lvl-1) * RARITIES[r.rar].mul); }

// ---- Призматические улучшения ----
const PRISM_UPS = [
  { id:"shine",  icon:"💎", name:"Призматический блеск", max:100, desc:l=>"Всё ×"+(1+0.1*l).toFixed(1),
    cost:l=>Math.ceil(2*Math.pow(1.35,l)), apply:(m,l)=>m.global*=(1+0.1*l) },
  { id:"click",  icon:"👆", name:"Вечный палец", max:100, desc:l=>"Тап ×"+(1+0.25*l).toFixed(2),
    cost:l=>Math.ceil(2*Math.pow(1.3,l)), apply:(m,l)=>m.click*=(1+0.25*l) },
  { id:"start",  icon:"💰", name:"Стартовый капитал", max:40, desc:l=>"Старт с "+fmt(startOof(l))+" Oof",
    cost:l=>Math.ceil(3*Math.pow(1.5,l)), apply:()=>{} },
  { id:"disc",   icon:"🏷️", name:"Оптовая скидка", max:30, desc:l=>"Нубы дешевле "+(l*1.5).toFixed(0)+"%",
    cost:l=>Math.ceil(4*Math.pow(1.45,l)), apply:(m,l)=>m.cost*=(1-Math.min(l*1.5,60)/100) },
  { id:"slots",  icon:"🔮", name:"Слоты рун", max:5, desc:l=>"+"+l+" слот рун",
    cost:l=>Math.ceil(8*Math.pow(2.4,l)), apply:()=>{} },
  { id:"fastr",  icon:"⚡", name:"Быстрые руны", max:20, desc:l=>"Энергия рун +"+(l*15)+"%",
    cost:l=>Math.ceil(4*Math.pow(1.4,l)), apply:(m,l)=>m.runeRegen*=(1+l*0.15) },
  { id:"offline",icon:"🌙", name:"Оффлайн-доход", max:20, desc:l=>l?("Оффлайн "+Math.min(5+l*4,85)+"% Oof/с"):"Заблокировано",
    cost:l=>Math.ceil(6*Math.pow(1.5,l)), apply:(m,l)=>{ if(l>0) m.offline=Math.min(0.05+l*0.04,0.85); } },
  { id:"autoc",  icon:"🤖", name:"Автокликер", max:20, desc:l=>l?(fmt(l*3)+" тапов/с"):"Заблокировано",
    cost:l=>Math.ceil(10*Math.pow(1.6,l)), apply:(m,l)=>m.autoClick=l*3 },
  { id:"autob",  icon:"🛒", name:"Автопокупка", max:1, desc:l=>l?"Покупает лучших нубов сам":"Заблокировано",
    cost:()=>50, apply:(m,l)=>m.autoBuy=l>0 },
  { id:"pmul",   icon:"🌟", name:"Больше призм", max:50, desc:l=>"Призм за престиж +"+(l*8)+"%",
    cost:l=>Math.ceil(5*Math.pow(1.5,l)), apply:(m,l)=>m.prism*=(1+l*0.08) },
];
const PRISM_UP = Object.fromEntries(PRISM_UPS.map(p=>[p.id,p]));
function startOof(l){ return l<=0?0: 100*Math.pow(6,l); }

// ---- Звёздные улучшения (вознесение) ----
const STAR_UPS = [
  { id:"sshine", icon:"⭐", name:"Звёздный блеск", max:200, desc:l=>"Всё ×"+(1+0.5*l).toFixed(1),
    cost:l=>Math.ceil(1*Math.pow(1.4,l)), apply:(m,l)=>m.global*=(1+0.5*l) },
  { id:"skeep",  icon:"💎", name:"Хранитель призм", max:50, desc:l=>"Оставляй "+(l*2)+"% призм при вознесении",
    cost:l=>Math.ceil(2*Math.pow(1.5,l)), apply:()=>{} },
  { id:"spmul",  icon:"💫", name:"Звёздный поток", max:100, desc:l=>"Призм и Oof +"+(l*15)+"%",
    cost:l=>Math.ceil(2*Math.pow(1.45,l)), apply:(m,l)=>{ m.prism*=(1+l*0.15); m.global*=(1+l*0.15); } },
];
const STAR_UP = Object.fromEntries(STAR_UPS.map(s=>[s.id,s]));

function toRoman(n){ const r=["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"]; return r[n]||n; }

/* ============ Сохранение ============ */
const SAVE_KEY = "noobinc_v1";
const DEFAULT = ()=>({
  oof:0, totalOof:0, lifetimeOof:0, lifetimeClicks:0,
  noobs:{}, ups:{}, prisms:0, prestiges:0, prismUps:{},
  runes:[], dust:0, energy:5, stars:0, ascends:0, starUps:{},
  lastTime:Date.now(), seen:{},
  admin:{ oofMul:1, clickMul:1, costMul:1, prismMul:1, speed:1 }
});
let save = DEFAULT();
function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
    if(raw){ save=Object.assign(DEFAULT(),raw);
      for(const k of ["noobs","ups","prismUps","starUps","seen"]) if(!save[k]) save[k]={};
      if(!Array.isArray(save.runes)) save.runes=[];
      save.admin=Object.assign({ oofMul:1, clickMul:1, costMul:1, prismMul:1, speed:1 }, save.admin||{});
    }
  }catch(e){ save=DEFAULT(); }
}
let saveTimer=0;
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
function queueSave(){ saveTimer=1.2; }

/* ============ Производные характеристики ============ */
let D = {}; // derived
function recompute(){
  const m = { global:1, click:1, clickFromPs:0, crit:0, critPow:1.5, cost:1,
    prism:1, runeRegen:1, offline:0, autoClick:0, autoBuy:false, noob:{} };
  // улучшения
  for(const id in save.ups){ if(save.ups[id] && UP[id]) UP[id].apply(m); }
  // призматические
  for(const p of PRISM_UPS){ const l=save.prismUps[p.id]||0; if(l>0) p.apply(m,l); }
  // звёздные
  for(const s of STAR_UPS){ const l=save.starUps[s.id]||0; if(l>0) s.apply(m,l); }
  // руны
  for(const r of save.runes){ if(r) RTYPE[r.type].apply(m, runeValue(r)); }
  // админ-множители
  const a=save.admin||{};
  m.global *= (a.oofMul||1); m.click *= (a.clickMul||1);
  m.cost *= (a.costMul||1); m.prism *= (a.prismMul||1);

  D.global=m.global; D.click=m.click; D.clickFromPs=m.clickFromPs;
  D.crit=Math.min(m.crit,1); D.critPow=m.critPow; D.costMul=Math.max(m.cost,0.02);
  D.prismMul=m.prism; D.runeRegen=m.runeRegen; D.offline=m.offline;
  D.autoClick=m.autoClick; D.autoBuy=m.autoBuy; D.noobMul=m.noob;
  D.slots = 3 + (save.prismUps.slots||0);

  // Oof/с
  let ops=0;
  for(const nb of NOOBS){ const c=save.noobs[nb.id]||0; if(c>0) ops += c*nb.prod*(m.noob[nb.id]||1); }
  ops *= m.global;
  D.ops=ops;
  D.clickBase = (1*m.click + ops*m.clickFromPs) * m.global;
}

function noobCost(id, owned){ return NOOB[id].base * Math.pow(COST_MUL, owned) * D.costMul; }
function prismGain(total){ // призмы за престиж
  if(total < 1e6) return 0;
  return Math.floor(Math.pow(total/1e6, 0.5) * D.prismMul);
}
function starGain(prisms){
  if(prisms < 500) return 0;
  return Math.floor(Math.pow(prisms/500, 0.6));
}

/* ============ Действия ============ */
function doClick(x,y){
  recompute();
  let amt=D.clickBase; let crit=false;
  if(Math.random()<D.crit){ amt*=D.critPow; crit=true; }
  gainOof(amt);
  save.lifetimeClicks++;
  spawnFloat(x,y, "+"+fmt(amt), crit);
  if(crit) burst(x,y);
  hideHint();
  queueSave();
}
function gainOof(a){ save.oof+=a; save.totalOof+=a; save.lifetimeOof+=a; }

function buyNoob(id){
  recompute();
  const owned=save.noobs[id]||0;
  const cost=noobCost(id,owned);
  if(save.oof < cost) return;
  save.oof-=cost; save.noobs[id]=owned+1;
  recompute(); syncNoobSprites(); renderNoobs(); refreshTop(); queueSave();
}
function buyMax(id){
  recompute();
  let bought=0;
  while(bought<1000){
    const owned=save.noobs[id]||0; const cost=noobCost(id,owned);
    if(save.oof<cost) break;
    save.oof-=cost; save.noobs[id]=owned+1; bought++;
  }
  if(bought){ recompute(); syncNoobSprites(); renderNoobs(); refreshTop(); queueSave();
    toast("Куплено "+bought+"× "+NOOB[id].name); }
}
function buyUp(id){
  const u=UP[id]; if(!u||save.ups[id]) return;
  if(save.oof < u.cost) return;
  save.oof-=u.cost; save.ups[id]=true;
  recompute(); renderUps(); refreshTop(); queueSave();
  toast("⚡ "+u.name);
}

/* ---- Руны ---- */
function rollRune(){
  if(save.energy<1){ toast("Нет энергии рун"); return; }
  save.energy--;
  const rar=pickRarity(), type=RUNE_TYPES[Math.floor(Math.random()*RUNE_TYPES.length)];
  const r={ type:type.id, rar:rar, lvl:1 };
  showDrop(r);
  queueSave();
}
function pickRarity(){
  const tot=RARITIES.reduce((s,r)=>s+r.w,0); let x=Math.random()*tot;
  for(let i=0;i<RARITIES.length;i++){ x-=RARITIES[i].w; if(x<=0) return i; }
  return 0;
}
function equipRune(r, slot){
  save.runes[slot]=r;
  recompute(); renderRunes(); refreshTop(); queueSave();
}
function scrapRune(r){
  const dust=Math.ceil((r.rar+1)*(r.rar+1)*1.5);
  save.dust+=dust; toast("💠 +"+dust+" пыли"); renderRunes(); queueSave();
}
function upRune(i){
  const r=save.runes[i]; if(!r) return;
  const cost=runeUpCost(r);
  if(save.dust<cost){ toast("Нужно "+cost+" пыли"); return; }
  save.dust-=cost; r.lvl++;
  recompute(); renderRunes(); refreshTop(); queueSave();
}

/* ---- Престиж ---- */
function doPrestige(){
  recompute();
  const g=prismGain(save.totalOof);
  if(g<1) return;
  save.prisms+=g; save.prestiges++;
  softReset();
  recompute(); syncNoobSprites();
  toast("💎 +"+fmt(g)+" призм!");
  switchTab("prestige"); renderAll(); refreshTop(); persist();
}
function buyPrismUp(id){
  const p=PRISM_UP[id]; const l=save.prismUps[id]||0;
  if(l>=p.max) return;
  const cost=p.cost(l);
  if(save.prisms<cost) return;
  save.prisms-=cost; save.prismUps[id]=l+1;
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function doAscend(){
  recompute();
  const g=starGain(save.prisms);
  if(g<1) return;
  save.stars+=g; save.ascends++;
  const keep=Math.floor(save.prisms * (save.starUps.skeep||0)*0.02);
  save.prisms=keep; save.prismUps={};
  softReset();
  recompute(); syncNoobSprites();
  toast("⭐ +"+fmt(g)+" звёзд!");
  renderAll(); refreshTop(); persist();
}
function buyStarUp(id){
  const s=STAR_UP[id]; const l=save.starUps[id]||0;
  if(l>=s.max) return;
  const cost=s.cost(l);
  if(save.stars<cost) return;
  save.stars-=cost; save.starUps[id]=l+1;
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function softReset(){
  save.oof=startOof(save.prismUps.start||0);
  save.totalOof=save.oof; save.noobs={}; save.ups={};
}

/* ============ Оффлайн-доход ============ */
function applyOffline(){
  const now=Date.now();
  const dt=Math.min((now-(save.lastTime||now))/1000, 60*60*24); // до 24ч
  save.lastTime=now;
  if(dt<5) return;
  recompute();
  const rate=D.offline;
  if(rate>0 && D.ops>0){
    const earn=D.ops*rate*dt;
    if(earn>0){ gainOof(earn); setTimeout(()=>toast("🌙 Оффлайн: +"+fmt(earn)+" Oof"),400); }
  }
  // энергия рун копится и оффлайн
  save.energy=Math.min(D.slots+2, (save.energy||0) + dt/ (60/D.runeRegen));
}

/* ============ 2D СЦЕНА ============ */
const cv=document.getElementById("c"), ctx=cv.getContext("2d");
let W=0,Hc=0,DPR=1;
function resize(){
  DPR=Math.min(window.devicePixelRatio||1, 2);
  const r=document.getElementById("scene").getBoundingClientRect();
  W=r.width; Hc=r.height;
  cv.width=W*DPR; cv.height=Hc*DPR; ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener("resize", resize);

let sprites=[]; // маленькие нубы
let floats=[];  // всплывающий текст
let particles=[];
let heroPulse=0;
function hero(){ return { x:W/2, y:Hc*0.52, r:Math.min(W,Hc)*0.16 }; }

function syncNoobSprites(){
  let total=0; for(const nb of NOOBS) total+=(save.noobs[nb.id]||0);
  const target=Math.min(total, 60);
  // построим взвешенный список типов по количеству
  while(sprites.length<target){
    sprites.push(makeSprite());
  }
  if(sprites.length>target) sprites.length=target;
  // назначить иконки пропорционально владению (лучшие нубы заметнее)
  const pool=[];
  for(const nb of NOOBS){ const c=save.noobs[nb.id]||0; for(let i=0;i<c && pool.length<400;i++) pool.push(nb); }
  for(let i=0;i<sprites.length;i++){
    const nb = pool.length? pool[Math.floor(i/sprites.length*pool.length)] : NOOB.noob;
    sprites[i].icon=nb.icon; sprites[i].color=nb.color;
  }
}
function makeSprite(){
  return { x:Math.random()*W, y:Hc*0.62+Math.random()*Hc*0.32, vx:(Math.random()-.5)*14,
    icon:"🧍", color:"#ffd23f", ph:Math.random()*6.28, sz:13+Math.random()*7 };
}
function spawnFloat(x,y,txt,crit){
  floats.push({ x,y, txt, life:1, crit, vy:-46-Math.random()*20, vx:(Math.random()-.5)*24 });
  if(floats.length>40) floats.shift();
}
function burst(x,y){
  for(let i=0;i<14;i++){ const a=Math.random()*6.28, s=40+Math.random()*120;
    particles.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s-30, life:1, c:i%2?"#ffd23f":"#ff5d6c" }); }
}
function drawHero(){
  const h=hero(); const s=1+Math.sin(heroPulse)*0.03 + (heroClick>0?heroClick*0.12:0);
  ctx.save();
  ctx.translate(h.x,h.y);
  ctx.scale(s,s);
  // тень/аура
  const glow=ctx.createRadialGradient(0,0,h.r*0.3,0,0,h.r*1.7);
  glow.addColorStop(0,"rgba(255,210,63,.22)"); glow.addColorStop(1,"rgba(255,210,63,0)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,h.r*1.7,0,6.29); ctx.fill();
  drawNoobBody(0,0,h.r,"#ffd23f");
  ctx.restore();
  // подпись Oof/с
}
function drawNoobBody(x,y,r,col){
  ctx.save(); ctx.translate(x,y);
  // тело (торс)
  ctx.fillStyle="#2f6fd6";
  rr(-r*0.55,-r*0.05, r*1.1, r*0.85, r*0.14); ctx.fill();
  // ноги
  ctx.fillStyle="#3ddc84";
  rr(-r*0.5,r*0.72, r*0.42, r*0.5, r*0.1); ctx.fill();
  rr(r*0.08,r*0.72, r*0.42, r*0.5, r*0.1); ctx.fill();
  // голова
  ctx.fillStyle=col;
  rr(-r*0.62,-r*0.95, r*1.24, r*0.98, r*0.2); ctx.fill();
  // глаза
  ctx.fillStyle="#1a1a2e";
  ctx.beginPath(); ctx.ellipse(-r*0.26,-r*0.5,r*0.11,r*0.15,0,0,6.29); ctx.fill();
  ctx.beginPath(); ctx.ellipse(r*0.26,-r*0.5,r*0.11,r*0.15,0,0,6.29); ctx.fill();
  // рот (oof — овал)
  ctx.beginPath(); ctx.ellipse(0,-r*0.16,r*0.16,r*0.2,0,0,6.29); ctx.fill();
  ctx.restore();
}
function rr(x,y,w,h,rad){ ctx.beginPath();
  ctx.moveTo(x+rad,y); ctx.arcTo(x+w,y,x+w,y+h,rad); ctx.arcTo(x+w,y+h,x,y+h,rad);
  ctx.arcTo(x,y+h,x,y,rad); ctx.arcTo(x,y,x+w,y,rad); ctx.closePath(); }

let heroClick=0;
function render(dt){
  ctx.clearRect(0,0,W,Hc);
  // земля
  const g=ctx.createLinearGradient(0,Hc*0.6,0,Hc);
  g.addColorStop(0,"rgba(60,80,160,.15)"); g.addColorStop(1,"rgba(20,30,80,.35)");
  ctx.fillStyle=g; ctx.fillRect(0,Hc*0.62,W,Hc*0.4);

  // маленькие нубы
  for(const s of sprites){
    s.x+=s.vx*dt; s.ph+=dt*3;
    if(s.x<8){s.x=8;s.vx*=-1;} if(s.x>W-8){s.x=W-8;s.vx*=-1;}
    const bob=Math.sin(s.ph)*2;
    ctx.font=s.sz+"px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.globalAlpha=0.9; ctx.fillText(s.icon, s.x, s.y+bob); ctx.globalAlpha=1;
  }
  heroPulse+=dt*2; if(heroClick>0) heroClick=Math.max(0,heroClick-dt*4);
  drawHero();

  // частицы
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i];
    p.life-=dt*1.6; if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=200*dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.c;
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,6.29); ctx.fill(); ctx.globalAlpha=1;
  }
  // всплывающий текст
  for(let i=floats.length-1;i>=0;i--){ const f=floats[i];
    f.life-=dt*0.7; if(f.life<=0){floats.splice(i,1);continue;}
    f.y+=f.vy*dt; f.x+=f.vx*dt; f.vy*=0.98;
    ctx.globalAlpha=Math.max(0,f.life);
    ctx.font=(f.crit?"800 20px":"700 15px")+" -apple-system,sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle=f.crit?"#ff5d6c":"#ffd23f";
    ctx.fillText((f.crit?"КРИТ ":"")+f.txt, f.x, f.y);
    ctx.globalAlpha=1;
  }
}

/* сцена: тап */
cv.addEventListener("pointerdown", e=>{
  const r=cv.getBoundingClientRect();
  const x=e.clientX-r.left, y=e.clientY-r.top;
  heroClick=1;
  doClick(x,y);
});

/* ============ Игровой цикл ============ */
let last=performance.now(), acc=0;
function loop(now){
  let dt=(now-last)/1000; last=now; if(dt>0.25) dt=0.25;
  const sp=(save.admin&&save.admin.speed)||1; const edt=dt*sp; // ускорение времени (админ)
  // экономика
  if(D.ops) gainOof(D.ops*edt);
  // авто-клик
  if(D.autoClick>0){ save._acc=(save._acc||0)+D.autoClick*edt;
    while(save._acc>=1){ save._acc--; const a=D.clickBase; gainOof(a); save.lifetimeClicks++; }
  }
  // энергия рун
  const emax=D.slots+2;
  if(save.energy<emax){ save.energy=Math.min(emax, save.energy + edt/(60/D.runeRegen)); }
  // авто-покупка нубов
  if(D.autoBuy){ autoBuyTick(); }

  render(dt);

  // периодические обновления UI (не каждый кадр)
  uiAcc+=dt;
  if(uiAcc>0.12){ uiAcc=0; refreshTop(); refreshLive(); }
  saveTimer-=dt; if(saveTimer<0 && saveTimer>-1){ saveTimer=-2; persist(); }
  save.lastTime=Date.now();
  requestAnimationFrame(loop);
}
let uiAcc=0;
let abTimer=0;
function autoBuyTick(){
  abTimer++; if(abTimer<20) return; abTimer=0;
  // покупаем самого дорогого доступного нуба
  for(let i=NOOBS.length-1;i>=0;i--){ const nb=NOOBS[i];
    const owned=save.noobs[nb.id]||0; if(owned===0 && nb.base>save.oof) continue;
    const cost=noobCost(nb.id,owned);
    if(save.oof>=cost && save.oof-cost > cost*0.5){ save.oof-=cost; save.noobs[nb.id]=owned+1;
      recompute(); syncNoobSprites(); return; }
  }
}

/* ============ РЕНДЕР UI ============ */
const $=id=>document.getElementById(id);
function refreshTop(){
  $("oofVal").textContent=fmt(save.oof);
  $("opsVal").textContent=fmt(D.ops||0);
  $("prismVal").textContent=fmt(save.prisms);
  if(save.stars>0 || save.ascends>0){ $("starRes").classList.remove("hidden"); $("starVal").textContent=fmt(save.stars); }
  // бейджи «доступно»
  updateBadges();
}
function updateBadges(){
  let ups=0;
  for(const u of UPS){ if(!save.ups[u.id] && u.req() && save.oof>=u.cost) ups++; }
  const ub=$("upBadge"); if(ups){ ub.classList.remove("hidden"); ub.textContent=ups>9?"9+":ups; } else ub.classList.add("hidden");
  const canP = prismGain(save.totalOof)>=1;
  $("prBadge").classList.toggle("hidden", !canP);
}
// «живые» части открытой вкладки (цены/доступность)
function refreshLive(){
  if(curTab==="noobs") updateNoobLive();
  else if(curTab==="ups") updateUpLive();
  else if(curTab==="prestige") updatePrestigeLive();
  else if(curTab==="runes") updateRuneLive();
}

/* ---- Нубы ---- */
function renderNoobs(){
  const box=$("noobList"); box.innerHTML="";
  let anyUnlocked=false;
  NOOBS.forEach((nb,i)=>{
    const owned=save.noobs[nb.id]||0;
    const prevOwned = i===0?1:(save.noobs[NOOBS[i-1].id]||0);
    const unlocked = owned>0 || i===0 || prevOwned>0 || save.lifetimeOof>=nb.base*0.4;
    if(!unlocked && !anyUnlocked && i>0 && prevOwned===0) { /* показать один заблокированный */ }
    if(!unlocked && i>0 && (save.noobs[NOOBS[i-1].id]||0)===0 && save.lifetimeOof<nb.base*0.15) return;
    anyUnlocked=true;
    const row=document.createElement("div");
    row.className="buyrow"; row.dataset.noob=nb.id;
    row.innerHTML=
      `<div class="buy-ico">${nb.icon}</div>
       <div class="buy-main">
         <div class="buy-name">${nb.name} <span class="buy-cnt" data-cnt>${owned}</span></div>
         <div class="buy-desc" data-prod></div>
       </div>
       <div class="buy-right"><div class="buy-cost" data-cost></div><div class="buy-prod">+${fmt(nb.prod)} Oof/с</div></div>`;
    row.addEventListener("click", ()=>buyNoob(nb.id));
    let pt; row.addEventListener("pointerdown", ()=>{ pt=setTimeout(()=>buyMax(nb.id),500); });
    row.addEventListener("pointerup", ()=>clearTimeout(pt));
    row.addEventListener("pointerleave", ()=>clearTimeout(pt));
    box.appendChild(row);
  });
  updateNoobLive();
}
function updateNoobLive(){
  recompute();
  document.querySelectorAll("#noobList .buyrow").forEach(row=>{
    const id=row.dataset.noob; const owned=save.noobs[id]||0;
    const cost=noobCost(id,owned);
    const afford=save.oof>=cost;
    row.classList.toggle("afford",afford); row.classList.toggle("locked",!afford&&owned===0);
    row.querySelector("[data-cnt]").textContent=owned;
    const cur=owned*NOOB[id].prod*(D.noobMul[id]||1)*D.global;
    row.querySelector("[data-prod]").textContent = owned>0? ("даёт "+fmt(cur)+" Oof/с") : NOOB[id].name+" делает Oof сам";
    const ce=row.querySelector("[data-cost]"); ce.textContent="🪙 "+fmt(cost);
    ce.classList.toggle("cant",!afford);
  });
}

/* ---- Улучшения ---- */
function renderUps(){
  const box=$("upList"); box.innerHTML="";
  const avail=UPS.filter(u=>!save.ups[u.id] && u.req());
  avail.sort((a,b)=>a.cost-b.cost);
  $("upEmpty").classList.toggle("hidden", avail.length>0);
  $("upCount").textContent=avail.length+" доступно";
  avail.slice(0,60).forEach(u=>{
    const c=document.createElement("div"); c.className="upcard"; c.dataset.up=u.id;
    c.innerHTML=`<div class="u-ico">${u.icon}</div><div class="u-name">${u.name}</div>
      <div class="u-desc">${u.desc}</div><div class="u-cost" data-cost>🪙 ${fmt(u.cost)}</div>`;
    c.addEventListener("click", ()=>buyUp(u.id));
    box.appendChild(c);
  });
  updateUpLive();
}
function updateUpLive(){
  document.querySelectorAll("#upList .upcard").forEach(c=>{
    const u=UP[c.dataset.up]; if(!u) return;
    const afford=save.oof>=u.cost;
    c.classList.toggle("afford",afford);
    c.querySelector("[data-cost]").classList.toggle("cant",!afford);
  });
}

/* ---- Руны ---- */
function renderRunes(){
  $("slotInfo").textContent="("+save.runes.filter(Boolean).length+"/"+D.slots+")";
  $("dustVal").textContent=fmt(save.dust);
  const box=$("runeSlots"); box.innerHTML="";
  for(let i=0;i<D.slots;i++){
    const r=save.runes[i];
    const el=document.createElement("div");
    if(!r){ el.className="rune empty"; el.innerHTML=`<div class="r-ico">➕</div><div class="r-name">пусто</div>`;
      box.appendChild(el); continue; }
    const t=RTYPE[r.type], rar=RARITIES[r.rar], val=runeValue(r), cost=runeUpCost(r);
    el.className="rune filled "+rar.cls;
    el.innerHTML=`<div class="r-ico">${t.icon}</div>
      <div class="r-name">${rar.name}</div>
      <div class="r-eff">${t.fmt(val)}</div>
      <div class="r-lvl">ур.${r.lvl}</div>
      <button class="r-up" data-i="${i}">💠 ${fmt(cost)}</button>`;
    el.querySelector(".r-up").addEventListener("click", e=>{ e.stopPropagation(); upRune(i); });
    box.appendChild(el);
  }
  updateRuneLive();
}
function updateRuneLive(){
  const emax=D.slots+2;
  $("energyVal").textContent=Math.floor(save.energy);
  $("energyMax").textContent=emax;
  $("energyFill").style.width=Math.min(100,save.energy/emax*100)+"%";
  $("rollBtn").disabled = save.energy<1;
}

/* руна-дроп модалка */
let pendingRune=null;
function showDrop(r){
  pendingRune=r;
  const t=RTYPE[r.type], rar=RARITIES[r.rar], val=runeValue(r);
  const card=$("dropCard"); card.className="rune-drop "+rar.cls;
  card.innerHTML=`<div class="d-ico">${t.icon}</div><div class="d-rar">${rar.name}</div>
    <div class="d-name">${t.name}</div><div class="d-eff">${t.fmt(val)}</div>`;
  $("slotPick").classList.add("hidden");
  $("runeModal").classList.remove("hidden");
  updateRuneLive();
}
function closeDrop(){ $("runeModal").classList.add("hidden"); pendingRune=null; }
$("equipBtn").addEventListener("click", ()=>{
  if(!pendingRune) return;
  const empty=[]; for(let i=0;i<D.slots;i++) if(!save.runes[i]) empty.push(i);
  if(empty.length){ equipRune(pendingRune, empty[0]); closeDrop(); return; }
  // выбор слота на замену
  const pick=$("slotPick"); pick.innerHTML=""; pick.classList.remove("hidden");
  for(let i=0;i<D.slots;i++){ const r=save.runes[i], t=RTYPE[r.type];
    const b=document.createElement("div"); b.className="sp";
    b.innerHTML=`<b>${t.icon}</b>${RARITIES[r.rar].name}<br>ур.${r.lvl}`;
    b.addEventListener("click", ()=>{ equipRune(pendingRune,i); closeDrop(); });
    pick.appendChild(b);
  }
});
$("scrapBtn").addEventListener("click", ()=>{ if(pendingRune){ scrapRune(pendingRune); closeDrop(); } });

/* ---- Престиж ---- */
function renderPrestige(){
  // призма
  const g=prismGain(save.totalOof);
  $("prismGain").textContent=fmt(g);
  pbox_render();
  // вознесение
  const canAsc = save.prisms>=500 || save.ascends>0 || save.stars>0;
  $("ascendWrap").classList.toggle("hidden", !canAsc);
  if(canAsc){
    $("starGain").textContent=fmt(starGain(save.prisms));
    $("starNote").textContent = save.prisms<500? ("Нужно 500 призм (есть "+fmt(save.prisms)+")") : "Сбрасывает призмы и призматические улучшения";
    const sbox=$("starUpList"); sbox.innerHTML="";
    STAR_UPS.forEach(s=>{
      const l=save.starUps[s.id]||0, maxed=l>=s.max, cost=s.cost(l);
      const row=document.createElement("div"); row.className="buyrow"; row.dataset.starup=s.id;
      row.innerHTML=upRowHTML(s.icon,s.name,s.desc(l),l,s.max,maxed?"МАКС":"⭐ "+fmt(cost),"star");
      if(!maxed) row.addEventListener("click", ()=>buyStarUp(s.id));
      sbox.appendChild(row);
    });
  }
  updatePrestigeLive();
}
function pbox_render(){
  const pbox=$("prismUpList"); pbox.innerHTML="";
  PRISM_UPS.forEach(p=>{
    const l=save.prismUps[p.id]||0, maxed=l>=p.max, cost=p.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.prismup=p.id;
    row.innerHTML=upRowHTML(p.icon,p.name+" "+(l>0?"("+l+(p.max<50?"/"+p.max:"")+")":""),p.desc(l),l,p.max,maxed?"МАКС":"💎 "+fmt(cost),"prism");
    if(!maxed) row.addEventListener("click", ()=>buyPrismUp(p.id));
    pbox.appendChild(row);
  });
}
function upRowHTML(icon,name,desc,lvl,max,costTxt,cur){
  return `<div class="buy-ico">${icon}</div>
    <div class="buy-main"><div class="buy-name">${name}</div><div class="buy-desc">${desc}</div></div>
    <div class="buy-right"><div class="buy-cost ${cur}" data-cost>${costTxt}</div></div>`;
}
function updatePrestigeLive(){
  const g=prismGain(save.totalOof);
  $("prismGain").textContent=fmt(g);
  $("prestigeBtn").disabled = g<1;
  const need=1e6;
  const prog=Math.min(100, Math.pow(save.totalOof/need,0.5)*100/1); // грубый прогресс к 1-й призме
  $("prismProg").style.width=Math.min(100, save.totalOof<need? save.totalOof/need*100 : 100)+"%";
  $("prismNote").textContent = g<1? ("До первой призмы: "+fmt(Math.max(0,need-save.totalOof))+" Oof") : ("Готов сбросить за "+fmt(g)+" 💎");
  // цены доступность
  document.querySelectorAll("#prismUpList .buyrow").forEach(row=>{
    const p=PRISM_UP[row.dataset.prismup]; const l=save.prismUps[p.id]||0;
    if(l>=p.max) return; const cost=p.cost(l);
    row.classList.toggle("afford",save.prisms>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.prisms<cost);
  });
  document.querySelectorAll("#starUpList .buyrow").forEach(row=>{
    const s=STAR_UP[row.dataset.starup]; const l=save.starUps[s.id]||0;
    if(l>=s.max) return; const cost=s.cost(l);
    row.classList.toggle("afford",save.stars>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.stars<cost);
  });
  const g2=starGain(save.prisms); const ab=$("ascendBtn"); if(ab) ab.disabled=g2<1;
}

/* ============ Вкладки/навигация ============ */
let curTab="noobs";
function switchTab(t){
  curTab=t;
  document.querySelectorAll("#tabbar .tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  document.querySelectorAll(".tabpage").forEach(p=>p.classList.toggle("hidden",p.dataset.page!==t));
  if(t==="noobs") renderNoobs();
  else if(t==="ups") renderUps();
  else if(t==="runes") renderRunes();
  else if(t==="prestige") renderPrestige();
}
document.querySelectorAll("#tabbar .tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));

function renderAll(){ renderNoobs(); if(curTab==="ups")renderUps(); if(curTab==="runes")renderRunes(); if(curTab==="prestige")renderPrestige(); }

/* ============ Тосты/подсказка ============ */
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  $("toast").appendChild(t); setTimeout(()=>t.remove(),2200);
}
let hintHidden=false;
function hideHint(){ if(!hintHidden){ hintHidden=true; const h=$("tapHint"); h.style.opacity=0; } }

/* ============ Кнопки меню ============ */
$("menuBtn").addEventListener("click", ()=>{
  $("mStatLife").textContent=fmt(save.lifetimeOof);
  $("mStatPrest").textContent=fmt(save.prestiges);
  let tot=0; for(const nb of NOOBS) tot+=(save.noobs[nb.id]||0);
  $("mStatNoobs").textContent=fmt(tot);
  $("menuModal").classList.remove("hidden");
});
$("closeMenu").addEventListener("click", ()=>$("menuModal").classList.add("hidden"));
$("howBtn2").addEventListener("click", ()=>{ $("menuModal").classList.add("hidden"); $("howModal").classList.remove("hidden"); });
$("howClose2").addEventListener("click", ()=>$("howModal").classList.add("hidden"));
$("prestigeBtn").addEventListener("click", doPrestige);
$("ascendBtn").addEventListener("click", ()=>{ if(confirm("Вознестись? Призмы и призматические улучшения сбросятся ради звёзд.")) doAscend(); });
$("rollBtn").addEventListener("click", rollRune);
$("wipeBtn").addEventListener("click", ()=>{
  if(confirm("Стереть весь прогресс безвозвратно?")){ localStorage.removeItem(SAVE_KEY); location.reload(); }
});
// закрытие модалок по фону
["menuModal","howModal","runeModal"].forEach(id=>{
  $(id).addEventListener("click", e=>{ if(e.target.id===id){ if(id==="runeModal") return; $(id).classList.add("hidden"); } });
});

/* ============ АДМИН-ПАНЕЛЬ ============ */
function parseAmt(s){
  s=(s||"").toString().trim().replace(/\s|,/g,"").replace("×","");
  if(!s) return NaN;
  const v=Number(s); return isFinite(v)? v : NaN;
}
function setOof(v){ save.oof=v; save.totalOof=Math.max(save.totalOof,v); save.lifetimeOof=Math.max(save.lifetimeOof,v); }
function afterAdmin(){ recompute(); syncNoobSprites(); refreshTop(); renderAll(); queueSave(); }

const ADM_SLIDERS = [
  { key:"oofMul",  label:"Множитель Oof/с",   emin:0,  emax:9 },
  { key:"clickMul",label:"Множитель клика",   emin:0,  emax:9 },
  { key:"costMul", label:"Цена нубов",        emin:-3, emax:1 },
  { key:"prismMul",label:"Множитель призм",   emin:0,  emax:6 },
  { key:"speed",   label:"Скорость игры",     emin:0,  emax:3 },
];
function buildAdmin(){
  const b=$("adminBody"); b.innerHTML="";
  // --- множители (крутилки) ---
  const secM=admSect("🎚️ Множители");
  ADM_SLIDERS.forEach(s=>{
    const cur=(save.admin[s.key]||1);
    const wrap=document.createElement("div"); wrap.className="adm-slider";
    wrap.innerHTML=`<div class="sl-top"><span>${s.label}</span>
      <span><span class="sl-val" data-v>×${fmt(cur)}</span> <button class="sl-reset" data-r>сброс</button></span></div>
      <input type="range" min="${s.emin*100}" max="${s.emax*100}" step="1" value="${Math.round(Math.log10(cur)*100)}">`;
    const inp=wrap.querySelector("input"), lab=wrap.querySelector("[data-v]");
    inp.addEventListener("input", ()=>{ const val=Math.pow(10, inp.value/100);
      save.admin[s.key]=val; lab.textContent="×"+fmt(val); recompute(); refreshTop(); queueSave(); });
    wrap.querySelector("[data-r]").addEventListener("click", ()=>{ save.admin[s.key]=1;
      inp.value=0; lab.textContent="×1"; recompute(); refreshTop(); queueSave(); });
    secM.appendChild(wrap);
  });
  b.appendChild(secM);

  // --- ресурсы ---
  const secR=admSect("💰 Ресурсы");
  secR.appendChild(admResRow("Oof", "oof", ["1e6","1e9","1e12","1e18"], "MAX"));
  secR.appendChild(admResRow("Призмы", "prisms", ["10","1000","1e6","1e9"]));
  secR.appendChild(admResRow("Звёзды", "stars", ["10","100","1000"]));
  secR.appendChild(admResRow("Пыль рун", "dust", ["100","1e4","1e6"]));
  const en=document.createElement("div"); en.className="adm-row";
  en.innerHTML=`<label>Энергия рун</label>`;
  en.appendChild(admBtn("Полная", ()=>{ recompute(); save.energy=D.slots+2; updateRuneLive(); toast("⚡ Энергия полна"); }));
  secR.appendChild(en);
  b.appendChild(secR);

  // --- нубы ---
  const secN=admSect("🧍 Нубы");
  const nrow=document.createElement("div"); nrow.className="adm-row";
  nrow.innerHTML=`<label>Всем по</label><input class="adm-inp" id="admNoobN" placeholder="напр. 500">`;
  nrow.appendChild(admBtn("Задать", ()=>{ const n=Math.max(0,Math.floor(parseAmt($("admNoobN").value)));
    if(!isFinite(n)) return; NOOBS.forEach(nb=>save.noobs[nb.id]=n); afterAdmin(); toast("Всем нубам: "+n); }));
  secN.appendChild(nrow);
  const nchips=document.createElement("div"); nchips.className="adm-chips";
  [10,100,1000].forEach(n=>nchips.appendChild(admBtn("+"+n+" всем", ()=>{ NOOBS.forEach(nb=>save.noobs[nb.id]=(save.noobs[nb.id]||0)+n); afterAdmin(); })));
  nchips.appendChild(admBtn("Обнулить", ()=>{ save.noobs={}; afterAdmin(); }, "dng"));
  secN.appendChild(nchips);
  b.appendChild(secN);

  // --- улучшения ---
  const secU=admSect("⚡ Улучшения");
  const urow=document.createElement("div"); urow.className="adm-chips";
  urow.appendChild(admBtn("Открыть все ("+UPS.length+")", ()=>{ UPS.forEach(u=>save.ups[u.id]=true); recompute(); if(curTab==="ups")renderUps(); refreshTop(); queueSave(); toast("Все улучшения открыты"); }, "pri"));
  urow.appendChild(admBtn("Сбросить все", ()=>{ save.ups={}; recompute(); if(curTab==="ups")renderUps(); refreshTop(); queueSave(); }, "dng"));
  secU.appendChild(urow);
  b.appendChild(secU);

  // --- руны ---
  const secRu=admSect("🔮 Руны");
  const rr=document.createElement("div"); rr.className="adm-row";
  rr.innerHTML=`<select class="adm-inp" id="admRar">${RARITIES.map((r,i)=>`<option value="${i}">${r.name}</option>`).join("")}</select>
    <select class="adm-inp" id="admType">${RUNE_TYPES.map(t=>`<option value="${t.id}">${t.icon} ${t.name}</option>`).join("")}</select>`;
  secRu.appendChild(rr);
  const rr2=document.createElement("div"); rr2.className="adm-row";
  rr2.innerHTML=`<label>Уровень</label><input class="adm-inp" id="admRlvl" value="10">`;
  rr2.appendChild(admBtn("Выдать", ()=>{
    const rar=+$("admRar").value, type=$("admType").value, lvl=Math.max(1,Math.floor(parseAmt($("admRlvl").value))||1);
    recompute(); let slot=-1; for(let i=0;i<D.slots;i++) if(!save.runes[i]){slot=i;break;} if(slot<0) slot=0;
    save.runes[slot]={type,rar,lvl}; afterAdmin(); if(curTab==="runes")renderRunes(); toast("Руна выдана"); }, "pri"));
  secRu.appendChild(rr2);
  const rchips=document.createElement("div"); rchips.className="adm-chips";
  rchips.appendChild(admBtn("Все слоты — мифич.", ()=>{ recompute();
    for(let i=0;i<D.slots;i++){ save.runes[i]={type:RUNE_TYPES[i%RUNE_TYPES.length].id, rar:5, lvl:15}; }
    afterAdmin(); if(curTab==="runes")renderRunes(); toast("Слоты забиты мифическими"); }, "pri"));
  rchips.appendChild(admBtn("Очистить слоты", ()=>{ save.runes=[]; afterAdmin(); if(curTab==="runes")renderRunes(); }, "dng"));
  secRu.appendChild(rchips);
  b.appendChild(secRu);

  // --- прочее ---
  const secO=admSect("🎯 Прочее");
  const orow=document.createElement("div"); orow.className="adm-chips";
  orow.appendChild(admBtn("Мгновенный престиж", ()=>{ if(save.totalOof<1e6) save.totalOof=1e6; doPrestige(); }, "pri"));
  orow.appendChild(admBtn("Мгновенное вознесение", ()=>{ if(save.prisms<500) save.prisms=500; recompute(); doAscend(); }, "pri"));
  secO.appendChild(orow);
  const orow2=document.createElement("div"); orow2.className="adm-chips";
  orow2.appendChild(admBtn("🗑 Полный сброс игры", ()=>{ if(confirm("Стереть весь прогресс безвозвратно?")){ localStorage.removeItem(SAVE_KEY); location.reload(); } }, "dng"));
  secO.appendChild(orow2);
  b.appendChild(secO);
}
function admSect(title){
  const s=document.createElement("div"); s.className="adm-sect";
  s.innerHTML=`<div class="sect-lab">${title}</div>`; return s;
}
function admBtn(txt, fn, cls){
  const btn=document.createElement("button"); btn.className="adm-btn"+(cls?" "+cls:""); btn.textContent=txt;
  btn.addEventListener("click", fn); return btn;
}
function admResRow(label, key, chips, extra){
  const row=document.createElement("div"); row.className="adm-row";
  row.innerHTML=`<label>${label}</label><input class="adm-inp" placeholder="напр. 1e12">`;
  const inp=row.querySelector("input");
  row.appendChild(admBtn("Задать", ()=>{ const v=parseAmt(inp.value); if(!isFinite(v)) return;
    if(key==="oof") setOof(v); else save[key]=v; afterAdmin(); toast(label+" = "+fmt(v)); }));
  const chipWrap=document.createElement("div"); chipWrap.className="adm-chips"; chipWrap.style.width="100%";
  chips.forEach(c=>{ const amt=parseAmt(c);
    chipWrap.appendChild(admBtn("+"+fmt(amt), ()=>{ if(key==="oof") setOof(save.oof+amt); else save[key]=(save[key]||0)+amt; afterAdmin(); })); });
  if(extra==="MAX") chipWrap.appendChild(admBtn("MAX", ()=>{ setOof(1e300); afterAdmin(); toast("Oof = MAX"); }, "pri"));
  row.appendChild(chipWrap);
  return row;
}
function openAdmin(){ buildAdmin(); $("adminModal").classList.remove("hidden"); }
$("adminBtn").addEventListener("click", ()=>{ $("menuModal").classList.add("hidden"); openAdmin(); });
$("adminClose").addEventListener("click", ()=>$("adminModal").classList.add("hidden"));
$("adminModal").addEventListener("click", e=>{ if(e.target.id==="adminModal") $("adminModal").classList.add("hidden"); });

/* ============ Старт ============ */
function init(){
  load();
  resize();
  applyOffline();
  recompute();
  syncNoobSprites();
  switchTab("noobs");
  refreshTop();
  // подсказка исчезает сама
  setTimeout(()=>{ if(!hintHidden){ $("tapHint").style.opacity=.0; } }, 6000);
  last=performance.now();
  requestAnimationFrame(loop);
  // сохранение при уходе
  document.addEventListener("visibilitychange", ()=>{ if(document.hidden){ save.lastTime=Date.now(); persist(); } });
  window.addEventListener("pagehide", persist);
  // SW
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
}
init();
