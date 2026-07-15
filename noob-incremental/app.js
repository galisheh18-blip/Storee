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

/* ---- Углубление нубов: вехи владения (B), синергии (A), ранги (C) ---- */
// Вехи — бесплатные бонусы за количество владения (дополняют покупные ×2)
const NOOB_MILESTONES = [
  { at:25,   type:"all",     val:0.01 },
  { at:50,   type:"crit",    val:0.01 },
  { at:100,  type:"synergy" },
  { at:150,  type:"click",   val:1.25 },
  { at:250,  type:"all",     val:0.03 },
  { at:400,  type:"crit",    val:0.02 },
  { at:600,  type:"all",     val:0.05 },
  { at:1000, type:"click",   val:1.5 },
];
const SYN_AT = 100;      // веха, открывающая синергию
const SYN_PCT = 0.003;   // +0.3% нижнему виду за каждый вышестоящий
const MAX_RANK = 10;
function rankMult(r){ return 1 + r; }                       // ★r → ×(1+r) к этому нубу
function rankReq(r){ return Math.floor(50*Math.pow(2.6,r)); } // нужно во владении, чтобы взять ранг r→r+1
function rankCost(nb,r){ return nb.base * 120 * Math.pow(12,r); } // цена в Oof
function msLabel(ms, loName){
  if(ms.type==="self")    return "×"+ms.val+" этому нубу";
  if(ms.type==="all")     return "+"+Math.round(ms.val*100)+"% всем нубам";
  if(ms.type==="crit")    return "+"+Math.round(ms.val*100)+"% крит";
  if(ms.type==="click")   return "×"+ms.val+" к тапу";
  if(ms.type==="synergy") return "синергия → бустит «"+(loName||"ниже")+"»";
  return "";
}

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

/* ===== Углубление улучшений: категории(C/D), бесконечные(B), синергии(F), качество(I) ===== */
// C+D — категории обычных улучшений + бонус за полное завершение
const UP_CATS = [
  { id:"click",  name:"👆 Клик",   kinds:["click","clickps"], bonusText:"+50% к тапу",  apply:m=>m.click*=1.5 },
  { id:"noob",   name:"🧍 Нубы",   kinds:["noob"],            bonusText:"+50% всего",   apply:m=>m.global*=1.5 },
  { id:"global", name:"🌍 Глобал", kinds:["global"],          bonusText:"+50% всего",   apply:m=>m.global*=1.5 },
  { id:"crit",   name:"💥 Крит",   kinds:["crit","critp"],    bonusText:"+10% крит, +100% крит-урон", apply:m=>{m.crit+=0.1;m.critPow+=1;} },
];
const upCatOf = {}; UP_CATS.forEach(c=>c.kinds.forEach(k=>upCatOf[k]=c.id));
function catUps(catId){ return UPS.filter(u=>UP_CATS.find(c=>c.id===catId).kinds.includes(u.kind)); }
function catComplete(catId){ return catUps(catId).every(u=>save.ups[u.id]); }

// B — бесконечные (повторяемые) улучшения
const INF_UPS = [
  { id:"core", icon:"🔆", name:"Ядро силы",    base:1e4, mul:1.6,  per:0.10, kind:"global", apply:(m,l,q)=>m.global*=(1+0.10*l*q) },
  { id:"fist", icon:"👊", name:"Вечный кулак",  base:5e3, mul:1.55, per:0.15, kind:"click",  apply:(m,l,q)=>m.click*=(1+0.15*l*q) },
  { id:"crun", icon:"💥", name:"Ядро крита",    base:2e4, mul:1.7,  per:0.005,kind:"crit",   apply:(m,l,q)=>m.crit+=0.005*l*q },
  { id:"mega", icon:"🌟", name:"Мультиядро",    base:1e6, mul:1.8,  per:0.50, kind:"global", apply:(m,l,q)=>m.global*=(1+0.50*l*q) },
];
const INF_UP = Object.fromEntries(INF_UPS.map(u=>[u.id,u]));
function infCost(u,l){ return u.base*Math.pow(u.mul,l); }
function infQ(id){ return save.infQuality[id]||1; }
function infRerollCost(id){ return Math.ceil(50*Math.pow(1.5,(save.infUps[id]||0))); } // в пыли

// F — синергийные улучшения (одноразовая покупка, живое значение)
const SYN_UPS = [
  { id:"unity",  icon:"🤝", name:"Единство",       cost:1e5,
    val:()=>{ let t=0; for(const nb of NOOBS) if((save.noobs[nb.id]||0)>0)t++; return t*0.03; },
    desc:()=>"+"+Math.round(synVal("unity")*100)+"% всего (за каждый вид нуба)", apply:(m,v)=>m.global*=(1+v) },
  { id:"veteran",icon:"🎖️", name:"Ветеран",        cost:1e7,
    val:()=>Math.min((save.prestiges||0)*0.02,10), desc:()=>"+"+Math.round(synVal("veteran")*100)+"% всего (за престиж, макс +1000%)", apply:(m,v)=>m.global*=(1+v) },
  { id:"depth",  icon:"⛏️", name:"Глубинная мощь",  cost:1e6,
    val:()=>(save.depth||0)*0.01, desc:()=>"+"+Math.round(synVal("depth")*100)+"% всего (за метр глубины)", apply:(m,v)=>m.global*=(1+v) },
  { id:"runic",  icon:"🔮", name:"Рунная синергия", cost:1e6,
    val:()=>save.runes.filter(Boolean).length*0.05, desc:()=>"+"+Math.round(synVal("runic")*100)+"% всего (за руну в слоте)", apply:(m,v)=>m.global*=(1+v) },
  { id:"rich",   icon:"💰", name:"Богатство",       cost:1e8,
    val:()=>Math.max(0,Math.log10(1+save.oof))*0.03, desc:()=>"+"+Math.round(synVal("rich")*100)+"% к тапу (за порядок Oof)", apply:(m,v)=>m.click*=(1+v) },
];
const SYN_UP = Object.fromEntries(SYN_UPS.map(s=>[s.id,s]));
function synVal(id){ return save.synUps[id] ? SYN_UP[id].val() : 0; }

// E — исследования (тех-древо с реальными таймерами)
const RESEARCH = [
  { id:"r1", icon:"🖐️", name:"Эргономика тапа",    time:60,   cost:5e4, req:[],          bonus:{click:0.5},  desc:"+50% к тапу" },
  { id:"r2", icon:"🏭", name:"Конвейер нубов",      time:180,  cost:5e5, req:["r1"],      bonus:{global:0.5}, desc:"+50% всего" },
  { id:"r3", icon:"💥", name:"Критический анализ",  time:300,  cost:5e6, req:["r1"],      bonus:{crit:0.05},  desc:"+5% крит" },
  { id:"r4", icon:"⚙️", name:"Массовое производство",time:600, cost:5e7, req:["r2"],      bonus:{global:1},   desc:"+100% всего" },
  { id:"r5", icon:"🔮", name:"Рунная теория",       time:600,  cost:5e7, req:["r2"],      bonus:{runePow:0.2},desc:"+20% эффект рун" },
  { id:"r6", icon:"🌌", name:"Сингулярность",       time:1800, cost:5e9, req:["r4","r5"], bonus:{global:3},   desc:"×4 всего" },
];
const RESEARCH_M = Object.fromEntries(RESEARCH.map(r=>[r.id,r]));
function researchDone(id){ return !!save.research.done[id]; }
function researchReqMet(r){ return r.req.every(id=>researchDone(id)); }
function applyResearch(b,m){ if(b.click)m.click*=(1+b.click); if(b.global)m.global*=(1+b.global); if(b.crit)m.crit+=b.crit; if(b.runePow)m._runePow+=b.runePow; }

// H — жетоны (вечная мета-валюта) + жетонное дерево
const TOKEN_UPS = [
  { id:"tglob", icon:"🎟️", name:"Жетон силы",  max:200, desc:l=>"Всё ×"+(1+0.25*l).toFixed(2),  cost:l=>l+1, apply:(m,l)=>m.global*=(1+0.25*l) },
  { id:"tclick",icon:"🎟️", name:"Жетон тапа",  max:200, desc:l=>"Тап ×"+(1+0.5*l).toFixed(1),   cost:l=>l+1, apply:(m,l)=>m.click*=(1+0.5*l) },
  { id:"tcrit", icon:"🎟️", name:"Жетон крита", max:50,  desc:l=>"+"+(l)+"% крит",               cost:l=>l+1, apply:(m,l)=>m.crit+=0.01*l },
  { id:"tprism",icon:"🎟️", name:"Жетон призм", max:100, desc:l=>"Призм +"+(l*20)+"%",            cost:l=>l+2, apply:(m,l)=>m.prism*=(1+0.2*l) },
];
const TOKEN_UP = Object.fromEntries(TOKEN_UPS.map(t=>[t.id,t]));

// G — ротационный магазин (обновляется по времени)
const SHOP_POOL = [
  { type:"global", label:"Вечный ×множитель Oof", roll:()=>({v:0.25+Math.random()*0.5}), cost:()=>0 },
  { type:"ore",    label:"Пачка руды",            roll:()=>({v:0}), cost:()=>0 },
  { type:"dust",   label:"Пачка пыли",            roll:()=>({v:0}), cost:()=>0 },
  { type:"prism",  label:"Немного призм",         roll:()=>({v:0}), cost:()=>0 },
];
const SHOP_REFRESH_MS = 12*60*1000;
function genShopOffer(){
  const t=SHOP_POOL[Math.floor(Math.random()*SHOP_POOL.length)];
  if(t.type==="global"){ const v=0.2+Math.random()*0.6; return { type:"global", v, cost:Math.max(1e4,(save.oof||0)*(0.3+Math.random()*0.4)), label:"Вечный +"+Math.round(v*100)+"% Oof/с" }; }
  if(t.type==="ore"){    const v=Math.max(100,(D.oreRate||1)*600); return { type:"ore", v, cost:Math.max(1e4,(save.oof||0)*0.15), label:"+"+fmt(v)+" руды" }; }
  if(t.type==="dust"){   const v=Math.ceil(30+Math.random()*80);  return { type:"dust", v, cost:Math.max(1e4,(save.oof||0)*0.15), label:"+"+fmt(v)+" пыли" }; }
  const v=Math.ceil(3+Math.random()*10); return { type:"prism", v, cost:Math.max(1e6,(save.oof||0)*0.6), label:"+"+fmt(v)+" призм" };
}
function refreshShop(force){
  const now=Date.now();
  if(!force && save.shop.offers.length && now<save.shop.next) return;
  save.shop.offers=[genShopOffer(),genShopOffer(),genShopOffer()];
  save.shop.next=now+SHOP_REFRESH_MS;
}

// ---- Руны ----
const RARITIES = [
  { name:"Обычная",    w:58, cls:"rar-0", mul:1 },
  { name:"Необычная",  w:26, cls:"rar-1", mul:1.7 },
  { name:"Редкая",     w:10, cls:"rar-2", mul:2.8 },
  { name:"Эпическая",  w:4.4,cls:"rar-3", mul:4.6 },
  { name:"Легендарная",w:1.3,cls:"rar-4", mul:8 },
  { name:"Мифическая", w:0.3,cls:"rar-5", mul:15 },
  { name:"Древняя",    w:0.06,cls:"rar-6", mul:28 },
  { name:"Первородная",w:0.012,cls:"rar-7", mul:55 },
  { name:"Небесная",   w:0.002,cls:"rar-8", mul:110 },
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
// пыльцевые улучшения — тратишь пыль рун на основную характеристику
const DUST_UPS = [
  { id:"dpow",  icon:"💠", name:"Пыльца силы", max:100, desc:l=>"Oof/с +"+(l*5)+"%",
    cost:l=>Math.ceil(20*Math.pow(1.4,l)), apply:(m,l)=>m.global*=(1+l*0.05) },
  { id:"dtap",  icon:"✨", name:"Пыльца тапа", max:100, desc:l=>"Тап +"+(l*8)+"%",
    cost:l=>Math.ceil(15*Math.pow(1.4,l)), apply:(m,l)=>m.click*=(1+l*0.08) },
  { id:"drune", icon:"🌟", name:"Пыльца резонанса", max:50, desc:l=>"Эффект рун +"+(l*4)+"%",
    cost:l=>Math.ceil(30*Math.pow(1.5,l)), apply:(m,l)=>m._runePow+=l*0.04 },
];
const DUST_UP = Object.fromEntries(DUST_UPS.map(d=>[d.id,d]));

// ---- Автоматизация (открывается по прогрессу, включается/выключается) ----
const AUTOS = [
  { id:"click",    icon:"🤖", name:"Автокликер",           unlock:()=>((save.prismUps||{}).autoc||0)>0, hint:"Куплен в призмах" },
  { id:"noobs",    icon:"🧍", name:"Автопокупка нубов",     unlock:()=>((save.prismUps||{}).autob||0)>0, hint:"Куплена в призмах" },
  { id:"ups",      icon:"⚡", name:"Автопокупка улучшений", unlock:()=>save.prestiges>=3, hint:"С 3 престижей" },
  { id:"mining",   icon:"⛏️", name:"Автошахта",            unlock:()=>((save.miningUps||{}).auto||0)>0, hint:"Автошахтёр в шахте" },
  { id:"workshop", icon:"⚙️", name:"Автомастерская",       unlock:()=>save.prestiges>=5||save.transcends>0, hint:"С 5 престижей" },
  { id:"potions",  icon:"⚗️", name:"Автоварка зелий",      unlock:()=>save.transcends>0, hint:"С 1 трансценденции" },
];
function runeValue(r){ // сила руны: тип × редкость × уровень × звёзды
  const t=RTYPE[r.type], rar=RARITIES[r.rar];
  return t.base * rar.mul * (1 + 0.25*(r.lvl-1)) * (1 + 0.3*(r.star||0));
}
function runeUpCost(r){ return Math.ceil(6 * Math.pow(1.8, r.lvl-1) * RARITIES[r.rar].mul); }
const RUNE_MAX_STAR=5;
// B — сабстаты: доп-эффекты руны (зависит от редкости)
function genSubs(rar){
  const n = rar>=5?3 : rar>=3?2 : rar>=1?1 : 0;
  const subs=[];
  for(let i=0;i<n;i++){ const t=RUNE_TYPES[Math.floor(Math.random()*RUNE_TYPES.length)];
    subs.push({ t:t.id, v: t.base*RARITIES[rar].mul*(0.12+Math.random()*0.18) }); }
  return subs;
}
function rerollSubCost(r){ return Math.ceil(15*RARITIES[r.rar].mul); }
function rerollTypeCost(r){ return Math.ceil(40*RARITIES[r.rar].mul); }
// E — мастерство типов
function masteryLevel(type){ return Math.floor(Math.sqrt((save.runeMastery[type]||0)/8)); }
function masteryMul(type){ return 1 + masteryLevel(type)*0.05; }
// C — сет-бонусы от состава слотов
function slotSets(){
  const runes=save.runes.filter(Boolean);
  const tc={}; runes.forEach(r=>tc[r.type]=(tc[r.type]||0)+1);
  const maxSame=runes.length?Math.max(...Object.values(tc)):0;
  const distinct=Object.keys(tc).length;
  const allEpic=runes.length>=3 && runes.every(r=>r.rar>=3);
  let mono=0; if(maxSame>=5)mono=1.5; else if(maxSame>=4)mono=0.8; else if(maxSame>=3)mono=0.4; else if(maxSame>=2)mono=0.15;
  const spectrum=distinct>=5?0.5:0;
  const league=allEpic?0.5:0;
  return { mono, spectrum, league, maxSame, distinct, allEpic, mult:(1+mono)*(1+spectrum)*(1+league) };
}

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
  // --- уникальные ---
  { id:"keepnoob",icon:"🧬", name:"Наследие нубов", max:10, desc:l=>l?("Оставляй "+(l*3)+"% нубов при престиже"):"Заблокировано",
    cost:l=>Math.ceil(10*Math.pow(1.7,l)), apply:()=>{} },
  { id:"critmass",icon:"💥", name:"Критическая масса", max:30, desc:l=>"+"+l+"% крит и крит-урон +"+(l*10)+"%",
    cost:l=>Math.ceil(6*Math.pow(1.4,l)), apply:(m,l)=>{ m.crit+=l*0.01; m.critPow+=l*0.1; } },
  { id:"megaclick",icon:"🤜", name:"Мощь толпы", max:50, desc:l=>"Тап +"+(l*2)+"% за каждый вид нуба",
    cost:l=>Math.ceil(8*Math.pow(1.45,l)), apply:(m,l)=>{ m._megaClick+=l*0.02; } },
  { id:"runepow", icon:"🔮", name:"Резонанс рун", max:40, desc:l=>"Эффект рун +"+(l*5)+"%",
    cost:l=>Math.ceil(7*Math.pow(1.5,l)), apply:(m,l)=>{ m._runePow+=l*0.05; } },
  { id:"runeluck",icon:"🍀", name:"Удача рун", max:50, desc:l=>"Шанс редких рун сильнее (+"+(l*6)+"%)",
    cost:l=>Math.ceil(6*Math.pow(1.4,l)), apply:(m,l)=>{ m._runeLuck+=l*0.06; } },
];
const PRISM_UP = Object.fromEntries(PRISM_UPS.map(p=>[p.id,p]));
function startOof(l){ return l<=0?0: 100*Math.pow(6,l); }

/* ---- Углубление престижа: вехи (B), реликвии (C), сила престижа (D) ---- */
// D — компаундинг-множитель от всех призм за всё время
function prestigePower(){ return 1 + Math.log10(1+(save.prismsEver||0))*0.2; }
// B — вехи за количество престижей (вечные)
const PRESTIGE_MS = [
  { at:1,    g:0.1 },
  { at:5,    p:0.25 },
  { at:10,   g:0.5 },
  { at:25,   g:0.25, slots:1 },
  { at:50,   g:1.0, p:0.25 },
  { at:100,  g:2.0 },
  { at:250,  g:2.0, p:0.5 },
  { at:500,  g:5.0 },
  { at:1000, g:10, slots:1 },
];
function prestigeMsText(ms){ const p=[]; if(ms.g)p.push("+"+Math.round(ms.g*100)+"% всего"); if(ms.p)p.push("+"+Math.round(ms.p*100)+"% призм"); if(ms.slots)p.push("+"+ms.slots+" слот рун"); return p.join(", "); }
// C — реликвии (лучшая по каждому типу, вечные, дропают за сброс)
const RELIC_TYPES = [
  { id:"gld",  icon:"🪙", name:"Реликвия богатства", base:0.15, fmt:v=>"+"+Math.round(v*100)+"% Oof/с",  apply:(m,v)=>m.global*=(1+v) },
  { id:"prg",  icon:"💎", name:"Реликвия призм",     base:0.12, fmt:v=>"+"+Math.round(v*100)+"% призм",   apply:(m,v)=>m.prism*=(1+v) },
  { id:"tap",  icon:"👆", name:"Реликвия силы",      base:0.2,  fmt:v=>"+"+Math.round(v*100)+"% тап",     apply:(m,v)=>m.click*=(1+v) },
  { id:"crt",  icon:"💥", name:"Реликвия крита",     base:0.05, fmt:v=>"+"+(v*100).toFixed(1)+"% крит",   apply:(m,v)=>m.crit+=v },
  { id:"ore",  icon:"🪨", name:"Реликвия недр",      base:0.2,  fmt:v=>"+"+Math.round(v*100)+"% добыча",  apply:(m,v)=>m._oreBoost+=v },
  { id:"luck", icon:"🍀", name:"Реликвия удачи",     base:0.15, fmt:v=>"+"+Math.round(v*100)+"% удача рун",apply:(m,v)=>m._runeLuck+=v },
  { id:"all",  icon:"🌌", name:"Реликвия вечности",  base:0.08, fmt:v=>"+"+Math.round(v*100)+"% валют престижа", apply:(m,v)=>{ m._allCur=(m._allCur||0)+v; } },
];
const RELIC_T = Object.fromEntries(RELIC_TYPES.map(r=>[r.id,r]));
function relicValue(tid, rar){ return RELIC_T[tid].base * RARITIES[rar].mul; }
function relicChance(){ return Math.min(0.25 + (save.prestiges||0)*0.002, 0.6); }

// A+F — ветки/доски призм-улучшений + гейтинг (пререквизиты)
const PRISM_BRANCH = { shine:"prod", click:"prod", pmul:"prod", critmass:"prod", megaclick:"prod",
  offline:"auto", autoc:"auto", autob:"auto",
  start:"comfort", disc:"comfort", keepnoob:"comfort",
  slots:"runes", fastr:"runes", runepow:"runes", runeluck:"runes" };
const PRISM_REQ = { autob:{id:"autoc",lvl:1}, offline:{id:"start",lvl:1}, megaclick:{id:"click",lvl:3},
  runepow:{id:"slots",lvl:1}, pmul:{id:"shine",lvl:5} };
const PRISM_BRANCHES = [["prod","🏭 Производство"],["auto","🤖 Автоматизация"],["comfort","🧭 Комфорт"],["runes","🔮 Руны"]];
function prismReqMet(id){ const rq=PRISM_REQ[id]; return !rq || (save.prismUps[rq.id]||0)>=rq.lvl; }

// G — цели забега (обнуляются с престижем): выполнил → +% к призмам за этот сброс
const RUN_GOALS = [
  { id:"g1", icon:"😵", text:"1e9 Oof за забег",   bonus:0.15, done:()=>save.totalOof>=1e9 },
  { id:"g2", icon:"🧍", text:"300 нубов",          bonus:0.15, done:()=>totalNoobs()>=300 },
  { id:"g3", icon:"⚡", text:"15 улучшений за забег",bonus:0.10, done:()=>Object.keys(save.ups).length>=15 },
  { id:"g4", icon:"🔥", text:"1e12 Oof за забег",   bonus:0.20, done:()=>save.totalOof>=1e12 },
];
function runGoalBonus(){ let b=0; for(const g of RUN_GOALS) if(g.done()) b+=g.bonus; return b; }

// I — призмы в других системах (кросс-улучшения за призмы)
const CROSS_UPS = [
  { id:"pbore", tab:"mining",   icon:"💎", name:"Призм-бур",      max:100, desc:l=>"Добыча ×"+(1+0.5*l).toFixed(1)+" · +"+(l*5)+"% Oof/с",
    cost:l=>Math.ceil(5*Math.pow(1.5,l)), apply:(m,l)=>{ m._oreBoost+=0.5*l; m.global*=(1+0.05*l); } },
  { id:"pgear", tab:"workshop", icon:"💎", name:"Призм-редуктор", max:100, desc:l=>"Всё ×"+(1+0.2*l).toFixed(1),
    cost:l=>Math.ceil(6*Math.pow(1.5,l)), apply:(m,l)=>m.global*=(1+0.2*l) },
];
const CROSS_UP = Object.fromEntries(CROSS_UPS.map(c=>[c.id,c]));

// ---- Звёздные улучшения (вознесение) ----
const STAR_UPS = [
  { id:"sshine", icon:"⭐", name:"Звёздный блеск", max:200, desc:l=>"Всё ×"+(1+0.3*l).toFixed(1),
    cost:l=>Math.ceil(1*Math.pow(1.45,l)), apply:(m,l)=>m.global*=(1+0.3*l) },
  { id:"skeep",  icon:"💎", name:"Хранитель призм", max:50, desc:l=>"Оставляй "+(l*2)+"% призм при вознесении",
    cost:l=>Math.ceil(2*Math.pow(1.5,l)), apply:()=>{} },
  { id:"spmul",  icon:"💫", name:"Звёздный поток", max:100, desc:l=>"Призм и Oof +"+(l*15)+"%",
    cost:l=>Math.ceil(2*Math.pow(1.45,l)), apply:(m,l)=>{ m.prism*=(1+l*0.15); m.global*=(1+l*0.15); } },
  // --- уникальные ---
  { id:"sauto",  icon:"🛸", name:"Звёздный автопилот", max:1, desc:l=>l?"Авто-престиж при выгодном сбросе":"Заблокировано",
    cost:()=>5, apply:(m,l)=>{ m.autoPrestige=l>0; } },
  { id:"srune",  icon:"🌌", name:"Вечные руны", max:5, desc:l=>"+"+l+" слот рун и эффект рун +"+(l*10)+"%",
    cost:l=>Math.ceil(3*Math.pow(1.8,l)), apply:(m,l)=>{ m._bonusSlots+=l; m._runePow+=l*0.1; } },
  { id:"scrit",  icon:"☄️", name:"Звёздный крит", max:50, desc:l=>"+"+(l*2)+"% крит и крит-урон +"+(l*20)+"%",
    cost:l=>Math.ceil(2*Math.pow(1.4,l)), apply:(m,l)=>{ m.crit+=l*0.02; m.critPow+=l*0.2; } },
];
const STAR_UP = Object.fromEntries(STAR_UPS.map(s=>[s.id,s]));

// ---- Мастерская: ⚙️ шестерёнки (фарм-валюта, усиливает уже вложенное) ----
const WORKSHOP_UPS = [
  { id:"wrate",  icon:"⏩", name:"Ускорение фарма", max:50, desc:l=>"Шестерёнок +"+(l*20)+"%/с",
    cost:l=>Math.ceil(8*Math.pow(1.4,l)) },
  { id:"wall",   icon:"⚙️", name:"Главный редуктор", max:200, desc:l=>"Всё ×"+(1+0.2*l).toFixed(1),
    cost:l=>Math.ceil(20*Math.pow(1.32,l)), apply:(m,l)=>{ m.global*=(1+0.2*l); } },
  { id:"wprism", icon:"💎", name:"Смазка призм", max:100, desc:l=>"Сила призм-улучшений +"+(l*2)+"% за их уровень",
    cost:l=>Math.ceil(12*Math.pow(1.4,l)), apply:(m,l,c)=>{ m.global*=(1+0.02*c.prismLv*l); } },
  { id:"wstar",  icon:"⭐", name:"Полировка звёзд", max:100, desc:l=>"Сила звёзд-улучшений +"+(l*3)+"% за их уровень",
    cost:l=>Math.ceil(15*Math.pow(1.45,l)), apply:(m,l,c)=>{ const f=1+0.03*c.starLv*l; m.global*=f; m.click*=f; } },
  { id:"wnoob",  icon:"🧍", name:"Точило нубов", max:100, desc:l=>"Сила нубов +"+(l*1)+"% за каждое улучшение нубов",
    cost:l=>Math.ceil(10*Math.pow(1.4,l)), apply:(m,l,c)=>{ m.global*=(1+0.01*c.noobUp*l); } },
  { id:"wrune",  icon:"🔮", name:"Крепёж рун", max:50, desc:l=>"Эффект рун +"+(l*8)+"%",
    cost:l=>Math.ceil(14*Math.pow(1.5,l)), apply:(m,l)=>{ m._runePow+=l*0.08; } },
  { id:"wslot",  icon:"🧩", name:"Кустарные слоты", max:5, desc:l=>"+"+l+" слот рун",
    cost:l=>Math.ceil(40*Math.pow(2.2,l)), apply:(m,l)=>{ m._bonusSlots+=l; } },
  { id:"wconv",  icon:"♻️", name:"Перегонка призм", max:30, desc:l=>"Шестерёнок за престиж +"+(l*25)+"% от призм",
    cost:l=>Math.ceil(16*Math.pow(1.5,l)) },
];
const WORKSHOP_UP = Object.fromEntries(WORKSHOP_UPS.map(w=>[w.id,w]));

/* ============ МАСТЕРСКАЯ 2.0 (углубление A–J) ============ */
function applyWsBonus(b,m){ if(!b) return;
  if(b.global) m.global*=(1+b.global); if(b.click) m.click*=(1+b.click);
  if(b.runePow) m._runePow+=b.runePow; if(b.gear) m._gearBoost+=b.gear;
  if(b.slots) m._bonusSlots+=b.slots; if(b.crit) m.crit+=b.crit; }

// A/H — уровень верстака и вехи (по суммарно собранным шестерёнкам)
const WS_MILE = [
  { at:5e2,  icon:"🔧", name:"Верстак",         buff:{global:0.05}, txt:"+5% всего" },
  { at:5e3,  icon:"🛠️", name:"Мастерская",      buff:{global:0.05}, txt:"+5% всего" },
  { at:5e4,  icon:"⚙️", name:"Цех",             buff:{runePow:0.15},txt:"+15% эффект рун" },
  { at:5e5,  icon:"🏭", name:"Фабрика",          buff:{global:0.10}, txt:"+10% всего" },
  { at:5e6,  icon:"🦾", name:"Автозавод",        buff:{slots:1},     txt:"+1 слот рун" },
  { at:5e7,  icon:"🛰️", name:"Орбитальный док",  buff:{click:0.5},   txt:"+50% тап" },
  { at:5e8,  icon:"🌌", name:"Звёздная верфь",   buff:{global:0.25}, txt:"+25% всего" },
  { at:5e9,  icon:"👑", name:"Империя станков",  buff:{global:0.5},  txt:"+50% всего" },
];
function wsLevel(){ let n=0; const g=save.gearsEver||0; for(const ms of WS_MILE) if(g>=ms.at) n++; return n; }
function wsNextMile(){ const g=save.gearsEver||0; for(const ms of WS_MILE) if(g<ms.at) return ms; return null; }
function wsLevelMul(){ return 1 + 0.04*wsLevel() + 0.15*(save.wsReforges||0); } // вклад в фарм шестерёнок

// B — проекты (крафт-очередь во времени, как «Наука»)
const WS_PROJECTS = [
  { id:"p1", icon:"🔩", name:"Золотой редуктор", time:120,  cost:200,  req:[],         bonus:{global:0.15}, desc:"+15% всего" },
  { id:"p2", icon:"⛓️", name:"Приводной вал",    time:300,  cost:1500, req:["p1"],      bonus:{gear:0.5},    desc:"+50% фарма ⚙️" },
  { id:"p3", icon:"🧲", name:"Магнитный захват", time:600,  cost:8000, req:["p1"],      bonus:{click:0.6},   desc:"+60% тап" },
  { id:"p4", icon:"🛞", name:"Маховик",          time:900,  cost:4e4,  req:["p2"],      bonus:{global:0.3},  desc:"+30% всего" },
  { id:"p5", icon:"🔆", name:"Плазменный резак", time:1800, cost:2e5,  req:["p3","p4"], bonus:{global:0.5},  desc:"+50% всего" },
];
const WS_PROJ_M = Object.fromEntries(WS_PROJECTS.map(p=>[p.id,p]));
function wsProjDone(id){ return !!(save.wsProjects.done||{})[id]; }
function wsProjReqMet(p){ return p.req.every(id=>wsProjDone(id)); }
function startWsProject(id){ const p=WS_PROJ_M[id];
  if(save.wsProjects.active){ toast("Уже идёт проект"); return; }
  if(wsProjDone(id)||!wsProjReqMet(p)) return;
  if(save.gears<p.cost){ toast("Мало ⚙️: нужно "+fmt(p.cost)); return; }
  save.gears-=p.cost; save.wsProjects.active=id; save.wsProjects.until=Date.now()+p.time*1000;
  toast("📐 Начат проект: "+p.name); renderWsProjects(); refreshTop(); queueSave();
}
function rushWsProject(){ const R=save.wsProjects; if(!R.active) return; const p=WS_PROJ_M[R.active];
  const left=Math.max(0,(R.until-Date.now())/1000); const cost=Math.ceil(p.cost*0.5*(left/p.time)+1);
  if(save.gears<cost){ toast("Мало ⚙️ для ускорения ("+fmt(cost)+")"); return; }
  save.gears-=cost; R.until=Date.now(); tickWsProjects(); renderWsProjects(); refreshTop(); queueSave(); }
function tickWsProjects(){ const R=save.wsProjects; if(!R.active) return;
  if(Date.now()>=R.until){ const p=WS_PROJ_M[R.active]; (R.done=R.done||{})[R.active]=true; R.active=null; R.until=0;
    toast("✅ Проект готов: "+p.name+" — "+p.desc); recompute(); refreshTop();
    if(curTab==="workshop"&&wsSub==="proj") renderWsProjects(); } }

// C — чертежи (дроп за престиж, редкости + сет-бонус)
const BP_RAR = [
  { id:"common", name:"Обычный",     col:"#9aa3d4", w:60, mul:1   },
  { id:"rare",   name:"Редкий",      col:"#5be6ff", w:26, mul:2.4 },
  { id:"epic",   name:"Эпический",   col:"#b06cff", w:11, mul:5   },
  { id:"legend", name:"Легендарный", col:"#ffb84d", w:3,  mul:12  },
];
const BLUEPRINTS = [
  { id:"bp_glob", icon:"📘", name:"Схема усиления", kind:"global",  base:0.04, txt:"всего" },
  { id:"bp_click",icon:"📗", name:"Схема удара",    kind:"click",   base:0.07, txt:"тап" },
  { id:"bp_gear", icon:"📙", name:"Схема привода",  kind:"gear",    base:0.09, txt:"фарм ⚙️" },
  { id:"bp_rune", icon:"📕", name:"Схема рун",      kind:"runePow", base:0.05, txt:"эффект рун" },
];
const BP_M = Object.fromEntries(BLUEPRINTS.map(b=>[b.id,b]));
function pickBpRarity(){ let t=0; for(const r of BP_RAR) t+=r.w; let x=Math.random()*t;
  for(const r of BP_RAR){ x-=r.w; if(x<0) return r; } return BP_RAR[0]; }
function dropBlueprint(){ const bp=BLUEPRINTS[Math.floor(Math.random()*BLUEPRINTS.length)];
  const rar=pickBpRarity(); const add=bp.base*rar.mul;
  save.blueprints[bp.id]=(save.blueprints[bp.id]||0)+add;
  save.bpCount=(save.bpCount||0)+1;
  toast("📜 Чертёж ["+rar.name+"]: "+bp.name+" +"+Math.round(add*100)+"% "+bp.txt);
  recompute();
}
function bpSetComplete(){ return BLUEPRINTS.every(b=>(save.blueprints[b.id]||0)>0); }

// F — качество и звёзды модулей (реролл/прокачка за шестерёнки)
function wsQ(id){ return save.wsQuality[id]||1; }
function wsStar(id){ return save.wsStars[id]||0; }
function wsStarBonus(id){ return wsStar(id)*0.06*wsQ(id); }
function wsStarCost(id){ return Math.ceil(30*Math.pow(2,wsStar(id))); }
function wsRerollCost(id){ return Math.ceil(25*Math.pow(1.4,(save.workshopUps[id]||0))); }
function buyWsStar(id){ if((save.workshopUps[id]||0)<1){ toast("Сначала прокачай модуль"); return; }
  if(wsStar(id)>=5){ toast("Звёзды на максимуме"); return; } const c=wsStarCost(id);
  if(save.gears<c){ toast("Мало ⚙️"); return; } save.gears-=c; save.wsStars[id]=wsStar(id)+1;
  recompute(); renderWorkshop(); refreshTop(); queueSave(); }
function rerollWsQ(id){ const c=wsRerollCost(id); if(save.gears<c){ toast("Мало ⚙️ ("+fmt(c)+")"); return; }
  save.gears-=c; save.wsQuality[id]=0.7+Math.random()*0.8;
  recompute(); renderWorkshop(); refreshTop(); queueSave(); }

// G — конвейеры (сетка синергий, одноразовая покупка за шестерёнки)
const WS_CONV = [
  { id:"cTap",  icon:"🔗", name:"Конвейер: ⚙️→👊 Тап",  cost:150, desc:()=>"log₁₀(⚙️ всего) ×множитель тапа",
    apply:m=>{ m.click*=(1+Math.max(0,Math.log10(1+(save.gearsEver||0)))*0.4); } },
  { id:"cOre",  icon:"🔗", name:"Конвейер: ⚙️→🪨 Руда",  cost:200, desc:()=>"+"+(wsLevel()*5)+"% добыча руды (за ур. верстака)",
    apply:m=>{ m._oreBoost+=wsLevel()*0.05; } },
  { id:"cRune", icon:"🔗", name:"Конвейер: ⚙️→🔮 Руны",  cost:350, desc:()=>"+"+Math.floor(wsLevel()/3)+" слот рун (1 за 3 ур.)",
    apply:m=>{ m._bonusSlots+=Math.floor(wsLevel()/3); } },
  { id:"cNoob", icon:"🔗", name:"Конвейер: ⚙️→🧍 Нубы",  cost:500, desc:()=>"+"+(wsLevel()*3)+"% всему (за ур. верстака)",
    apply:m=>{ m.global*=(1+wsLevel()*0.03); } },
];
const WS_CONV_M = Object.fromEntries(WS_CONV.map(c=>[c.id,c]));
function buyConveyor(id){ const c=WS_CONV_M[id]; if(save.wsConveyors[id]) return;
  if(save.gears<c.cost){ toast("Мало ⚙️: нужно "+fmt(c.cost)); return; }
  save.gears-=c.cost; save.wsConveyors[id]=true;
  toast("🔗 Конвейер подключён: "+c.name); recompute(); renderWsConveyors(); refreshTop(); queueSave(); }

// I — переоснастка (мини-престиж мастерской) + ключ-улучшения
const WS_KEY_UPS = [
  { id:"kfarm", icon:"🗝️", name:"Мастер-ключ",  max:20, cost:l=>l+1, desc:l=>"Фарм ⚙️ +"+(l*25)+"%",     apply:(m,l)=>{ m._gearBoost+=l*0.25; } },
  { id:"kglob", icon:"🔑", name:"Ключ мощи",     max:20, cost:l=>l+1, desc:l=>"Всё ×"+(1+0.12*l).toFixed(2), apply:(m,l)=>{ m.global*=(1+0.12*l); } },
  { id:"kbp",   icon:"🔐", name:"Ключ чертежей", max:10, cost:l=>2*(l+1), desc:l=>"Сила чертежей +"+(l*20)+"%", apply:()=>{} },
];
const WS_KEY_M = Object.fromEntries(WS_KEY_UPS.map(k=>[k.id,k]));
function reforgeGain(){ return Math.floor(wsLevel() + Math.sqrt((save.gearsEver||0)/2e4)); }
function bpPowMul(){ return 1 + (save.wsKeyUps.kbp||0)*0.2; } // ключ чертежей усиливает C
function doReforge(){ const k=reforgeGain(); if(k<1){ toast("Пока нечего переоснащать"); return; }
  save.wsKeys=(save.wsKeys||0)+k; save.wsReforges=(save.wsReforges||0)+1;
  save.workshopUps={}; save.wsStars={}; save.wsQuality={}; save.gears=0;
  toast("♻️ Переоснастка #"+save.wsReforges+": +"+k+" 🗝️ ключей");
  recompute(); renderWorkshop(); refreshTop(); queueSave(); }
function buyKeyUp(id){ const k=WS_KEY_M[id], l=save.wsKeyUps[id]||0; if(l>=k.max) return; const c=k.cost(l);
  if((save.wsKeys||0)<c){ toast("Мало 🗝️"); return; } save.wsKeys-=c; save.wsKeyUps[id]=l+1;
  recompute(); renderWsReforge(); refreshTop(); queueSave(); }

// E — перегрев/обслуживание (риск-механика фарма)
function wsOverheatFactor(){ const o=save.overheat; if(!o) return 1; const now=Date.now();
  if(o.coolUntil>now) return 0.3; if(o.on) return 3; return 1; }
function toggleOverheat(){ const o=save.overheat; if(o.coolUntil>Date.now()){ toast("Идёт обслуживание"); return; }
  o.on=!o.on; toast(o.on?"🔥 Форсаж: фарм ×3, копится износ":"❄️ Форсаж выключен"); recompute(); renderWsFarm(); }
function maintainWorkshop(){ const o=save.overheat; const cost=Math.ceil(20+(save.gearsEver||0)*0.0002);
  if(save.gears<cost){ toast("Мало ⚙️ для обслуживания ("+fmt(cost)+")"); return; }
  save.gears-=cost; o.wear=0; o.coolUntil=0; o.on=false; toast("🛠️ Обслужено — износ сброшен"); recompute(); renderWsFarm(); refreshTop(); queueSave(); }
function tickOverheat(edt){ const o=save.overheat; if(!o) return; const now=Date.now();
  if(o.coolUntil>now) return;
  if(o.on){ o.wear=Math.min(100,o.wear+edt*3.5); if(o.wear>=100){ o.on=false; o.coolUntil=now+45000; toast("🔥 Перегрев! Обслуживание 45с (фарм ×0.3)"); if(curTab==="workshop") renderWsFarm(); } }
  else if(o.wear>0){ o.wear=Math.max(0,o.wear-edt*7); } }

// ---- Шахта: 🪨 руда (шахтёры копают, руда усиливает всё) ----
const MINER_BASE = 60, MINER_MUL = 1.18, MINER_RATE = 0.2;
const MINING_UPS = [
  { id:"pick", icon:"⛏️", name:"Крепкие кирки", max:100, desc:l=>"Добыча ×"+(1+0.15*l).toFixed(2),
    cost:l=>Math.ceil(20*Math.pow(1.35,l)), rate:l=>1+0.15*l },
  { id:"boom", icon:"🧨", name:"Взрывчатка", max:100, desc:l=>"Добыча ×"+(1+0.25*l).toFixed(2),
    cost:l=>Math.ceil(50*Math.pow(1.4,l)), rate:l=>1+0.25*l },
  { id:"vein", icon:"🌋", name:"Глубокая жила", max:50, desc:l=>"Добыча ×"+(1+0.5*l).toFixed(1),
    cost:l=>Math.ceil(200*Math.pow(1.6,l)), rate:l=>1+0.5*l },
  { id:"rich", icon:"🪙", name:"Ценная руда", max:100, desc:l=>"Oof/с +"+(l*4)+"% (от шахты)",
    cost:l=>Math.ceil(80*Math.pow(1.45,l)), glob:l=>1+0.04*l },
  { id:"cheap",icon:"👷", name:"Профсоюз", max:35, desc:l=>"Шахтёры дешевле "+Math.min(l*2,70)+"%",
    cost:l=>Math.ceil(60*Math.pow(1.5,l)) },
  { id:"auto", icon:"🛒", name:"Автошахтёр", max:1, desc:l=>l?"Сам нанимает шахтёров за Oof":"Заблокировано",
    cost:()=>800 },
  { id:"drill",icon:"🛠️", name:"Бур", max:100, desc:l=>"Спуск ×"+(1+0.3*l).toFixed(1),
    cost:l=>Math.ceil(120*Math.pow(1.5,l)), dig:l=>1+0.3*l },
];
const MINING_UP = Object.fromEntries(MINING_UPS.map(m=>[m.id,m]));
function minerCost(){
  const l=save.miningUps.cheap||0, red=1-Math.min(l*0.02,0.7);
  return MINER_BASE*Math.pow(MINER_MUL, save.miners)*red;
}
// A+B — глубина и пласты
const STRATA = [
  { d:0,   icon:"🟫", name:"Поверхность" },
  { d:5,   icon:"🪨", name:"Камень" },
  { d:15,  icon:"⚫", name:"Угольный пласт" },
  { d:30,  icon:"⛓️", name:"Железная жила" },
  { d:50,  icon:"🟡", name:"Золотой пласт" },
  { d:80,  icon:"💎", name:"Самоцветы" },
  { d:120, icon:"🔷", name:"Кристаллы" },
  { d:180, icon:"🔥", name:"Мантия" },
  { d:260, icon:"☀️", name:"Ядро" },
];
function stratumIndex(depth){ let i=0; for(let k=0;k<STRATA.length;k++){ if(depth>=STRATA[k].d) i=k; } return i; }
function depthNeed(d){ return 8*Math.pow(1.16, d); }
function digRate(){ return (0.3 + (save.miners||0)*0.03) * (1 + (save.miningUps.drill||0)*0.3); }

// ---- Алхимия: питомцы (вечные %) и зелья (временные баффы). Валюта: руда + пыль ----
const PETS = [
  { id:"cat",   icon:"🐈", name:"Кот-мемолов",   max:50, desc:l=>"Oof/с +"+(l*5)+"%",       apply:(m,l)=>m.global*=(1+l*0.05),
    cost:l=>({ore:Math.ceil(200*Math.pow(1.4,l)),  dust:Math.ceil(5*Math.pow(1.3,l))}) },
  { id:"fox",   icon:"🦊", name:"Лис-ловкач",     max:50, desc:l=>"Тап +"+(l*8)+"%",          apply:(m,l)=>m.click*=(1+l*0.08),
    cost:l=>({ore:Math.ceil(150*Math.pow(1.4,l)),  dust:Math.ceil(4*Math.pow(1.3,l))}) },
  { id:"dog",   icon:"🐕", name:"Пёс-нюхач",      max:50, desc:l=>"Удача рун +"+(l*4)+"%",     apply:(m,l)=>m._runeLuck+=l*0.04,
    cost:l=>({ore:Math.ceil(180*Math.pow(1.45,l)), dust:Math.ceil(8*Math.pow(1.35,l))}) },
  { id:"eagle", icon:"🦅", name:"Орёл-старатель", max:50, desc:l=>"Добыча руды +"+(l*10)+"%",  apply:(m,l)=>m._oreBoost+=l*0.1,
    cost:l=>({ore:Math.ceil(300*Math.pow(1.5,l)),  dust:Math.ceil(3*Math.pow(1.3,l))}) },
  { id:"owl",   icon:"🦉", name:"Сова-мудрец",    max:50, desc:l=>"Эффект рун +"+(l*5)+"%",    apply:(m,l)=>m._runePow+=l*0.05,
    cost:l=>({ore:Math.ceil(250*Math.pow(1.45,l)), dust:Math.ceil(10*Math.pow(1.35,l))}) },
  { id:"dragon",icon:"🐉", name:"Дракончик",      max:30, desc:l=>"Всё +"+(l*6)+"%",           apply:(m,l)=>m.global*=(1+l*0.06),
    cost:l=>({ore:Math.ceil(1000*Math.pow(1.6,l)), dust:Math.ceil(40*Math.pow(1.5,l))}) },
];
const PET = Object.fromEntries(PETS.map(p=>[p.id,p]));
const POTIONS = [
  { id:"rush",  icon:"⚗️", name:"Зелье ярости",  dur:60,  desc:"×3 Oof/с на 60с",     cost:{ore:500, dust:20}, buff:{global:3} },
  { id:"luck",  icon:"🧪", name:"Эликсир удачи",  dur:60,  desc:"+удача рун на 60с",    cost:{ore:400, dust:30}, buff:{luck:4} },
  { id:"mine",  icon:"🍶", name:"Настой шахтёра", dur:120, desc:"×4 добыча на 120с",    cost:{ore:300, dust:15}, buff:{ore:3} },
  { id:"party", icon:"🍾", name:"Праздник Oof",   dur:30,  desc:"×10 тап на 30с",       cost:{ore:800, dust:50}, buff:{click:10} },
];
const POTION = Object.fromEntries(POTIONS.map(p=>[p.id,p]));

// ---- Конвейер мутаций: скрещивание за руду+пыль+шестерёнки → вечные мутанты ----
const MUTANTS = [
  { id:"magnet", icon:"🧲", name:"Нуб-магнит",     desc:"+30% Oof/с навсегда",
    cost:{ore:5e3, dust:200, gears:100}, apply:m=>m.global*=1.3 },
  { id:"ice",    icon:"❄️", name:"Ледяной нуб",     desc:"+50% к тапу навсегда",
    cost:{ore:4e3, dust:150, gears:80},  apply:m=>m.click*=1.5 },
  { id:"lucky",  icon:"🍀", name:"Счастливый нуб",  desc:"+30% удача рун навсегда",
    cost:{ore:6e3, dust:400, gears:120}, apply:m=>m._runeLuck+=0.3 },
  { id:"king",   icon:"👑", name:"Королевский нуб", desc:"+40% ко всему навсегда",
    cost:{ore:2e4, dust:800, gears:400}, apply:m=>m.global*=1.4 },
  { id:"boom",   icon:"💥", name:"Взрывной нуб",    desc:"Раз в 60с — взрыв ≈ час дохода",
    cost:{ore:1e4, dust:500, gears:250}, apply:()=>{} },
];
const MUTANT = Object.fromEntries(MUTANTS.map(x=>[x.id,x]));

// ---- Хроно-биржа: обмен руды/пыли/шестерёнок на Oof по плавающему курсу ----
const MARKET_RES = [
  { id:"ore",   icon:"🪨", name:"Руда",        base:120 },
  { id:"dust",  icon:"💠", name:"Пыль рун",    base:600 },
  { id:"gears", icon:"⚙️", name:"Шестерёнки",  base:1500 },
];
const MARKET_EVENTS = [
  { res:"ore",   mult:3.5, text:"⛏️ Дефицит руды: цена ×3.5" },
  { res:"gears", mult:3.0, text:"⚙️ Спрос на шестерёнки: цена ×3" },
  { res:"dust",  mult:0.3, text:"💠 Обвал пыли: цена ×0.3" },
  { res:"ore",   mult:0.3, text:"🪨 Затоварка рудой: цена ×0.3" },
  { res:"dust",  mult:3.5, text:"🔮 Магия в моде: пыль ×3.5" },
];
function marketPrice(res){
  const m=save.market||{}; let f=m[res]||1;
  if(m.event && m.event.res===res && Date.now()<m.event.until) f*=m.event.mult;
  return MARKET_RES.find(r=>r.id===res).base * f;
}

// ---- Трансцендентность: ⚛️ кварки (3-й слой сброса) + Пантеон (синергии) ----
function quarkGain(stars){ if(stars<1000) return 0;
  const bonus = 1 + gaQuarkBonus() + (save.singularity?(save.singularity.ups.siQuark||0)*0.2:0);
  return Math.floor(Math.pow(stars/1000, 0.5) * (D.allCurMul||1) * bonus); }
const QUARK_UPS = [
  { id:"qall",  icon:"⚛️", name:"Квантовый множитель", max:500, desc:l=>"Всё ×"+fmt(1+0.5*l),
    cost:l=>Math.ceil(3*Math.pow(1.4,l)), apply:(m,l)=>m.global*=(1+0.5*l) },
  { id:"qprism",icon:"💎", name:"Призменный резонанс", max:100, desc:l=>"Призм +"+(l*20)+"%",
    cost:l=>Math.ceil(2*Math.pow(1.4,l)), apply:(m,l)=>m.prism*=(1+l*0.2) },
  { id:"qkeep", icon:"⭐", name:"Квантовая память", max:20, desc:l=>"Оставляй "+(l*3)+"% звёзд при трансценденции",
    cost:l=>Math.ceil(3*Math.pow(1.6,l)) },
  // ветка 2 — открывается со 2-й трансценденции
  { id:"qclick", icon:"👊", name:"Квантовый удар", max:200, desc:l=>"Тап ×"+fmt(1+0.4*l),
    cost:l=>Math.ceil(3*Math.pow(1.35,l)), apply:(m,l)=>m.click*=(1+0.4*l), req:()=>save.transcends>=2 },
  { id:"qcost",  icon:"🔻", name:"Сжатие цен", max:15, desc:l=>"Цена нубов −"+(l*3)+"%",
    cost:l=>Math.ceil(5*Math.pow(1.5,l)), apply:(m,l)=>m.cost*=(1-Math.min(0.6,l*0.03)), req:()=>save.transcends>=2 },
  // ветка 3 — с 4-й трансценденции
  { id:"qstart", icon:"🎁", name:"Стартовый капитал", max:12, desc:l=>"Начинай забег с "+fmt(Math.pow(10,2+l))+" Oof",
    cost:l=>Math.ceil(4*Math.pow(1.4,l)), req:()=>save.transcends>=4 },
  { id:"qauto",  icon:"🤖", name:"Квантовый автопилот", max:1, desc:l=>l?"Авто-трансценденция при выгоде":"Автоматизирует трансценденцию",
    cost:l=>60, req:()=>save.transcends>=6 },
];
const QUARK_UP = Object.fromEntries(QUARK_UPS.map(q=>[q.id,q]));

// ---- Искажение: ⚫ добровольный дебафф ради тёмной валюты ----
const CORR_UPS = [
  { id:"cpow",  icon:"⚫", name:"Сила искажения", max:300, desc:l=>"Всё ×"+(1+0.35*l).toFixed(2),
    cost:l=>Math.ceil(5*Math.pow(1.3,l)), apply:(m,l)=>m.global*=(1+0.35*l) },
  { id:"cmine", icon:"🕳️", name:"Тёмная руда", max:100, desc:l=>"Добыча ×"+(1+0.3*l).toFixed(1),
    cost:l=>Math.ceil(8*Math.pow(1.35,l)), apply:(m,l)=>m._oreBoost+=0.3*l },
  { id:"cluck", icon:"🩸", name:"Проклятая удача", max:50, desc:l=>"Удача рун +"+(l*10)+"%",
    cost:l=>Math.ceil(6*Math.pow(1.4,l)), apply:(m,l)=>m._runeLuck+=l*0.1 },
  { id:"ctap",  icon:"👊", name:"Гнев", max:200, desc:l=>"Тап ×"+(1+0.6*l).toFixed(1),
    cost:l=>Math.ceil(5*Math.pow(1.3,l)), apply:(m,l)=>m.click*=(1+0.6*l) },
];
const CORR_UP = Object.fromEntries(CORR_UPS.map(c=>[c.id,c]));

/* ============ МЕТА-СЛОИ (углубление A–J) ============ */
function applyMetaBonus(b,m){ if(!b) return;
  if(b.global) m.global*=(1+b.global); if(b.click) m.click*=(1+b.click);
  if(b.prism) m.prism*=(1+b.prism); if(b.crit) m.crit+=b.crit;
  if(b.runePow) m._runePow+=b.runePow; if(b.gear) m._gearBoost+=b.gear;
  if(b.oreB) m._oreBoost+=b.oreB; if(b.luck) m._runeLuck+=b.luck;
  if(b.regen) m.runeRegen*=(1+b.regen); if(b.cost) m.cost*=(1-b.cost); }

// A — Пантеон: доска созвездий (прокачка за кварки, кросс-механические синергии)
const PANTHEON = [
  { id:"forge", icon:"⚒️", name:"Бог Кузни",   max:15, cost:l=>Math.ceil(4*Math.pow(1.5,l)),  desc:l=>"+"+(l*10)+"% фарма ⚙️ и руды", apply:(m,l)=>{ m._gearBoost+=l*0.1; m._oreBoost+=l*0.1; } },
  { id:"war",   icon:"⚔️", name:"Бог Войны",   max:15, cost:l=>Math.ceil(4*Math.pow(1.5,l)),  desc:l=>"Тап ×"+(1+0.3*l).toFixed(1), apply:(m,l)=>m.click*=(1+0.3*l) },
  { id:"time",  icon:"⏳", name:"Бог Времени",  max:10, cost:l=>Math.ceil(6*Math.pow(1.6,l)),  desc:l=>"Реген энергии рун +"+(l*10)+"%", apply:(m,l)=>m.runeRegen*=(1+l*0.1) },
  { id:"luck",  icon:"🍀", name:"Бог Удачи",    max:10, cost:l=>Math.ceil(6*Math.pow(1.6,l)),  desc:l=>"Удача рун +"+(l*8)+"%, крит +"+l+"%", apply:(m,l)=>{ m._runeLuck+=l*0.08; m.crit+=l*0.01; } },
  { id:"greed", icon:"💰", name:"Бог Жадности", max:20, cost:l=>Math.ceil(5*Math.pow(1.5,l)),  desc:l=>"Призм +"+(l*8)+"%", apply:(m,l)=>m.prism*=(1+l*0.08) },
  { id:"all",   icon:"🌌", name:"Всебог",       max:30, cost:l=>Math.ceil(10*Math.pow(1.7,l)), desc:l=>"Всё ×"+(1+0.3*l).toFixed(2), apply:(m,l)=>m.global*=(1+0.3*l), req:()=>pantheonTotal(true)>=25 },
];
const PANTHEON_M = Object.fromEntries(PANTHEON.map(p=>[p.id,p]));
function pantheonTotal(exceptAll){ let t=0; for(const p of PANTHEON){ if(exceptAll&&p.id==="all") continue; t+=save.pantheon[p.id]||0; } return t; }
function pantheonReq(p){ return !p.req || p.req(); }
function buyPantheon(id){ const p=PANTHEON_M[id], l=save.pantheon[id]||0; if(l>=p.max||!pantheonReq(p)) return;
  const cost=p.cost(l); if(save.quarks<cost){ toast("Мало ⚛️"); return; }
  save.quarks-=cost; save.pantheon[id]=l+1; recompute(); renderPantheon(); refreshTop(); queueSave(); }

// C — вехи трансценденции (пороги числа трансценденций → вечные баффы + открытия)
const TRANS_MILE = [
  { at:1,  icon:"⚛️", name:"Первая трансценденция", buff:{global:0.2}, txt:"+20% всего" },
  { at:3,  icon:"💎", name:"Искривление",           buff:{prism:0.5},  txt:"+50% призм" },
  { at:5,  icon:"🤖", name:"Автопилот вознесения",   unlock:"autoAscend", txt:"Открыто авто-вознесение" },
  { at:8,  icon:"🎁", name:"Наследие",               buff:{global:0.5}, txt:"+50% всего" },
  { at:12, icon:"⚡", name:"Квантовый разгон",        buff:{click:1},    txt:"×2 тап" },
  { at:20, icon:"👑", name:"Владыка кварков",         buff:{global:1},   txt:"×2 всего" },
];
function transLevel(){ let n=0; for(const ms of TRANS_MILE) if((save.transcends||0)>=ms.at) n++; return n; }
function transNextMile(){ for(const ms of TRANS_MILE) if((save.transcends||0)<ms.at) return ms; return null; }
function metaUnlocked(name){ for(const ms of TRANS_MILE){ if(ms.unlock===name && (save.transcends||0)>=ms.at) return true; } return false; }

// D — Искажение 2.0: искажённые зоны (активны, пока искажение ≥ порога)
const CORR_ZONES = [
  { at:5,  icon:"🌑", name:"Сумрак",           buff:{global:0.3},  darkMul:1, txt:"+30% всего" },
  { at:15, icon:"🕳️", name:"Бездна",            buff:{},            darkMul:2, txt:"×2 тёмной валюты" },
  { at:30, icon:"👁️", name:"Всевидящее око",    buff:{click:1},     darkMul:3, txt:"×2 тап" },
  { at:50, icon:"💀", name:"Забвение",          buff:{global:1.5},  darkMul:5, txt:"+150% всего" },
];
function corrDarkMul(){ let mul=1; for(const z of CORR_ZONES) if((save.corruption||0)>=z.at) mul=z.darkMul; return mul; }

// E — Тёмная лавка (трата тёмной валюты ⚫ на мощные проклятия с побочкой)
const DARK_SHOP = [
  { id:"dpow",  icon:"☠️", name:"Проклятая мощь",     cost:400,  desc:"+60% всего · −15% фарма ⚙️", apply:m=>{ m.global*=1.6; m._gearBoost-=0.15; } },
  { id:"dgreed",icon:"🩸", name:"Жажда крови",        cost:1500, desc:"×2 Oof · нубы дороже ×1.4", apply:m=>{ m.global*=2; m.cost*=1.4; } },
  { id:"dvoid", icon:"⚫", name:"Пустотный резонанс", cost:6000, desc:"+удача рун +60%, крит +6% · реген −30%", apply:m=>{ m._runeLuck+=0.6; m.crit+=0.06; m.runeRegen*=0.7; } },
  { id:"dcrown",icon:"👺", name:"Корона забвения",    cost:2.5e4,desc:"×3 всего · тёмная валюта −40%", apply:m=>{ m.global*=3; }, darkPen:0.4 },
];
const DARK_SHOP_M = Object.fromEntries(DARK_SHOP.map(d=>[d.id,d]));
function buyDark(id){ const d=DARK_SHOP_M[id]; if(save.darkShop[id]) return;
  if((save.corr||0)<d.cost){ toast("Мало ⚫ тёмной валюты"); return; }
  save.corr-=d.cost; save.darkShop[id]=true; toast("☠️ Куплено: "+d.name); recompute(); renderDarkShop(); refreshTop(); queueSave(); }

// F — Артефакты богов (дроп за трансценденцию, редкости + сет-бонус)
const GA_RAR = [ {id:"c",name:"Обычный",col:"#9aa3d4",w:60,mul:1}, {id:"r",name:"Редкий",col:"#5be6ff",w:26,mul:2.5},
  {id:"e",name:"Эпический",col:"#b06cff",w:11,mul:5}, {id:"l",name:"Божественный",col:"#ffb84d",w:3,mul:12} ];
const GOD_ARTIS = [
  { id:"scepter", icon:"🔱", name:"Скипетр Всебога", kind:"global",    base:0.05, txt:"всего" },
  { id:"eye",     icon:"👁️", name:"Око Провидца",    kind:"prism",     base:0.09, txt:"призм" },
  { id:"core",    icon:"⚛️", name:"Ядро Кванта",     kind:"quarkGain", base:0.07, txt:"кварков за транс" },
  { id:"blade",   icon:"⚔️", name:"Клинок Войны",    kind:"click",     base:0.09, txt:"тап" },
];
const GA_M = Object.fromEntries(GOD_ARTIS.map(a=>[a.id,a]));
function pickGaRarity(){ let t=0; for(const r of GA_RAR) t+=r.w; let x=Math.random()*t; for(const r of GA_RAR){ x-=r.w; if(x<0) return r; } return GA_RAR[0]; }
function dropGodArtifact(){ const a=GOD_ARTIS[Math.floor(Math.random()*GOD_ARTIS.length)]; const rar=pickGaRarity();
  const add=a.base*rar.mul; save.godArtifacts[a.id]=(save.godArtifacts[a.id]||0)+add; save.gaCount=(save.gaCount||0)+1;
  toast("🏛️ Артефакт ["+rar.name+"]: "+a.name+" +"+Math.round(add*100)+"% "+a.txt); recompute(); }
function gaSetComplete(){ return GOD_ARTIS.every(a=>(save.godArtifacts[a.id]||0)>0); }
function gaQuarkBonus(){ return (save.godArtifacts.core||0) * (gaSetComplete()?1.5:1); }

// G — Хроно-биржа 2.0: хроно-кристаллы за прибыльные сделки + авто-торговля
const CHRONO_UPS = [
  { id:"chFarm", icon:"⏱️", name:"Хроно-ускоритель", max:20, cost:l=>l+1, desc:l=>"Фарм всех валют +"+(l*10)+"%", apply:(m,l)=>{ m._gearBoost+=l*0.1; m._oreBoost+=l*0.1; } },
  { id:"chGlob", icon:"💠", name:"Кристальный резонанс", max:20, cost:l=>l+1, desc:l=>"Всё ×"+(1+0.08*l).toFixed(2), apply:(m,l)=>m.global*=(1+0.08*l) },
  { id:"chAuto", icon:"🤖", name:"Авто-трейдер", max:1, cost:l=>10, desc:l=>l?"Продаёт излишки на пике":"Авто-торговля на событиях", apply:()=>{} },
];
const CHRONO_UP_M = Object.fromEntries(CHRONO_UPS.map(c=>[c.id,c]));
function buyChronoUp(id){ const c=CHRONO_UP_M[id], l=save.chronoUps[id]||0; if(l>=c.max) return; const cost=c.cost(l);
  if((save.chronoCrystals||0)<cost){ toast("Мало 💎⏳ кристаллов"); return; } save.chronoCrystals-=cost; save.chronoUps[id]=l+1;
  recompute(); renderChrono(); refreshTop(); queueSave(); }

// H — Карманные реальности: осколки + постоянные миры
const REALITY_WORLDS = [
  { id:"w_flux",  icon:"🌊", name:"Мир Потока",  cost:3,  desc:"+25% Oof/с", apply:m=>m.global*=1.25 },
  { id:"w_spark", icon:"⚡", name:"Мир Искр",    cost:5,  desc:"+40% тап", apply:m=>m.click*=1.4 },
  { id:"w_gem",   icon:"💠", name:"Мир Кристаллов", cost:8, desc:"+30% призм", apply:m=>m.prism*=1.3 },
  { id:"w_rune",  icon:"🔮", name:"Мир Рун",     cost:12, desc:"+30% эффект рун", apply:m=>m._runePow+=0.3 },
  { id:"w_core",  icon:"🌌", name:"Мир Ядра",    cost:20, desc:"×2 всего", apply:m=>m.global*=2, req:()=>realityExplored()>=4 },
];
const RW_M = Object.fromEntries(REALITY_WORLDS.map(w=>[w.id,w]));
function realityExplored(){ let n=0; for(const w of REALITY_WORLDS) if(save.realities.worlds[w.id]) n++; return n; }
function unlockWorld(id){ const w=RW_M[id]; if(save.realities.worlds[id]||(w.req&&!w.req())) return;
  if((save.realities.shards||0)<w.cost){ toast("Мало 🔹 осколков"); return; }
  save.realities.shards-=w.cost; save.realities.worlds[id]=true; toast("🌀 Открыт "+w.name); recompute(); renderRealities(); refreshTop(); queueSave(); }

// I — Кодекс вознесения (мета-достижения → кросс-слойные множители)
const META_ACH = [
  { id:"ma_t5",  icon:"⚛️", name:"Трансцендент",     desc:"5 трансценденций",      cond:()=>(save.transcends||0)>=5,   buff:{global:0.25} },
  { id:"ma_t15", icon:"🌠", name:"За гранью",         desc:"15 трансценденций",     cond:()=>(save.transcends||0)>=15,  buff:{global:0.5} },
  { id:"ma_pan", icon:"🌌", name:"Пантеон собран",    desc:"50 уровней Пантеона",   cond:()=>pantheonTotal()>=50,       buff:{global:0.5} },
  { id:"ma_corr",icon:"💀", name:"На самом дне",      desc:"Искажение 50",          cond:()=>(save.corruption||0)>=50,  buff:{click:0.5} },
  { id:"ma_dark",icon:"☠️", name:"Тёмный делец",      desc:"Вся тёмная лавка",      cond:()=>DARK_SHOP.every(d=>save.darkShop[d.id]), buff:{global:0.4} },
  { id:"ma_ga",  icon:"🏛️", name:"Коллекционер богов",desc:"Комплект артефактов",   cond:()=>gaSetComplete(),           buff:{prism:0.5} },
  { id:"ma_real",icon:"🌀", name:"Мультивёрсум",      desc:"Все миры реальностей",  cond:()=>realityExplored()>=REALITY_WORLDS.length, buff:{global:0.5} },
  { id:"ma_si",  icon:"♾️", name:"Бесконечность",     desc:"1 сингулярность",       cond:()=>(save.singularity.resets||0)>=1, buff:{global:1} },
];
function metaAchDone(){ let n=0; for(const a of META_ACH) if(save.metaAch[a.id]) n++; return n; }
function checkMetaAch(){ let any=false; for(const a of META_ACH){ if(!save.metaAch[a.id] && a.cond()){ save.metaAch[a.id]=true; any=true;
  toast("🌟 Мета-достижение: "+a.name); } } if(any){ recompute(); refreshTop(); } }

// J — Сингулярность: 4-й слой сброса (♾️ бесконечные очки)
function siGain(){ const q=save.quarksEver||0; if((save.transcends||0)<10 && (save.singularity.resets||0)===0) return 0;
  return Math.floor(Math.pow(Math.max(0,q)/50, 0.4)); }
const SI_UPS = [
  { id:"siAll",   icon:"♾️", name:"Бесконечный множитель", max:1000, cost:l=>Math.ceil(2*Math.pow(1.3,l)), desc:l=>"Всё ×"+fmt(1+l), apply:(m,l)=>m.global*=(1+l) },
  { id:"siAuto",  icon:"🤖", name:"Полный автопилот",      max:1,    cost:l=>15, desc:l=>l?"Авто престиж+вознес+транс":"Автоматизирует все сбросы", apply:()=>{} },
  { id:"siKeep",  icon:"🎁", name:"Осколок вечности",       max:10,   cost:l=>Math.ceil(3*Math.pow(1.5,l)), desc:l=>"Старт забега: +"+fmt(Math.pow(10,3+l))+" Oof", apply:()=>{} },
  { id:"siQuark", icon:"⚛️", name:"Вечный квант",           max:50,   cost:l=>Math.ceil(4*Math.pow(1.35,l)), desc:l=>"Кварков за транс +"+(l*20)+"%", apply:()=>{} },
];
const SI_UP_M = Object.fromEntries(SI_UPS.map(s=>[s.id,s]));
function buySiUp(id){ const s=SI_UP_M[id], l=save.singularity.ups[id]||0; if(l>=s.max) return; const cost=s.cost(l);
  if((save.singularity.si||0)<cost){ toast("Мало ♾️"); return; } save.singularity.si-=cost; save.singularity.ups[id]=l+1;
  recompute(); renderSingularity(); refreshTop(); queueSave(); }
function doSingularity(){ const g=siGain(); if(g<1){ toast("Пока рано для сингулярности"); return; }
  const S=save.singularity; S.si=(S.si||0)+g; S.siEver=(S.siEver||0)+g; S.resets=(S.resets||0)+1;
  // сброс слоёв ниже сингулярности (мета-коллекции сохраняются)
  save.prisms=0; save.prismUps={}; save.stars=0; save.starUps={}; save.quarks=0; save.quarkUps={};
  save.prestiges=0; save.transcends=0; save.pantheon={}; save.corruption=0; save.corr=0; save.corrUps={};
  save.gears=0; save.workshopUps={}; save.wsStars={}; save.wsQuality={};
  softReset(); recompute(); syncNoobSprites();
  toast("♾️ Сингулярность #"+S.resets+": +"+fmt(g)+" бесконечных очков!");
  renderAll(); refreshTop(); persist(); }

// ---- Испытания: забеги с ограничениями за вечные перки ----
const CHALLENGES = [
  { id:"noPassive", icon:"✋", name:"Только руки", goal:1e5,
    desc:"Нубы не приносят Oof — только тапы", rewardText:"+100% к тапу навсегда",
    restrict:{noPassive:true}, reward:{click:1.0} },
  { id:"noUps", icon:"⛔", name:"Голые руки", goal:1e6,
    desc:"Обычные улучшения отключены", rewardText:"+50% ко всему навсегда",
    restrict:{noUps:true}, reward:{global:0.5} },
  { id:"noRunes", icon:"🚱", name:"Без магии", goal:5e6,
    desc:"Руны и их эффекты отключены", rewardText:"+50% к нубам навсегда",
    restrict:{noRunes:true}, reward:{global:0.5} },
  { id:"expensive", icon:"💸", name:"Инфляция", goal:1e7,
    desc:"Нубы дороже в 6 раз", rewardText:"-20% цена нубов навсегда",
    restrict:{costX:6}, reward:{cost:0.2} },
  { id:"weak", icon:"🥀", name:"Слабость", goal:1e6,
    desc:"Вся выработка ÷12", rewardText:"+150% ко всему навсегда",
    restrict:{weak:12}, reward:{global:1.5} },
];
const CHAL = Object.fromEntries(CHALLENGES.map(c=>[c.id,c]));

// ---- Достижения / Вехи (вечные бонусы, не сбрасываются) ----
function totalNoobs(){ let t=0; for(const nb of NOOBS) t+=(save.noobs[nb.id]||0); return t; }
const ACHS = [
  { id:"clk1", icon:"👆", name:"Первые тычки",    desc:"100 тапов",        cond:()=>save.lifetimeClicks>=100,   buff:{click:0.1} },
  { id:"clk2", icon:"👆", name:"Тыкающий мастер", desc:"5 000 тапов",      cond:()=>save.lifetimeClicks>=5000,  buff:{click:0.25} },
  { id:"clk3", icon:"👆", name:"Палец-легенда",   desc:"50 000 тапов",     cond:()=>save.lifetimeClicks>=50000, buff:{click:0.5} },
  { id:"oof1", icon:"😵", name:"Первый миллион",  desc:"1e6 Oof всего",    cond:()=>save.lifetimeOof>=1e6,  buff:{global:0.05} },
  { id:"oof2", icon:"😵", name:"Мемный магнат",   desc:"1e9 Oof всего",    cond:()=>save.lifetimeOof>=1e9,  buff:{global:0.1} },
  { id:"oof3", icon:"😵", name:"Oof-император",   desc:"1e12 Oof всего",   cond:()=>save.lifetimeOof>=1e12, buff:{global:0.15} },
  { id:"oof4", icon:"😵", name:"Oof-божество",    desc:"1e15 Oof всего",   cond:()=>save.lifetimeOof>=1e15, buff:{global:0.25} },
  { id:"oof5", icon:"🌌", name:"Сингулярность Oof",desc:"1e18 Oof всего",  cond:()=>save.lifetimeOof>=1e18, buff:{global:0.4} },
  { id:"nb1",  icon:"🧍", name:"Толпа",           desc:"50 нубов",         cond:()=>totalNoobs()>=50,   buff:{global:0.05} },
  { id:"nb2",  icon:"🧍", name:"Армия",           desc:"250 нубов",        cond:()=>totalNoobs()>=250,  buff:{global:0.1} },
  { id:"nb3",  icon:"🧍", name:"Легион",          desc:"1000 нубов",       cond:()=>totalNoobs()>=1000, buff:{global:0.2} },
  { id:"pr1",  icon:"💎", name:"Новичок престижа",desc:"1 престиж",        cond:()=>save.prestiges>=1,  buff:{global:0.1} },
  { id:"pr2",  icon:"💎", name:"Мастер сброса",   desc:"10 престижей",     cond:()=>save.prestiges>=10, buff:{global:0.25, prism:0.1} },
  { id:"pr3",  icon:"💎", name:"Король призм",    desc:"50 престижей",     cond:()=>save.prestiges>=50, buff:{global:0.5, prism:0.25} },
  { id:"as1",  icon:"⭐", name:"Вознёсшийся",     desc:"1 вознесение",     cond:()=>save.ascends>=1,    buff:{global:0.3} },
  { id:"as2",  icon:"⭐", name:"Звёздный лорд",   desc:"25 звёзд собрано", cond:()=>save.stars>=25,     buff:{global:0.5} },
  { id:"ru1",  icon:"🔮", name:"Рунолог",         desc:"Мифическая руна в слоте", cond:()=>save.runes.some(r=>r&&r.rar>=5), buff:{runePow:0.15} },
  { id:"gr1",  icon:"⚙️", name:"Механик",         desc:"1e3 шестерёнок собрано", cond:()=>(save.gearsEver||0)>=1e3, buff:{global:0.1} },
  { id:"gr2",  icon:"⚙️", name:"Инженер",         desc:"1e6 шестерёнок собрано", cond:()=>(save.gearsEver||0)>=1e6, buff:{global:0.25} },
  { id:"ore1", icon:"🪨", name:"Шахтёр",          desc:"1e3 руды всего",   cond:()=>(save.oreEver||0)>=1e3, buff:{global:0.1} },
  { id:"ore2", icon:"🪨", name:"Магнат руды",     desc:"1e6 руды всего",   cond:()=>(save.oreEver||0)>=1e6, buff:{global:0.25} },
];
function achBuffText(b){
  const p=[];
  if(b.global) p.push("+"+Math.round(b.global*100)+"% всего");
  if(b.click)  p.push("+"+Math.round(b.click*100)+"% тапу");
  if(b.prism)  p.push("+"+Math.round(b.prism*100)+"% призм");
  if(b.runePow)p.push("+"+Math.round(b.runePow*100)+"% рун");
  return p.join(", ");
}

function toRoman(n){ const r=["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"]; return r[n]||n; }

/* ============ Сохранение ============ */
const SAVE_KEY = "noobinc_v1";
const DEFAULT = ()=>({
  oof:0, totalOof:0, lifetimeOof:0, lifetimeClicks:0,
  noobs:{}, ups:{}, prisms:0, prestiges:0, prismUps:{},
  runes:[], dust:0, energy:5, stars:0, ascends:0, starUps:{},
  gears:0, gearsEver:0, workshopUps:{}, salvageBelow:-1, achieved:{},
  wsProjects:{ active:null, until:0, done:{} }, blueprints:{}, bpCount:0,
  wsQuality:{}, wsStars:{}, wsConveyors:{}, wsKeys:0, wsKeyUps:{}, wsReforges:0,
  overheat:{ on:false, wear:0, coolUntil:0 },
  miners:0, ore:0, oreEver:0, miningUps:{}, depth:0, digProg:0, artifacts:0,
  pets:{}, potions:{},
  activeChallenge:null, chalDone:{},
  quarks:0, quarksEver:0, transcends:0, quarkUps:{}, corruption:0, corr:0, corrEver:0, corrUps:{},
  pantheon:{}, darkShop:{}, godArtifacts:{}, gaCount:0,
  chronoCrystals:0, chronoUps:{},
  realities:{ shards:0, worlds:{} }, metaAch:{},
  singularity:{ si:0, siEver:0, resets:0, ups:{} },
  mutants:{}, market:{ ore:1, dust:1, gears:1, nextDrift:0, event:null },
  dustUps:{}, auto:{ click:true, noobs:true, ups:true, mining:true, workshop:true, potions:false },
  ranks:{}, prismsEver:0, relics:{}, crossUps:{}, apMult:2,
  runeMastery:{}, runeSeen:{},
  infUps:{}, synUps:{}, infQuality:{},
  research:{ active:null, until:0, done:{} }, tokens:0, tokenUps:{}, shopGlobal:0,
  shop:{ offers:[], next:0 },
  lastTime:Date.now(), seen:{},
  admin:{ oofMul:1, clickMul:1, costMul:1, prismMul:1, speed:1 }
});
let save = DEFAULT();
function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
    if(raw){ save=Object.assign(DEFAULT(),raw);
      for(const k of ["noobs","ups","prismUps","starUps","workshopUps","achieved","miningUps","pets","potions","chalDone","quarkUps","corrUps","mutants","dustUps","ranks","relics","crossUps","runeMastery","runeSeen","infUps","synUps","infQuality","tokenUps","seen","blueprints","wsQuality","wsStars","wsConveyors","wsKeyUps"]) if(!save[k]) save[k]={};
      if(!save.wsProjects||typeof save.wsProjects!=="object") save.wsProjects={active:null,until:0,done:{}};
      if(!save.wsProjects.done) save.wsProjects.done={};
      if(!save.overheat||typeof save.overheat!=="object") save.overheat={on:false,wear:0,coolUntil:0};
      if(typeof save.wsKeys!=="number") save.wsKeys=0;
      if(typeof save.wsReforges!=="number") save.wsReforges=0;
      if(typeof save.bpCount!=="number") save.bpCount=0;
      for(const k of ["pantheon","darkShop","godArtifacts","chronoUps","metaAch"]) if(!save[k]) save[k]={};
      if(typeof save.quarksEver!=="number") save.quarksEver=save.quarks||0;
      if(typeof save.gaCount!=="number") save.gaCount=0;
      if(typeof save.chronoCrystals!=="number") save.chronoCrystals=0;
      if(!save.realities||typeof save.realities!=="object") save.realities={shards:0,worlds:{}};
      if(!save.realities.worlds) save.realities.worlds={};
      if(!save.singularity||typeof save.singularity!=="object") save.singularity={si:0,siEver:0,resets:0,ups:{}};
      if(!save.singularity.ups) save.singularity.ups={};
      if(typeof save.tokens!=="number") save.tokens=0;
      if(typeof save.shopGlobal!=="number") save.shopGlobal=0;
      if(!save.research||typeof save.research!=="object") save.research={active:null,until:0,done:{}};
      if(!save.research.done) save.research.done={};
      if(!save.shop||typeof save.shop!=="object") save.shop={offers:[],next:0};
      if(typeof save.prismsEver!=="number") save.prismsEver=0;
      if(typeof save.apMult!=="number") save.apMult=2;
      if(typeof save.corruption!=="number") save.corruption=0;
      if(!save.market) save.market={ ore:1, dust:1, gears:1, nextDrift:0, event:null };
      save.auto=Object.assign({ click:true, noobs:true, ups:true, mining:true, workshop:true, potions:false }, save.auto||{});
      if(typeof save.salvageBelow!=="number") save.salvageBelow=-1;
      if(typeof save.gearsEver!=="number") save.gearsEver=save.gears||0;
      if(typeof save.miners!=="number") save.miners=0;
      if(typeof save.ore!=="number") save.ore=0;
      if(typeof save.oreEver!=="number") save.oreEver=save.ore||0;
      if(typeof save.depth!=="number") save.depth=0;
      if(typeof save.digProg!=="number") save.digProg=0;
      if(typeof save.artifacts!=="number") save.artifacts=0;
      if(!Array.isArray(save.runes)) save.runes=[];
      save.admin=Object.assign({ oofMul:1, clickMul:1, costMul:1, prismMul:1, speed:1 }, save.admin||{});
    }
  }catch(e){ save=DEFAULT(); }
}
let saveTimer=0;
let wiping=false; // при полном сбросе не даём перезаписать пустое сохранение
function persist(){ if(wiping) return; try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
async function wipeSave(){
  wiping=true;
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  try{ localStorage.clear(); }catch(e){}
  // жёсткий сброс: чистим кэш и снимаем service worker, чтобы точно загрузилась свежая версия
  try{ if(window.caches){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } }catch(e){}
  try{ if(navigator.serviceWorker){ const rs=await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r=>r.unregister())); } }catch(e){}
  location.replace(location.pathname + "?r=" + Date.now());
}
function queueSave(){ saveTimer=1.2; }

/* ============ Производные характеристики ============ */
let D = {}; // derived
function recompute(){
  const m = { global:1, click:1, clickFromPs:0, crit:0, critPow:1.5, cost:1,
    prism:1, runeRegen:1, offline:0, autoClick:0, autoBuy:false, autoPrestige:false,
    _runePow:0, _runeLuck:0, _megaClick:0, _bonusSlots:0, _oreBoost:0, _allCur:0, _gearBoost:0, noob:{} };
  const cr = save.activeChallenge ? ((CHAL[save.activeChallenge]||{}).restrict||{}) : {};
  // обычные улучшения
  if(!cr.noUps){
    for(const id in save.ups){ if(save.ups[id] && UP[id]) UP[id].apply(m); }
    for(const u of INF_UPS){ const l=save.infUps[u.id]||0; if(l>0) u.apply(m,l,infQ(u.id)); }   // B
    for(const s of SYN_UPS){ if(save.synUps[s.id]) s.apply(m, s.val()); }                        // F
    for(const c of UP_CATS){ if(catComplete(c.id)) c.apply(m); }                                 // D
    for(const id in save.research.done){ if(save.research.done[id]&&RESEARCH_M[id]) applyResearch(RESEARCH_M[id].bonus,m); } // E
  }
  for(const t of TOKEN_UPS){ const l=save.tokenUps[t.id]||0; if(l>0) t.apply(m,l); }   // H — жетоны (вечные, не гейтятся испытанием)
  m.global *= (1+(save.shopGlobal||0));  // G — магазинные множители
  // призматические
  for(const p of PRISM_UPS){ const l=save.prismUps[p.id]||0; if(l>0 && p.apply) p.apply(m,l); }
  // звёздные
  for(const s of STAR_UPS){ const l=save.starUps[s.id]||0; if(l>0 && s.apply) s.apply(m,l); }
  // мастерская — усиливает уже вложенное в другие улучшения
  let prismLv=0; for(const k in save.prismUps) prismLv+=save.prismUps[k]||0;
  let starLv=0;  for(const k in save.starUps)  starLv+=save.starUps[k]||0;
  let noobUp=0;  for(const id in save.ups){ if(save.ups[id]&&UP[id]&&UP[id].kind==="noob") noobUp++; }
  const ctx={ prismLv, starLv, noobUp };
  for(const w of WORKSHOP_UPS){ const l=save.workshopUps[w.id]||0; if(l>0 && w.apply) w.apply(m,l,ctx); }
  // мастерская 2.0
  for(const ms of WS_MILE){ if((save.gearsEver||0)>=ms.at) applyWsBonus(ms.buff,m); }            // H — вехи
  m.global *= (1 + 0.03*wsLevel());                                                              // A — уровень верстака
  m.global *= (1 + 0.10*(save.wsReforges||0));                                                   // I — переоснастки
  if(save.wsProjects&&save.wsProjects.done) for(const id in save.wsProjects.done){ if(save.wsProjects.done[id]&&WS_PROJ_M[id]) applyWsBonus(WS_PROJ_M[id].bonus,m); } // B
  for(const bp of BLUEPRINTS){ const p=(save.blueprints[bp.id]||0)*bpPowMul(); if(p>0) applyWsBonus({[bp.kind]:p},m); } // C
  if(bpSetComplete()) m.global*=1.25;                                                            // C — сет-бонус
  for(const c of WS_CONV){ if(save.wsConveyors[c.id]) c.apply(m); }                              // G — конвейеры
  for(const w of WORKSHOP_UPS){ if((save.workshopUps[w.id]||0)>0){ const sb=wsStarBonus(w.id); if(sb>0) m.global*=(1+sb); } } // F — звёзды
  for(const k of WS_KEY_UPS){ const l=save.wsKeyUps[k.id]||0; if(l>0) k.apply(m,l); }            // I — ключ-улучшения
  // пыльцевые улучшения (пыль → основная характеристика)
  for(const d of DUST_UPS){ const l=save.dustUps[d.id]||0; if(l>0) d.apply(m,l); }
  // достижения — вечные бонусы
  let ag=0,ac=0,ap=0,arp=0;
  for(const a of ACHS){ if(save.achieved[a.id]){ const b=a.buff; ag+=b.global||0; ac+=b.click||0; ap+=b.prism||0; arp+=b.runePow||0; } }
  m.global*=(1+ag); m.click*=(1+ac); m.prism*=(1+ap); m._runePow+=arp;
  // награды за пройденные испытания (вечные)
  for(const c of CHALLENGES){ if(save.chalDone[c.id]){ const r=c.reward;
    if(r.global) m.global*=(1+r.global); if(r.click) m.click*=(1+r.click); if(r.cost) m.cost*=(1-r.cost); } }
  // питомцы (вечные бонусы)
  for(const p of PETS){ const l=save.pets[p.id]||0; if(l>0) p.apply(m,l); }
  // зелья (временные баффы)
  const now=Date.now();
  for(const p of POTIONS){ if((save.potions[p.id]||0)>now){ const b=p.buff;
    if(b.global) m.global*=b.global; if(b.click) m.click*=b.click;
    if(b.luck) m._runeLuck+=b.luck; if(b.ore) m._oreBoost+=(b.ore-1); } }
  // мутанты (вечные)
  for(const x of MUTANTS){ if(save.mutants[x.id] && x.apply) x.apply(m); }
  // кварки (трансценденция) + Пантеон-синергии
  for(const q of QUARK_UPS){ const l=save.quarkUps[q.id]||0; if(l>0 && q.apply) q.apply(m,l); }
  // улучшения искажения
  for(const c of CORR_UPS){ const l=save.corrUps[c.id]||0; if(l>0 && c.apply) c.apply(m,l); }
  // дебафф искажения
  if(save.corruption>0) m.global /= (1+save.corruption*0.4);
  /* ---- МЕТА-СЛОИ ---- */
  for(const p of PANTHEON){ const l=save.pantheon[p.id]||0; if(l>0 && p.apply) p.apply(m,l); }        // A — Пантеон
  for(const ms of TRANS_MILE){ if((save.transcends||0)>=ms.at) applyMetaBonus(ms.buff,m); }            // C — вехи транса
  for(const z of CORR_ZONES){ if((save.corruption||0)>=z.at) applyMetaBonus(z.buff,m); }               // D — искажённые зоны
  for(const d of DARK_SHOP){ if(save.darkShop[d.id] && d.apply) d.apply(m); }                          // E — тёмная лавка
  for(const a of GOD_ARTIS){ const p=save.godArtifacts[a.id]||0; if(p>0 && a.kind!=="quarkGain") applyMetaBonus({[a.kind]:p},m); } // F — артефакты
  if(gaSetComplete()) m.global*=1.3;                                                                   // F — сет богов
  for(const c of CHRONO_UPS){ const l=save.chronoUps[c.id]||0; if(l>0 && c.apply) c.apply(m,l); }      // G — хроно-улучшения
  for(const w of REALITY_WORLDS){ if(save.realities.worlds[w.id] && w.apply) w.apply(m); }             // H — миры
  for(const ac of META_ACH){ if(save.metaAch[ac.id]) applyMetaBonus(ac.buff,m); }                      // I — мета-достижения
  for(const s of SI_UPS){ const l=save.singularity.ups[s.id]||0; if(l>0 && s.apply) s.apply(m,l); }    // J — сингулярность
  m.global *= (1 + 0.5*(save.singularity.resets||0));                                                  // J — множитель за сброс
  // престиж: сила престижа (D) + вехи (B) + реликвии (C)
  const ppow=prestigePower(); m.global*=ppow; D.prestigePow=ppow;
  for(const ms of PRESTIGE_MS){ if((save.prestiges||0)>=ms.at){ if(ms.g)m.global*=(1+ms.g); if(ms.p)m.prism*=(1+ms.p); if(ms.slots)m._bonusSlots+=ms.slots; } }
  for(const tid in save.relics){ const rt=RELIC_T[tid]; if(rt) rt.apply(m, relicValue(tid, save.relics[tid])); }
  D.allCurMul = 1 + (m._allCur||0);
  // кросс-улучшения за призмы (шахта/мастерская)
  for(const c of CROSS_UPS){ const l=save.crossUps[c.id]||0; if(l>0) c.apply(m,l); }
  // шахта: руда усиливает основную экономику
  let oreMul=1, miningGlob=1;
  for(const mu of MINING_UPS){ const l=save.miningUps[mu.id]||0; if(l>0){ if(mu.rate) oreMul*=mu.rate(l); if(mu.glob) miningGlob*=mu.glob(l); } }
  oreMul *= (1 + Math.max(0, m._oreBoost));
  m.global *= miningGlob;
  D.oreRate = (save.miners||0)*MINER_RATE*oreMul;
  // глубина/пласты: множитель добычи + вечные бонусы пластов и находок
  const dep=save.depth||0, si=stratumIndex(dep);
  D.depthMul=(1+dep*0.05)*(1+si*0.4); D.stratumIdx=si;
  D.oreRate *= D.depthMul;
  m.global *= (1 + si*0.1 + (save.artifacts||0)*0.01);
  D.autoMiner = (save.miningUps.auto||0)>0;
  // руны (усиливаются резонансом/крепежом)
  const rp = 1 + Math.max(0, m._runePow);
  if(!cr.noRunes){
    for(const r of save.runes){ if(!r) continue;
      RTYPE[r.type].apply(m, runeValue(r)*rp*masteryMul(r.type));   // осн. эффект (звёзды/мастерство внутри)
      if(r.subs) for(const s of r.subs){ if(RTYPE[s.t]) RTYPE[s.t].apply(m, s.v*rp); }  // сабстаты
    }
    m.global *= slotSets().mult;   // сет-бонусы
  }
  // G — кодекс: вечный бонус за увиденные редкости (не зависит от экипировки)
  let codex=0; for(const t of RUNE_TYPES){ const s=save.runeSeen[t.id]; if(s!==undefined) codex+=0.01*(s+1); }
  m.global*=(1+codex); D.codexBonus=codex;
  // мощь толпы: тап растёт от числа видов нубов
  let ownedTypes=0; for(const nb of NOOBS){ if((save.noobs[nb.id]||0)>0) ownedTypes++; }
  m.click *= (1 + m._megaClick*ownedTypes);
  // ограничения испытания
  if(cr.costX) m.cost*=cr.costX;
  if(cr.weak) m.global/=cr.weak;
  // админ-множители
  const a=save.admin||{};
  m.global *= (a.oofMul||1); m.click *= (a.clickMul||1);
  m.cost *= (a.costMul||1); m.prism *= (a.prismMul||1);

  // нубы: множители m.noob + ранги + вехи (крит/тап — ДО финализации D) + синергии
  const cnt={}; for(const nb of NOOBS) cnt[nb.id]=save.noobs[nb.id]||0;
  const nm={}; let allBonus=0;
  for(const nb of NOOBS){
    let mult=(m.noob[nb.id]||1) * rankMult(save.ranks[nb.id]||0);
    for(const ms of NOOB_MILESTONES){ if(cnt[nb.id]>=ms.at){
      if(ms.type==="self") mult*=ms.val;
      else if(ms.type==="all") allBonus+=ms.val;
      else if(ms.type==="crit") m.crit+=ms.val;
      else if(ms.type==="click") m.click*=ms.val;
    }}
    nm[nb.id]=mult;
  }
  // синергия: вышестоящий вид бустит соседа снизу, если открыта веха
  for(let i=1;i<NOOBS.length;i++){ if(cnt[NOOBS[i].id]>=SYN_AT) nm[NOOBS[i-1].id]*=(1+SYN_PCT*cnt[NOOBS[i].id]); }
  D.noobEff=nm; D.noobAllBonus=allBonus;

  D.global=m.global; D.click=m.click; D.clickFromPs=m.clickFromPs;
  D.crit=Math.min(m.crit,1); D.critPow=m.critPow; D.costMul=Math.max(m.cost,0.02);
  D.prismMul=m.prism; D.runeRegen=m.runeRegen; D.offline=m.offline;
  D.autoClick=m.autoClick; D.autoBuy=m.autoBuy; D.autoPrestige=m.autoPrestige; D.noobMul=m.noob;
  D.runeLuck=Math.max(0, m._runeLuck);
  D.slots = 3 + (save.prismUps.slots||0) + Math.max(0, m._bonusSlots);

  // Oof/с
  let ops=0;
  for(const nb of NOOBS){ if(cnt[nb.id]>0) ops += cnt[nb.id]*nb.prod*nm[nb.id]; }
  ops *= m.global*(1+allBonus);
  if(cr.noPassive) ops=0;
  D.ops=ops;
  D.clickBase = (1*m.click + ops*m.clickFromPs) * m.global;

  // фарм шестерёнок (открыт после первого престижа)
  D.gearRate = save.prestiges>=1
    ? 0.05*(1 + 0.2*save.prestiges + save.stars)*(1 + (save.workshopUps.wrate||0)*0.2)
      *(1+m._gearBoost)*wsLevelMul()*wsOverheatFactor()
    : 0;
  // тёмная валюта: генерится при искажении, пропорц. дебаффу и производству
  let darkPen=1; for(const d of DARK_SHOP){ if(save.darkShop[d.id]&&d.darkPen) darkPen*=(1-d.darkPen); }
  D.corrRate = save.corruption>0 ? save.corruption*0.05*(1+Math.max(0,Math.log10(1+Math.max(0,D.ops))))*corrDarkMul()*darkPen : 0;
}

function noobCost(id, owned){ return NOOB[id].base * Math.pow(COST_MUL, owned) * D.costMul; }
function prismGain(total){ // призмы за престиж
  if(total < 1e6) return 0;
  return Math.floor(Math.pow(total/1e6, 0.5) * D.prismMul * (D.allCurMul||1) * (1+runGoalBonus()));
}
function starGain(prisms){
  if(prisms < 500) return 0;
  return Math.floor(Math.pow(prisms/500, 0.6) * (D.allCurMul||1));
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
function buyRank(id){
  const nb=NOOB[id], r=save.ranks[id]||0;
  if(r>=MAX_RANK) return;
  const owned=save.noobs[id]||0, req=rankReq(r), cost=rankCost(nb,r);
  if(owned<req){ toast("Нужно "+fmt(req)+" во владении"); return; }
  if(save.oof<cost){ toast("Не хватает Oof на ранг"); return; }
  save.oof-=cost; save.ranks[id]=r+1;
  recompute(); renderNoobs(); refreshTop(); queueSave();
  toast(nb.icon+" "+nb.name+" → ранг "+(r+1)+"!");
}
function buyUp(id){
  const u=UP[id]; if(!u||save.ups[id]) return;
  if(save.oof < u.cost) return;
  save.oof-=u.cost; save.ups[id]=true;
  checkCatComplete(u.kind);
  recompute(); renderUps(); refreshTop(); queueSave();
  toast("⚡ "+u.name);
}
// D — награда жетонами за первое завершение категории
function checkCatComplete(kind){
  const cid=upCatOf[kind]; if(!cid) return;
  if(!save._catDone) save._catDone={};
  if(!save._catDone[cid] && catComplete(cid)){ save._catDone[cid]=1; save.tokens=(save.tokens||0)+5; toast("⭐ Категория пройдена! +5 🎟️"); }
}
/* B — бесконечные */
function buyInf(id){ const u=INF_UP[id], l=save.infUps[id]||0, cost=infCost(u,l); if(save.oof<cost) return;
  save.oof-=cost; save.infUps[id]=l+1; recompute(); renderInf(); refreshTop(); queueSave(); }
function buyInfMax(id){ const u=INF_UP[id]; let n=0; while(n<2000){ const l=save.infUps[id]||0,c=infCost(u,l); if(save.oof<c)break; save.oof-=c; save.infUps[id]=l+1; n++; }
  if(n){ recompute(); renderInf(); refreshTop(); queueSave(); toast("♾️ +"+n+" ур."); } }
function rerollInf(id){ const cost=infRerollCost(id); if(save.dust<cost){ toast("Нужно "+fmt(cost)+" пыли"); return; }
  save.dust-=cost; save.infQuality[id]=0.8+Math.random()*0.7; recompute(); renderInf(); refreshTop(); queueSave();
  toast("🎲 Качество: ×"+save.infQuality[id].toFixed(2)); }
/* F — синергии */
function buySyn(id){ const s=SYN_UP[id]; if(save.synUps[id]||save.oof<s.cost) return;
  save.oof-=s.cost; save.synUps[id]=true; recompute(); renderSyn(); refreshTop(); queueSave(); toast("💡 "+s.name); }
/* E — исследования */
function startResearch(id){ const r=RESEARCH_M[id];
  if(researchDone(id)||save.research.active||!researchReqMet(r)||save.oof<r.cost) return;
  save.oof-=r.cost; save.research.active=id; save.research.until=Date.now()+r.time*1000;
  renderResearch(); refreshTop(); queueSave(); toast("🔬 Начато: "+r.name); }
function tickResearch(){ const R=save.research; if(R.active && Date.now()>=R.until){ const id=R.active;
  R.done[id]=1; R.active=null; R.until=0; recompute(); refreshTop(); if(curSub==="research") renderResearch(); toast("🔬 Готово: "+RESEARCH_M[id].name); queueSave(); }
  else if(curSub==="research" && R.active) updateResearchTimer(); }
/* H — жетоны */
function buyTokenUp(id){ const t=TOKEN_UP[id], l=save.tokenUps[id]||0; if(l>=t.max) return; const cost=t.cost(l);
  if((save.tokens||0)<cost) return; save.tokens-=cost; save.tokenUps[id]=l+1; recompute(); renderTokens(); refreshTop(); queueSave(); }
/* G — магазин */
function buyShop(i){ const o=save.shop.offers[i]; if(!o) return; if(save.oof<o.cost){ toast("Мало Oof"); return; }
  save.oof-=o.cost;
  if(o.type==="global"){ save.shopGlobal=(save.shopGlobal||0)+o.v; toast("🎲 +"+Math.round(o.v*100)+"% Oof/с навсегда"); }
  else if(o.type==="ore"){ save.ore+=o.v; save.oreEver=(save.oreEver||0)+o.v; toast("🎲 +"+fmt(o.v)+" руды"); }
  else if(o.type==="dust"){ save.dust+=o.v; toast("🎲 +"+fmt(o.v)+" пыли"); }
  else if(o.type==="prism"){ save.prisms+=o.v; save.prismsEver=(save.prismsEver||0)+o.v; toast("🎲 +"+fmt(o.v)+" призм"); }
  save.shop.offers[i]=null; recompute(); renderShop(); refreshTop(); queueSave(); }
function rerollShop(){ refreshShop(true); renderShop(); queueSave(); }

/* ---- Руны ---- */
function rollRune(){
  if(save.energy<1){ toast("Нет энергии рун"); return; }
  save.energy--;
  const rar=pickRarity(), type=RUNE_TYPES[Math.floor(Math.random()*RUNE_TYPES.length)];
  const r={ type:type.id, rar:rar, lvl:1, star:0, subs:genSubs(rar) };
  // E — мастерство типа копится с каждого ролла
  save.runeMastery[type.id]=(save.runeMastery[type.id]||0)+1;
  // G — кодекс: запоминаем макс. редкость по типу
  if((save.runeSeen[type.id]||-1) < rar) save.runeSeen[type.id]=rar;
  // авто-распыл рун ниже выбранной редкости
  if(save.salvageBelow>=0 && rar<save.salvageBelow){
    scrapRune(r); updateRuneLive(); queueSave(); return;
  }
  showDrop(r);
  queueSave();
}
function pickRarity(){
  const luck=1+(D.runeLuck||0);
  const w=RARITIES.map((r,i)=> r.w*Math.pow(luck,i)); // удача сильнее двигает к редким
  const tot=w.reduce((s,x)=>s+x,0); let x=Math.random()*tot;
  for(let i=0;i<w.length;i++){ x-=w[i]; if(x<=0) return i; }
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
  recompute(); renderRunes(); if(detailIdx===i) renderRuneDetail(); refreshTop(); queueSave();
}

/* ---- Престиж ---- */
function doPrestige(auto){
  recompute();
  const g=prismGain(save.totalOof);
  if(g<1) return;
  const wasUnlocked = save.prestiges>=1;
  save.prisms+=g; save.prestiges++;
  save.prismsEver=(save.prismsEver||0)+g;
  save.tokens=(save.tokens||0)+1; // H — жетон за престиж
  // Реликвия — шанс дропа за сброс
  if(Math.random()<relicChance()) dropRelic();
  // Мастерская: шестерёнки за престиж
  const conv=0.5+(save.workshopUps.wconv||0)*0.25;
  const gg=Math.floor(g*conv); if(gg>0){ save.gears+=gg; save.gearsEver=(save.gearsEver||0)+gg; }
  // C — шанс дропа чертежа за престиж (растёт после открытия мастерской)
  if(wasUnlocked && Math.random()<0.5) dropBlueprint();
  softReset();
  recompute(); syncNoobSprites();
  toast("💎 +"+fmt(g)+" призм"+(gg>0?"  ·  ⚙️ +"+fmt(gg):"")+(!wasUnlocked?"  ·  ⚙️ Мастерская открыта!":""));
  if(!auto) switchTab("prestige");
  renderAll(); refreshTop(); persist();
}
function buyPrismUp(id){
  const p=PRISM_UP[id]; const l=save.prismUps[id]||0;
  if(l>=p.max || !prismReqMet(id)) return;
  const cost=p.cost(l);
  if(save.prisms<cost) return;
  save.prisms-=cost; save.prismUps[id]=l+1;
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function buyCrossUp(id){
  const c=CROSS_UP[id], l=save.crossUps[id]||0; if(l>=c.max) return;
  const cost=c.cost(l); if(save.prisms<cost) return;
  save.prisms-=cost; save.crossUps[id]=l+1;
  recompute(); if(c.tab==="mining")renderMining(); else renderWorkshop(); refreshTop(); queueSave();
}
function crossRow(c){
  const l=save.crossUps[c.id]||0, maxed=l>=c.max, cost=c.cost(l);
  const row=document.createElement("div"); row.className="buyrow"; row.dataset.crossup=c.id;
  row.innerHTML=upRowHTML(c.icon, c.name+" "+(l>0?"("+l+")":""), c.desc(l), l, c.max, maxed?"МАКС":"💎 "+fmt(cost), "prism");
  if(!maxed) row.addEventListener("click", ()=>buyCrossUp(c.id));
  return row;
}
function crossLive(sel){
  document.querySelectorAll(sel+" [data-crossup]").forEach(row=>{
    const c=CROSS_UP[row.dataset.crossup], l=save.crossUps[c.id]||0; if(l>=c.max) return;
    const cost=c.cost(l); row.classList.toggle("afford",save.prisms>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.prisms<cost);
  });
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
function doTranscend(auto){
  const g=quarkGain(save.stars); if(g<1) return;
  save.quarks+=g; save.quarksEver=(save.quarksEver||0)+g; save.transcends=(save.transcends||0)+1;
  const keep=Math.floor(save.stars*(save.quarkUps.qkeep||0)*0.03);
  save.stars=keep; save.prisms=0; save.prismUps={}; save.starUps={};
  if(Math.random()<0.6) dropGodArtifact(); // F — шанс дропа артефакта
  softReset(); recompute(); syncNoobSprites(); checkMetaAch();
  toast("⚛️ +"+fmt(g)+" кварков!"); if(!auto){ if(curTab!=="meta") switchTab("meta"); } renderAll(); refreshTop(); persist();
}
function quarkReqMet(q){ return !q.req || q.req(); }
function buyQuarkUp(id){
  const q=QUARK_UP[id], l=save.quarkUps[id]||0; if(l>=q.max || !quarkReqMet(q)) return;
  const cost=q.cost(l); if(save.quarks<cost) return;
  save.quarks-=cost; save.quarkUps[id]=l+1;
  recompute(); if(curTab==="meta") renderQuarkTree(); refreshTop(); queueSave();
}
function setCorruption(d){
  save.corruption=Math.max(0,Math.min(50,(save.corruption||0)+d));
  recompute(); if(curTab==="meta") renderCorr(); refreshTop(); queueSave();
}
function buyCorrUp(id){
  const c=CORR_UP[id], l=save.corrUps[id]||0; if(l>=c.max) return;
  const cost=c.cost(l); if(save.corr<cost) return;
  save.corr-=cost; save.corrUps[id]=l+1;
  recompute(); if(curTab==="meta") renderCorr(); refreshTop(); queueSave();
}
function buyWorkshopUp(id){
  const w=WORKSHOP_UP[id]; const l=save.workshopUps[id]||0;
  if(l>=w.max) return;
  const cost=w.cost(l);
  if(save.gears<cost) return;
  save.gears-=cost; save.workshopUps[id]=l+1;
  recompute(); renderWorkshop(); refreshTop(); queueSave();
}
function dropRelic(){
  const t=RELIC_TYPES[Math.floor(Math.random()*RELIC_TYPES.length)];
  const rar=pickRarity();
  const cur=save.relics[t.id];
  if(cur===undefined || rar>cur){ save.relics[t.id]=rar;
    toast("✨ Реликвия: "+t.name+" — "+RARITIES[rar].name+(cur===undefined?"":" (лучше!)")); }
  else { save.prisms+=Math.ceil((rar+1)*(save.prestiges>10?3:1)); } // дубликат → тихий рефанд призм
}
function renderRunGoals(){
  const box=$("runGoals"); if(!box) return; box.innerHTML="";
  RUN_GOALS.forEach(g=>{
    const done=g.done();
    const el=document.createElement("div"); el.className="run-goal"+(done?" done":"");
    el.innerHTML=`<span class="rg-ico">${done?"✅":"⬜"}</span><span class="rg-txt">${g.icon} ${g.text}</span><span class="rg-bonus">+${Math.round(g.bonus*100)}%</span>`;
    box.appendChild(el);
  });
}
function setApMult(d){ save.apMult=Math.max(1.5,Math.min(20,(save.apMult||2)+d)); updatePrestigeLive(); queueSave(); }
function renderRelics(){
  const box=$("relicGrid"); if(!box) return; box.innerHTML="";
  RELIC_TYPES.forEach(t=>{
    const has=save.relics[t.id]!==undefined, rar=has?save.relics[t.id]:-1;
    const el=document.createElement("div");
    el.className="relic"+(has?(" filled "+RARITIES[rar].cls):" empty");
    el.innerHTML=has
      ? `<div class="r-ico">${t.icon}</div><div class="r-name">${RARITIES[rar].name}</div><div class="r-eff">${t.fmt(relicValue(t.id,rar))}</div>`
      : `<div class="r-ico">❔</div><div class="r-name">${t.name}</div><div class="r-eff dim">не найдена</div>`;
    box.appendChild(el);
  });
}
function softReset(){
  // Наследие нубов — оставляем часть армии
  const keep=(save.prismUps.keepnoob||0)*0.03;
  let kept={};
  if(keep>0){ for(const id in save.noobs){ const c=Math.floor((save.noobs[id]||0)*keep); if(c>0) kept[id]=c; } }
  save.oof=startOof(save.prismUps.start||0);
  // мета-стартовый капитал: B qstart + J siKeep
  const qs=save.quarkUps.qstart||0; if(qs>0) save.oof+=Math.pow(10,2+qs);
  const sk=save.singularity?(save.singularity.ups.siKeep||0):0; if(sk>0) save.oof+=Math.pow(10,3+sk);
  save.totalOof=save.oof; save.noobs=kept; save.ups={};
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
  // руда копится оффлайн (шахтёры работают всегда)
  if(D.oreRate>0){ const o=D.oreRate*dt; save.ore+=o; save.oreEver=(save.oreEver||0)+o; }
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
function prestigeTier(){
  if((save.transcends||0)>0) return 4;
  if((save.stars||0)>0 || (save.ascends||0)>0) return 3;
  if((save.prestiges||0)>=50) return 2;
  if((save.prestiges||0)>=10) return 1;
  return 0;
}
function auraColor(t){ return ["255,210,63","255,184,77","255,120,60","124,243,255","192,108,255"][t]||"255,210,63"; }
function drawHero(){
  const h=hero(); const tier=prestigeTier();
  const s=1+Math.sin(heroPulse)*0.03 + (heroClick>0?heroClick*0.12:0);
  ctx.save();
  ctx.translate(h.x,h.y);
  ctx.scale(s,s);
  // аура — цвет и размер растут со слоем престижа
  const ac=auraColor(tier), ar=1.7+tier*0.2, ai=0.22+tier*0.05;
  const glow=ctx.createRadialGradient(0,0,h.r*0.3,0,0,h.r*ar);
  glow.addColorStop(0,"rgba("+ac+","+ai+")"); glow.addColorStop(1,"rgba("+ac+",0)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(0,0,h.r*ar,0,6.29); ctx.fill();
  drawNoobBody(0,0,h.r,"#ffd23f");
  // корона появляется и растёт с престижем
  if(tier>=1){ ctx.font=(h.r*(0.78+tier*0.12))+"px serif"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
    ctx.fillText(tier>=3?"👑":"🤴", 0, -h.r*0.96); }
  ctx.restore();
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
  if(D.autoClick>0 && save.auto.click!==false){ save._acc=(save._acc||0)+D.autoClick*edt;
    while(save._acc>=1){ save._acc--; const a=D.clickBase; gainOof(a); save.lifetimeClicks++; }
  }
  // энергия рун
  const emax=D.slots+2;
  if(save.energy<emax){ save.energy=Math.min(emax, save.energy + edt/(60/D.runeRegen)); }
  // авто-покупка нубов
  if(D.autoBuy && save.auto.noobs!==false){ autoBuyTick(); }
  // автоматизация процессов (улучшения/шахта/цех/зелья)
  runAutomation(edt);
  // фарм шестерёнок мастерской
  if(D.gearRate>0){ const g=D.gearRate*edt; save.gears+=g; save.gearsEver=(save.gearsEver||0)+g; }
  tickOverheat(edt); tickWsProjects();
  // добыча руды в шахте
  if(D.oreRate>0){ const o=D.oreRate*edt; save.ore+=o; save.oreEver=(save.oreEver||0)+o; }
  // спуск вглубь (бур)
  if((save.miners||0)>0){
    save.digProg=(save.digProg||0)+digRate()*edt;
    let need=depthNeed(save.depth||0), guard=0, changed=false;
    while(save.digProg>=need && guard<300){ save.digProg-=need; descendCore(); changed=true; need=depthNeed(save.depth||0); guard++; }
    if(changed){ recompute(); if(curTab==="mining") updateMiningLive(); }
  }
  // тёмная валюта искажения
  if(D.corrRate>0){ const cc=D.corrRate*edt; save.corr+=cc; save.corrEver=(save.corrEver||0)+cc; }
  if(D.autoMiner){ mnTimer+=edt; if(mnTimer>=0.5){ mnTimer=0; const c=minerCost();
    if(save.oof>=c && save.oof-c>c*0.5){ save.oof-=c; save.miners++; recompute(); } } }
  // авто-престиж (звёздный автопилот)
  if(D.autoPrestige){ apTimer+=edt; if(apTimer>=4){ apTimer=0;
    const g=prismGain(save.totalOof), thr=save.prisms*((save.apMult||2)-1)+1;
    if(g>=1 && g>=thr){ doPrestige(true); } } }
  // мета-автопилоты: вознесение / трансценденция (C-веха, J-siAuto)
  const fullAuto = (save.singularity.ups.siAuto||0)>0;
  if(metaUnlocked("autoAscend") || fullAuto){ asTimer+=edt; if(asTimer>=6){ asTimer=0;
    if(starGain(save.prisms)>=Math.max(1,save.stars*0.15)) doAscend(); } }
  if(((save.quarkUps.qauto||0)>0 || fullAuto) && save.stars>=1000){ tsTimer+=edt; if(tsTimer>=8){ tsTimer=0;
    if(quarkGain(save.stars)>=Math.max(1,save.quarks*0.1)) doTranscend(true); } }
  // мета-достижения + хроно-кристаллы
  metaTimer+=edt; if(metaTimer>=2){ metaTimer=0; checkMetaAch(); tickChrono(); }
  // испытания: проверка цели
  if(save.activeChallenge){ const c=CHAL[save.activeChallenge]; if(c && save.totalOof>=c.goal) completeChallenge(); }
  // взрывной нуб-мутант
  if(save.mutants.boom){ boomTimer+=edt; if(boomTimer>=60){ boomTimer=0; const bz=D.ops*3600;
    if(bz>0){ gainOof(bz); toast("💥 Взрыв нуба: +"+fmt(bz)+" Oof"); } } }
  // хроно-биржа: дрейф курсов
  driftMarket();
  // карманная реальность: тик портала (реальное время)
  tickPortal(dt);

  render(dt);
  if(curTab==="workshop") drawWsScene(dt);

  // периодические обновления UI (не каждый кадр)
  uiAcc+=dt;
  tickResearch();
  if(uiAcc>0.12){ uiAcc=0; refreshTop(); refreshLive(); checkAchievements(); tickPotions(); updateChalLive(); refreshShop(); if(mutOpen) updateMutLive(); }
  saveTimer-=dt; if(saveTimer<0 && saveTimer>-1){ saveTimer=-2; persist(); }
  save.lastTime=Date.now();
  requestAnimationFrame(loop);
}
let uiAcc=0;
let abTimer=0;
let apTimer=0;
let mnTimer=0;
let boomTimer=0;
let asTimer=0, tsTimer=0, metaTimer=0;
// G — хроно-кристаллы: капают на рыночных событиях + авто-трейд
function tickChrono(){ const mk=save.market; if(mk.event && Date.now()<mk.event.until){
    save.chronoCrystals=(save.chronoCrystals||0)+1;
    if((save.chronoUps.chAuto||0)>0){ const res=mk.event.res; if(res&&(save[res]||0)>0) sellRes(res); }
  } }
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
// безопасная привязка: не падаем, если элемента нет (напр. рассинхрон кэша)
function on(id, ev, fn){ const el=$(id); if(el) el.addEventListener(ev, fn); }
function refreshTop(){
  $("oofVal").textContent=fmt(save.oof);
  $("opsVal").textContent=fmt(D.ops||0);
  $("prismVal").textContent=fmt(save.prisms);
  if(save.stars>0 || save.ascends>0){ $("starWrap").classList.remove("hidden"); $("starVal").textContent=fmt(save.stars); }
  if(save.quarks>0 || save.transcends>0){ $("quarkWrap").classList.remove("hidden"); $("quarkVal").textContent=fmt(save.quarks); }
  if(save.prestiges>0 || save.gears>0){
    $("gearWrap").classList.remove("hidden"); $("gearVal").textContent=fmt(save.gears);
    $("tabWorkshop").classList.remove("hidden");
  }
  if(save.prestiges>=2 || save.miners>0 || save.ore>0){
    $("tabMining").classList.remove("hidden");
  }
  if(save.prestiges>=3 || Object.keys(save.pets).length || Object.keys(save.potions).length){
    $("tabAlchemy").classList.remove("hidden");
  }
  if(save.stars>=1000 || save.transcends>0 || save.quarks>0 || (save.singularity&&save.singularity.resets>0)){
    $("tabMeta").classList.remove("hidden");
  }
  if(save.prestiges>=2 || save.activeChallenge || Object.keys(save.chalDone).length){
    $("chalBtn").classList.remove("hidden");
  }
  if(save.prestiges>=2){ $("mktBtn").classList.remove("hidden"); }
  if(save.prestiges>=3 || Object.keys(save.mutants).length){ $("mutBtn").classList.remove("hidden"); }
  if(save.transcends>0 || save.corruption>0 || save.corr>0){ $("portalBtn").classList.remove("hidden"); }
  if(AUTOS.some(a=>a.unlock())){ $("autoBtn").classList.remove("hidden"); }
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
  else if(curTab==="ups") refreshSubLive();
  else if(curTab==="prestige") updatePrestigeLive();
  else if(curTab==="runes") updateRuneLive();
  else if(curTab==="workshop") wsRefreshLive();
  else if(curTab==="mining") updateMiningLive();
  else if(curTab==="alchemy") updateAlchemyLive();
  else if(curTab==="meta") metaRefreshLive();
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
    row.className="buyrow noobcard"; row.dataset.noob=nb.id; row.dataset.idx=i;
    row.innerHTML=
      `<div class="nc-top">
         <div class="buy-ico">${nb.icon}</div>
         <div class="buy-main">
           <div class="buy-name">${nb.name}<span class="rankbadge" data-rank></span> <span class="buy-cnt" data-cnt>${owned}</span></div>
           <div class="buy-desc" data-prod></div>
         </div>
         <div class="buy-right"><div class="buy-cost" data-cost></div><div class="buy-prod">+${fmt(nb.prod)} Oof/с</div></div>
       </div>
       <div class="nc-foot">
         <div class="nc-ms"><div class="nc-msbar"><div data-msfill></div></div><span class="nc-mstext" data-ms></span></div>
         <button class="nc-rank" data-rankbtn></button>
       </div>`;
    const top=row.querySelector(".nc-top");
    top.addEventListener("click", ()=>buyNoob(nb.id));
    let pt; top.addEventListener("pointerdown", ()=>{ pt=setTimeout(()=>buyMax(nb.id),500); });
    top.addEventListener("pointerup", ()=>clearTimeout(pt));
    top.addEventListener("pointerleave", ()=>clearTimeout(pt));
    row.querySelector("[data-rankbtn]").addEventListener("click", e=>{ e.stopPropagation(); buyRank(nb.id); });
    box.appendChild(row);
  });
  updateNoobLive();
}
function nextMilestone(owned){ for(const ms of NOOB_MILESTONES){ if(owned<ms.at) return ms; } return null; }
function updateNoobLive(){
  recompute();
  document.querySelectorAll("#noobList .noobcard").forEach(row=>{
    const id=row.dataset.noob, idx=+row.dataset.idx, nb=NOOB[id];
    const owned=save.noobs[id]||0, rank=save.ranks[id]||0;
    const cost=noobCost(id,owned), afford=save.oof>=cost;
    row.classList.toggle("afford",afford); row.classList.toggle("locked",!afford&&owned===0);
    row.querySelector("[data-cnt]").textContent=fmt(owned);
    // ранг-бейдж
    const rb=row.querySelector("[data-rank]"); rb.textContent=rank>0?(" ★"+rank):""; rb.title=rank>0?("×"+(1+rank)+" к нубу"):"";
    // производство + синергия
    const cur=owned*nb.prod*(D.noobEff[id]||1)*D.global*(1+(D.noobAllBonus||0));
    let desc = owned>0? ("даёт "+fmt(cur)+" Oof/с") : (nb.name+" делает Oof сам");
    if(idx>0 && owned>=SYN_AT){ desc += " · ↑ +"+Math.round(SYN_PCT*owned*100)+"% «"+NOOBS[idx-1].name+"»"; }
    row.querySelector("[data-prod]").textContent=desc;
    const ce=row.querySelector("[data-cost]"); ce.textContent="🪙 "+fmt(cost); ce.classList.toggle("cant",!afford);
    // веха
    const ms=nextMilestone(owned), fill=row.querySelector("[data-msfill]"), mt=row.querySelector("[data-ms]");
    if(ms){ const prev=[...NOOB_MILESTONES].reverse().find(x=>x.at<=owned); const lo=prev?prev.at:0;
      fill.style.width=Math.min(100,(owned-lo)/(ms.at-lo)*100)+"%";
      mt.textContent="Веха "+fmt(ms.at)+": "+msLabel(ms, idx>0?NOOBS[idx-1].name:"—"); }
    else { fill.style.width="100%"; mt.textContent="Все вехи взяты ✓"; }
    // кнопка ранга
    const rk=row.querySelector("[data-rankbtn]"), req=rankReq(rank), rc=rankCost(nb,rank);
    if(rank>=MAX_RANK){ rk.textContent="★ Ранг МАКС"; rk.className="nc-rank maxed"; }
    else if(owned<req){ rk.textContent="⬆ Ранг "+(rank+1)+": нужно "+fmt(req); rk.className="nc-rank need"; }
    else { rk.textContent="⬆ Ранг "+(rank+1)+" · 🪙"+fmt(rc); rk.className="nc-rank"+(save.oof>=rc?" ready":" cant"); }
  });
}

/* ---- Улучшения ---- */
let curSub="normal";
function switchSub(sub){ curSub=sub;
  document.querySelectorAll("#upSubs button").forEach(b=>b.classList.toggle("on",b.dataset.sub===sub));
  document.querySelectorAll('.tabpage[data-page="ups"] [data-subp]').forEach(p=>p.classList.toggle("hidden", p.dataset.subp!==sub));
  renderSub();
}
function renderSub(){
  if(curSub==="normal")renderUps(); else if(curSub==="inf")renderInf(); else if(curSub==="syn")renderSyn();
  else if(curSub==="research")renderResearch(); else if(curSub==="tokens")renderTokens(); else if(curSub==="shop")renderShop();
}
function refreshSubLive(){
  if(curSub==="normal")updateUpLive(); else if(curSub==="inf")updateInfLive();
  else if(curSub==="syn")renderSyn(); else if(curSub==="research")updateResearchTimer();
  else if(curSub==="tokens")updateTokenLive();
}
function renderCatBar(){
  const box=$("catBar"); if(!box) return; box.innerHTML="";
  UP_CATS.forEach(c=>{ const ups=catUps(c.id), have=ups.filter(u=>save.ups[u.id]).length, done=have>=ups.length;
    const el=document.createElement("div"); el.className="cat-chip"+(done?" done":"");
    el.textContent=c.name+" "+have+"/"+ups.length+(done?" ✓":"");
    el.title=(done?"Пройдено: ":"Заверши → ")+c.bonusText;
    box.appendChild(el); });
}
/* B — бесконечные */
function infEffText(u,l,q){ const v=u.per*l*q; if(u.kind==="crit") return "+"+(v*100).toFixed(1)+"% крит"; if(u.kind==="click") return "тап ×"+(1+v).toFixed(2); return "всё ×"+(1+v).toFixed(2); }
function renderInf(){
  const box=$("infList"); if(!box) return; box.innerHTML="";
  INF_UPS.forEach(u=>{ const l=save.infUps[u.id]||0, q=infQ(u.id);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.inf=u.id;
    row.innerHTML=`<div class="buy-ico">${u.icon}</div>
      <div class="buy-main"><div class="buy-name">${u.name} <span class="buy-cnt">ур.${l}</span>${q!==1?' <span class="dim">×'+q.toFixed(2)+'</span>':''}</div>
        <div class="buy-desc">${infEffText(u,l,q)} · удержи для x-макс</div></div>
      <div class="buy-right"><div class="buy-cost" data-cost></div><button class="nc-rank" data-reroll>🎲💠</button></div>`;
    row.addEventListener("click", ()=>buyInf(u.id));
    let pt; row.addEventListener("pointerdown",()=>{pt=setTimeout(()=>buyInfMax(u.id),500);}); row.addEventListener("pointerup",()=>clearTimeout(pt)); row.addEventListener("pointerleave",()=>clearTimeout(pt));
    row.querySelector("[data-reroll]").addEventListener("click", e=>{ e.stopPropagation(); rerollInf(u.id); });
    box.appendChild(row); });
  updateInfLive();
}
function updateInfLive(){
  document.querySelectorAll("#infList .buyrow").forEach(row=>{ const u=INF_UP[row.dataset.inf]; if(!u) return;
    const l=save.infUps[u.id]||0, cost=infCost(u,l), afford=save.oof>=cost;
    row.classList.toggle("afford",afford);
    const ce=row.querySelector("[data-cost]"); ce.textContent="🪙 "+fmt(cost); ce.classList.toggle("cant",!afford);
    const rr=row.querySelector("[data-reroll]"); if(rr) rr.textContent="🎲💠"+fmt(infRerollCost(u.id));
  });
}
/* F — синергии */
function renderSyn(){
  const box=$("synList"); if(!box) return; box.innerHTML="";
  SYN_UPS.forEach(s=>{ const owned=save.synUps[s.id], afford=save.oof>=s.cost;
    const row=document.createElement("div"); row.className="buyrow"+(owned||afford?" afford":"");
    row.innerHTML=`<div class="buy-ico">${s.icon}</div>
      <div class="buy-main"><div class="buy-name">${s.name}${owned?' ✓':''}</div><div class="buy-desc">${s.desc()}</div></div>
      <div class="buy-right"><div class="buy-cost ${(!owned&&!afford)?'cant':''}">${owned?'активна':'🪙 '+fmt(s.cost)}</div></div>`;
    if(!owned) row.addEventListener("click", ()=>buySyn(s.id));
    box.appendChild(row); });
}
/* E — исследования */
function renderResearch(){
  const act=$("researchActive"), R=save.research;
  if(R.active){ const r=RESEARCH_M[R.active]; act.innerHTML=`<div class="ra-name">🔬 ${r.name}</div><div class="ra-bar"><div id="raFill"></div></div><div class="ra-time" id="raTime"></div>`; updateResearchTimer(); }
  else act.innerHTML='<div class="dim" style="text-align:center;padding:6px">Нет активного исследования</div>';
  const box=$("researchList"); box.innerHTML="";
  RESEARCH.forEach(r=>{ const done=researchDone(r.id), reqOk=researchReqMet(r), active=R.active===r.id;
    const row=document.createElement("div"); row.className="buyrow"+(done?" afford":"")+((reqOk||done||active)?"":" locked");
    let right;
    if(done) right='<div class="buy-cost" style="color:var(--green)">✓</div>';
    else if(active) right='<div class="buy-cost dim">идёт…</div>';
    else if(!reqOk) right='<div class="buy-cost">🔒</div>';
    else right='<button class="nc-rank ready" data-start="'+r.id+'">🔬 🪙'+fmt(r.cost)+'</button>';
    row.innerHTML=`<div class="buy-ico">${r.icon}</div>
      <div class="buy-main"><div class="buy-name">${r.name}</div><div class="buy-desc">${r.desc} · ${(r.time/60).toFixed(1)}мин</div></div>
      <div class="buy-right">${right}</div>`;
    box.appendChild(row); });
  box.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startResearch(b.dataset.start)));
}
function updateResearchTimer(){ const R=save.research; if(!R.active) return; const r=RESEARCH_M[R.active];
  const left=Math.max(0,(R.until-Date.now())/1000), f=1-left/r.time;
  const fill=$("raFill"), tt=$("raTime"); if(fill) fill.style.width=Math.min(100,f*100)+"%"; if(tt) tt.textContent=Math.ceil(left)+"с осталось"; }
/* H — жетоны */
function renderTokens(){
  const tv=$("tokenVal"); if(tv) tv.textContent=fmt(save.tokens||0);
  const box=$("tokenList"); if(!box) return; box.innerHTML="";
  TOKEN_UPS.forEach(t=>{ const l=save.tokenUps[t.id]||0, maxed=l>=t.max, cost=t.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.token=t.id;
    row.innerHTML=upRowHTML(t.icon, t.name+" "+(l>0?"("+l+")":""), t.desc(l), l, t.max, maxed?"МАКС":"🎟️ "+fmt(cost), "token");
    if(!maxed) row.addEventListener("click", ()=>buyTokenUp(t.id));
    box.appendChild(row); });
  updateTokenLive();
}
function updateTokenLive(){
  const tv=$("tokenVal"); if(tv) tv.textContent=fmt(save.tokens||0);
  document.querySelectorAll("#tokenList .buyrow").forEach(row=>{ const t=TOKEN_UP[row.dataset.token]; const l=save.tokenUps[t.id]||0;
    if(l>=t.max) return; const cost=t.cost(l); row.classList.toggle("afford",(save.tokens||0)>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",(save.tokens||0)<cost); });
}
/* G — магазин */
function renderShop(){
  refreshShop();
  const bar=$("shopBar"); if(!bar) return; const left=Math.max(0,(save.shop.next-Date.now())/1000);
  bar.innerHTML=`Обновление через ~${Math.ceil(left/60)}мин · <button class="adm-btn" id="shopReroll">🎲 Обновить</button>`;
  const rb=bar.querySelector("#shopReroll"); if(rb) rb.addEventListener("click", rerollShop);
  const box=$("shopList"); box.innerHTML="";
  save.shop.offers.forEach((o,i)=>{
    const row=document.createElement("div"); row.className="buyrow";
    if(!o){ row.classList.add("locked"); row.innerHTML=`<div class="buy-ico">✅</div><div class="buy-main"><div class="buy-name dim">куплено</div></div>`; box.appendChild(row); return; }
    const afford=save.oof>=o.cost; row.classList.toggle("afford",afford);
    row.innerHTML=`<div class="buy-ico">🎁</div><div class="buy-main"><div class="buy-name">${o.label}</div></div>
      <div class="buy-right"><div class="buy-cost ${afford?'':'cant'}">🪙 ${fmt(o.cost)}</div></div>`;
    row.addEventListener("click", ()=>buyShop(i));
    box.appendChild(row); });
}
function renderUps(){
  renderCatBar();
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
function renderSalvage(){
  const box=$("salvagePick"); if(!box) return; box.innerHTML="";
  const opts=[{v:-1,l:"Выкл"}].concat(RARITIES.slice(1).map((r,i)=>({v:i+1,l:r.name})));
  opts.forEach(o=>{
    const b=document.createElement("button");
    b.className="salv-btn"+(save.salvageBelow===o.v?" on":"");
    b.textContent=o.l;
    b.addEventListener("click", ()=>{ save.salvageBelow=o.v; renderSalvage(); queueSave();
      toast(o.v<0?"Авто-распыл выкл":"Распыляю ниже: "+o.l); });
    box.appendChild(b);
  });
}
function renderRuneSets(){
  const box=$("runeSets"); if(!box) return;
  const s=slotSets(), items=[];
  if(s.mono>0)     items.push("🔗 Моно-тип ×"+s.maxSame+": +"+Math.round(s.mono*100)+"%");
  if(s.spectrum>0) items.push("🌈 Полный спектр: +"+Math.round(s.spectrum*100)+"%");
  if(s.league>0)   items.push("🏆 Высшая лига: +"+Math.round(s.league*100)+"%");
  box.innerHTML = items.length ? ("✦ "+items.join("  ·  ")) : "Сет-бонусы: собери руны одного типа или все ≥ эпических";
  box.classList.toggle("active", items.length>0);
}
function renderRunes(){
  renderSalvage();
  renderRuneSets();
  renderDustUps();
  $("slotInfo").textContent="("+save.runes.filter(Boolean).length+"/"+D.slots+")";
  $("dustVal").textContent=fmt(save.dust);
  const box=$("runeSlots"); box.innerHTML="";
  for(let i=0;i<D.slots;i++){
    const r=save.runes[i];
    const el=document.createElement("div");
    if(!r){ el.className="rune empty"; el.innerHTML=`<div class="r-ico">➕</div><div class="r-name">пусто</div>`;
      box.appendChild(el); continue; }
    const t=RTYPE[r.type], rar=RARITIES[r.rar], val=runeValue(r);
    el.className="rune filled "+rar.cls;
    el.innerHTML=`<div class="r-ico">${t.icon}</div>
      <div class="r-name">${rar.name}${(r.star||0)>0?' <span class="r-star">'+'★'.repeat(r.star)+'</span>':''}</div>
      <div class="r-eff">${t.fmt(val)}</div>
      <div class="r-lvl">ур.${r.lvl}${r.subs&&r.subs.length?' · '+r.subs.length+' саб':''}</div>`;
    el.addEventListener("click", ()=>openRuneDetail(i));
    box.appendChild(el);
  }
  updateRuneLive();
}
function fuseTarget(r){ for(let i=0;i<D.slots;i++){ const s=save.runes[i]; if(s&&s.type===r.type&&s.rar===r.rar&&(s.star||0)<RUNE_MAX_STAR) return i; } return -1; }
/* ---- детали руны: уровень / сабы / перекат типа ---- */
let detailIdx=-1;
function openRuneDetail(i){ if(!save.runes[i]) return; detailIdx=i; renderRuneDetail(); $("runeDetailModal").classList.remove("hidden"); }
function renderRuneDetail(){
  const r=save.runes[detailIdx]; if(!r){ $("runeDetailModal").classList.add("hidden"); return; }
  const t=RTYPE[r.type], rar=RARITIES[r.rar];
  const c=$("rdCard"); c.className="rune-drop "+rar.cls;
  const subsHtml=(r.subs&&r.subs.length)? r.subs.map(s=>`<div class="rd-sub">${RTYPE[s.t].icon} ${RTYPE[s.t].fmt(s.v)}</div>`).join("") : '<div class="dim">нет сабстатов</div>';
  c.innerHTML=`<div class="d-ico">${t.icon}</div><div class="d-rar">${rar.name}${(r.star||0)>0?' '+'★'.repeat(r.star):''}</div>
    <div class="d-name">${t.name}</div><div class="d-eff">${t.fmt(runeValue(r))}</div>
    <div class="rd-subs"><div class="dim" style="font-size:11px;margin-bottom:4px">Сабстаты:</div>${subsHtml}</div>`;
  $("rdUp").textContent="⬆ Ур."+(r.lvl)+" (💠 "+fmt(runeUpCost(r))+")";
  $("rdSubs").textContent="🎲 Сабы (💠 "+fmt(rerollSubCost(r))+")";
  $("rdType").textContent="🔁 Тип (💠 "+fmt(rerollTypeCost(r))+")";
}
function rerollSubs(i){ const r=save.runes[i]; if(!r) return; const cost=rerollSubCost(r);
  if(save.dust<cost){ toast("Нужно "+fmt(cost)+" пыли"); return; }
  save.dust-=cost; r.subs=genSubs(r.rar); recompute(); renderRunes(); renderRuneDetail(); refreshTop(); queueSave(); }
function rerollType(i){ const r=save.runes[i]; if(!r) return; const cost=rerollTypeCost(r);
  if(save.dust<cost){ toast("Нужно "+fmt(cost)+" пыли"); return; }
  save.dust-=cost; r.type=RUNE_TYPES[Math.floor(Math.random()*RUNE_TYPES.length)].id;
  recompute(); renderRunes(); renderRuneDetail(); refreshTop(); queueSave(); toast("🔁 Новый тип: "+RTYPE[r.type].name); }
function updateRuneLive(){
  const emax=D.slots+2;
  $("energyVal").textContent=Math.floor(save.energy);
  $("energyMax").textContent=emax;
  $("energyFill").style.width=Math.min(100,save.energy/emax*100)+"%";
  $("rollBtn").disabled = save.energy<1;
  document.querySelectorAll("#dustUpList .buyrow").forEach(row=>{
    const d=DUST_UP[row.dataset.dup]; const l=save.dustUps[d.id]||0; if(l>=d.max) return;
    const cost=d.cost(l); row.classList.toggle("afford",save.dust>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.dust<cost);
  });
}

/* руна-дроп модалка */
let pendingRune=null;
function showDrop(r){
  pendingRune=r;
  const t=RTYPE[r.type], rar=RARITIES[r.rar], val=runeValue(r);
  const subsHtml=(r.subs&&r.subs.length)? '<div class="rd-subs">'+r.subs.map(s=>`<div class="rd-sub">${RTYPE[s.t].icon} ${RTYPE[s.t].fmt(s.v)}</div>`).join("")+'</div>' : "";
  const card=$("dropCard"); card.className="rune-drop "+rar.cls;
  card.innerHTML=`<div class="d-ico">${t.icon}</div><div class="d-rar">${rar.name}</div>
    <div class="d-name">${t.name}</div><div class="d-eff">${t.fmt(val)}</div>${subsHtml}`;
  const ft=fuseTarget(r);
  const fb=$("fuseBtn"); fb.classList.toggle("hidden", ft<0);
  if(ft>=0) fb.textContent="⭐ Слить (★"+((save.runes[ft].star||0)+1)+")";
  $("slotPick").classList.add("hidden");
  $("runeModal").classList.remove("hidden");
  updateRuneLive();
}
function closeDrop(){ $("runeModal").classList.add("hidden"); pendingRune=null; }
on("equipBtn","click", ()=>{
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
on("scrapBtn","click", ()=>{ if(pendingRune){ scrapRune(pendingRune); closeDrop(); } });
on("fuseBtn","click", ()=>{ if(!pendingRune) return; const ft=fuseTarget(pendingRune); if(ft<0) return;
  const s=save.runes[ft]; s.star=(s.star||0)+1;
  recompute(); renderRunes(); refreshTop(); closeDrop(); queueSave();
  toast("⭐ Слияние! "+RTYPE[s.type].name+" "+"★".repeat(s.star)); });
// детали руны
on("rdUp","click", ()=>{ if(detailIdx>=0) upRune(detailIdx); });
on("rdSubs","click", ()=>{ if(detailIdx>=0) rerollSubs(detailIdx); });
on("rdType","click", ()=>{ if(detailIdx>=0) rerollType(detailIdx); });
on("rdClose","click", ()=>{ detailIdx=-1; $("runeDetailModal").classList.add("hidden"); });
on("runeDetailModal","click", e=>{ if(e.target.id==="runeDetailModal"){ detailIdx=-1; $("runeDetailModal").classList.add("hidden"); } });
// кодекс рун
function renderCodex(){
  const box=$("codexList"); box.innerHTML="";
  RUNE_TYPES.forEach(t=>{
    const lvl=masteryLevel(t.id), seen=save.runeSeen[t.id];
    const seenTxt = seen!==undefined ? RARITIES[seen].name : "не найдена";
    const el=document.createElement("div"); el.className="codex-row"+(seen!==undefined?" seen":"");
    el.innerHTML=`<div class="cx-ico">${t.icon}</div>
      <div class="cx-main"><div class="cx-name">${t.name}</div>
        <div class="cx-sub">лучшая: ${seenTxt}</div></div>
      <div class="cx-mast">мастер. ${lvl}<span class="dim"> (+${lvl*5}%)</span></div>`;
    box.appendChild(el);
  });
  const total=document.createElement("div"); total.className="codex-total";
  total.textContent="Бонус кодекса: +"+Math.round((D.codexBonus||0)*100)+"% ко всему";
  box.appendChild(total);
}
on("codexBtn","click", ()=>{ $("menuModal").classList.add("hidden"); recompute(); renderCodex(); $("codexModal").classList.remove("hidden"); });
on("codexClose","click", ()=>$("codexModal").classList.add("hidden"));
on("codexModal","click", e=>{ if(e.target.id==="codexModal") $("codexModal").classList.add("hidden"); });

/* ---- Престиж ---- */
function renderPrestige(){
  // призма
  const g=prismGain(save.totalOof);
  $("prismGain").textContent=fmt(g);
  renderRelics();
  renderRunGoals();
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
  for(const [br,label] of PRISM_BRANCHES){
    const items=PRISM_UPS.filter(p=>PRISM_BRANCH[p.id]===br);
    if(!items.length) continue;
    const h=document.createElement("div"); h.className="branch-lab"; h.textContent=label; pbox.appendChild(h);
    items.forEach(p=>{
      const l=save.prismUps[p.id]||0, maxed=l>=p.max, cost=p.cost(l);
      const rq=PRISM_REQ[p.id], locked=rq && (save.prismUps[rq.id]||0)<rq.lvl;
      const row=document.createElement("div"); row.className="buyrow"+(locked?" locked":""); row.dataset.prismup=p.id;
      const costTxt = locked ? ("🔒 «"+PRISM_UP[rq.id].name+"» ур."+rq.lvl) : (maxed?"МАКС":"💎 "+fmt(cost));
      row.innerHTML=upRowHTML(p.icon,p.name+" "+(l>0?"("+l+(p.max<50?"/"+p.max:"")+")":""),p.desc(l),l,p.max,costTxt,"prism");
      if(!maxed && !locked) row.addEventListener("click", ()=>buyPrismUp(p.id));
      pbox.appendChild(row);
    });
  }
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
  // сила престижа + вехи
  const pp=$("prestigePower"); if(pp) pp.textContent="⚡ Сила престижа: ×"+fmt(D.prestigePow||1)+"  ·  "+fmt(save.prismsEver||0)+" 💎 за всё время";
  // цели забега
  renderRunGoals();
  const gb=$("goalBonus"); if(gb){ const b=runGoalBonus(); gb.textContent=b>0?("+"+Math.round(b*100)+"% к призмам"):""; }
  // контроль авто-престижа
  const apc=$("apCtrl"); if(apc){ apc.classList.toggle("hidden", !D.autoPrestige); $("apMultVal").textContent=(save.apMult||2); }
  const nextMs=PRESTIGE_MS.find(x=>(save.prestiges||0)<x.at);
  const mb=$("prestigeMsBar"), mn=$("msNext");
  if(mb){ const prev=[...PRESTIGE_MS].reverse().find(x=>(save.prestiges||0)>=x.at); const lo=prev?prev.at:0;
    const div=mb.firstElementChild;
    if(nextMs){ if(div) div.style.width=Math.min(100,((save.prestiges||0)-lo)/(nextMs.at-lo)*100)+"%";
      if(mn) mn.textContent=(save.prestiges||0)+"/"+nextMs.at+" → "+prestigeMsText(nextMs); }
    else { if(div) div.style.width="100%"; if(mn) mn.textContent="все вехи взяты ✓ ("+(save.prestiges||0)+")"; }
  }
  const need=1e6;
  const prog=Math.min(100, Math.pow(save.totalOof/need,0.5)*100/1); // грубый прогресс к 1-й призме
  $("prismProg").style.width=Math.min(100, save.totalOof<need? save.totalOof/need*100 : 100)+"%";
  $("prismNote").textContent = g<1? ("До первой призмы: "+fmt(Math.max(0,need-save.totalOof))+" Oof") : ("Готов сбросить за "+fmt(g)+" 💎");
  // цены доступность
  document.querySelectorAll("#prismUpList .buyrow").forEach(row=>{
    const p=PRISM_UP[row.dataset.prismup]; const l=save.prismUps[p.id]||0;
    if(l>=p.max || !prismReqMet(p.id)) return; const cost=p.cost(l);
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

/* ============ МЕТА-ВКЛАДКА ============ */
let metaSub="trans";
function metaSwitchSub(sub){ metaSub=sub;
  document.querySelectorAll("#metaSubs button").forEach(b=>b.classList.toggle("on",b.dataset.msub===sub));
  document.querySelectorAll('.tabpage[data-page="meta"] [data-msp]').forEach(p=>p.classList.toggle("hidden",p.dataset.msp!==sub));
  metaRenderSub();
}
function metaRenderSub(){
  if(metaSub==="trans") renderTrans();
  else if(metaSub==="pantheon") renderPantheon();
  else if(metaSub==="corr") renderCorr();
  else if(metaSub==="chrono") renderChrono();
  else if(metaSub==="realities") renderRealities();
  else if(metaSub==="codex") renderCodex();
  else if(metaSub==="singularity") renderSingularity();
}
function metaRefreshLive(){
  if(metaSub==="trans"){ const qg=quarkGain(save.stars), tb=$("transBtn");
    if(tb){ tb.disabled=qg<1; $("quarkGain").textContent=fmt(qg);
      $("transNote").textContent=qg<1?("Нужно 1000 звёзд (есть "+fmt(save.stars)+")"):"Сброс ради кварков · шанс артефакта"; }
    document.querySelectorAll("#quarkUpList .buyrow").forEach(row=>{ const q=QUARK_UP[row.dataset.qup]; if(!q)return; const l=save.quarkUps[q.id]||0;
      if(l>=q.max||!quarkReqMet(q)) return; const cost=q.cost(l); row.classList.toggle("afford",save.quarks>=cost);
      const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.quarks<cost); });
  } else if(metaSub==="corr"){ const cn=$("corrNote");
    if(cn) cn.textContent=(save.corruption||0)>0?("Выработка ÷"+(1+save.corruption*0.4).toFixed(1)+" · тёмная +"+fmt(D.corrRate||0)+"/с"):"Подними уровень, чтобы копить ⚫";
    const cv=$("corrVal"); if(cv) cv.textContent=fmt(save.corr); const cl=$("corrLvl"); if(cl) cl.textContent=save.corruption||0;
  } else if(metaSub==="chrono"){ const cvv=$("chronoVal"); if(cvv) cvv.textContent=fmt(save.chronoCrystals||0);
  } else if(metaSub==="singularity"){ const g=siGain(); const b=$("singularityBtn"); if(b) b.disabled=g<1;
    const sg=$("siGain"); if(sg) sg.textContent=fmt(g); const sh=$("siHave"); if(sh) sh.textContent=fmt(save.singularity.si||0); }
}
// ⚛️ Трансценденция + кварк-древо (B) + вехи (C)
function renderTrans(){
  const qg=quarkGain(save.stars), tb=$("transBtn");
  if(tb){ tb.disabled=qg<1; } $("quarkGain").textContent=fmt(qg);
  $("transNote").textContent=qg<1?("Нужно 1000 звёзд (есть "+fmt(save.stars)+")"):"Сброс ради кварков · шанс артефакта";
  const mb=$("transMileBar"); if(mb){ mb.innerHTML="";
    TRANS_MILE.forEach(ms=>{ const got=(save.transcends||0)>=ms.at; const el=document.createElement("div");
      el.className="cat-chip"+(got?" done":""); el.textContent=ms.icon+" "+ms.at+(got?"✓":""); el.title=ms.name+" · "+ms.txt; mb.appendChild(el); }); }
  renderQuarkTree();
}
function renderQuarkTree(){
  const qbox=$("quarkUpList"); if(!qbox) return; qbox.innerHTML="";
  QUARK_UPS.forEach(q=>{ const l=save.quarkUps[q.id]||0, maxed=l>=q.max, ok=quarkReqMet(q), cost=q.cost(l);
    const row=document.createElement("div"); row.className="buyrow"+(ok?"":" locked"); row.dataset.qup=q.id;
    const costTxt = maxed?"МАКС":(ok?("⚛️ "+fmt(cost)):"🔒");
    row.innerHTML=upRowHTML(q.icon,q.name+" "+(l>0?"("+l+(q.max<50?"/"+q.max:"")+")":""),q.desc(l),l,q.max,costTxt,"quark");
    if(!maxed&&ok) row.addEventListener("click",()=>buyQuarkUp(q.id)); qbox.appendChild(row); });
}
// 🏛️ Пантеон (A)
function renderPantheon(){
  const box=$("pantheonList"); if(!box) return; box.innerHTML="";
  PANTHEON.forEach(p=>{ const l=save.pantheon[p.id]||0, maxed=l>=p.max, ok=pantheonReq(p), cost=p.cost(l);
    const row=document.createElement("div"); row.className="buyrow"+(ok?"":" locked"); row.dataset.pan=p.id;
    const costTxt = maxed?"МАКС":(ok?("⚛️ "+fmt(cost)):"🔒 25 ур.");
    row.innerHTML=upRowHTML(p.icon,p.name+" "+(l>0?"("+l+"/"+p.max+")":""),p.desc(l),l,p.max,costTxt,"quark");
    if(!maxed&&ok) row.addEventListener("click",()=>buyPantheon(p.id)); box.appendChild(row); });
  document.querySelectorAll("#pantheonList .buyrow").forEach(row=>{ const p=PANTHEON_M[row.dataset.pan]; const l=save.pantheon[p.id]||0;
    if(l>=p.max||!pantheonReq(p)) return; row.classList.toggle("afford",save.quarks>=p.cost(l)); });
}
// ⚫ Искажение 2.0 (D) + тёмная лавка (E)
function renderCorr(){
  $("corrLvl").textContent=save.corruption||0; $("corrVal").textContent=fmt(save.corr);
  const zb=$("corrZoneBar"); if(zb){ zb.innerHTML="";
    CORR_ZONES.forEach(z=>{ const on=(save.corruption||0)>=z.at; const el=document.createElement("div");
      el.className="cat-chip"+(on?" done":""); el.textContent=z.icon+" "+z.at+(on?"✓":""); el.title=z.name+" · "+z.txt+" · ×"+z.darkMul+" тёмной"; zb.appendChild(el); }); }
  const cbox=$("corrUpList"); cbox.innerHTML="";
  CORR_UPS.forEach(c=>{ const l=save.corrUps[c.id]||0, maxed=l>=c.max, cost=c.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.cup=c.id;
    row.innerHTML=upRowHTML(c.icon,c.name+" "+(l>0?"("+l+(c.max<50?"/"+c.max:"")+")":""),c.desc(l),l,c.max,maxed?"МАКС":"⚫ "+fmt(cost),"corr");
    if(!maxed) row.addEventListener("click",()=>buyCorrUp(c.id)); cbox.appendChild(row); });
  renderDarkShop();
}
function renderDarkShop(){
  const box=$("darkShopList"); if(!box) return; box.innerHTML="";
  DARK_SHOP.forEach(d=>{ const owned=save.darkShop[d.id], afford=(save.corr||0)>=d.cost;
    const row=document.createElement("div"); row.className="buyrow"+(owned||afford?" afford":"");
    row.innerHTML=`<div class="buy-ico">${d.icon}</div>
      <div class="buy-main"><div class="buy-name">${d.name}${owned?' ✓':''}</div><div class="buy-desc">${d.desc}</div></div>
      <div class="buy-right"><div class="buy-cost corr ${(!owned&&!afford)?'cant':''}">${owned?'активно':'⚫ '+fmt(d.cost)}</div></div>`;
    if(!owned) row.addEventListener("click",()=>buyDark(d.id)); box.appendChild(row); });
}
// ⏳ Хроно-биржа 2.0 (G)
function renderChrono(){
  const cv=$("chronoVal"); if(cv) cv.textContent=fmt(save.chronoCrystals||0);
  const ev=$("chronoEvent"), mk=save.market;
  if(ev){ if(mk.event&&Date.now()<mk.event.until){ ev.textContent="📢 "+mk.event.text; ev.classList.remove("hidden"); } else { ev.textContent="Рынок спокоен · жди события для 💎⏳"; } }
  const box=$("chronoMarket"); if(box){ box.innerHTML="";
    MARKET_RES.forEach(r=>{ const price=marketPrice(r.id), have=save[r.id]||0;
      const row=document.createElement("div"); row.className="buyrow";
      row.innerHTML=`<div class="buy-ico">${r.icon}</div>
        <div class="buy-main"><div class="buy-name">${r.name} <span class="dim">💱${fmt(price)}/шт</span></div><div class="buy-desc">В наличии: ${fmt(have)}</div></div>
        <div class="buy-right"><button class="nc-rank" data-sell="${r.id}">Продать</button></div>`;
      row.querySelector("[data-sell]").addEventListener("click",e=>{ e.stopPropagation(); sellRes(r.id); renderChrono(); });
      box.appendChild(row); });
  }
  const ubox=$("chronoUpList"); if(ubox){ ubox.innerHTML="";
    CHRONO_UPS.forEach(c=>{ const l=save.chronoUps[c.id]||0, maxed=l>=c.max, cost=c.cost(l);
      const row=document.createElement("div"); row.className="buyrow"; row.dataset.chu=c.id;
      row.innerHTML=upRowHTML(c.icon,c.name+" "+(l>0?"("+l+"/"+c.max+")":""),c.desc(l),l,c.max,maxed?"МАКС":"💎⏳ "+fmt(cost),"quark");
      if(!maxed) row.addEventListener("click",()=>buyChronoUp(c.id)); ubox.appendChild(row); });
    document.querySelectorAll("#chronoUpList .buyrow").forEach(row=>{ const c=CHRONO_UP_M[row.dataset.chu]; const l=save.chronoUps[c.id]||0;
      if(l>=c.max) return; row.classList.toggle("afford",(save.chronoCrystals||0)>=c.cost(l)); }); }
}
// 🌀 Реальности (H)
function renderRealities(){
  const sv=$("shardVal"); if(sv) sv.textContent=fmt(save.realities.shards||0);
  const rc=$("realCount"); if(rc) rc.textContent=realityExplored()+"/"+REALITY_WORLDS.length;
  const box=$("realityList"); if(!box) return; box.innerHTML="";
  REALITY_WORLDS.forEach(w=>{ const owned=save.realities.worlds[w.id], ok=!w.req||w.req(), afford=(save.realities.shards||0)>=w.cost;
    const row=document.createElement("div"); row.className="buyrow"+(owned?" afford":(ok?"":" locked"));
    const right = owned?'<div class="buy-cost" style="color:var(--green)">✓</div>':(ok?('<div class="buy-cost key '+(afford?'':'cant')+'">🔹 '+w.cost+'</div>'):'<div class="buy-cost">🔒 4 мира</div>');
    row.innerHTML=`<div class="buy-ico">${w.icon}</div>
      <div class="buy-main"><div class="buy-name">${w.name}</div><div class="buy-desc">${w.desc}</div></div>
      <div class="buy-right">${right}</div>`;
    if(!owned&&ok) row.addEventListener("click",()=>unlockWorld(w.id)); box.appendChild(row); });
}
// 🌟 Кодекс (I)
function renderCodex(){
  $("codexCount").textContent=metaAchDone(); $("codexTotal").textContent=META_ACH.length;
  const box=$("codexList"); if(!box) return; box.innerHTML="";
  META_ACH.forEach(a=>{ const done=save.metaAch[a.id];
    const el=document.createElement("div"); el.className="ach-card"+(done?" done":"");
    const bt=a.buff.global?("+"+Math.round(a.buff.global*100)+"% всего"):(a.buff.click?("+"+Math.round(a.buff.click*100)+"% тап"):(a.buff.prism?("+"+Math.round(a.buff.prism*100)+"% призм"):""));
    el.innerHTML=`<div class="a-ico">${a.icon}</div><div class="a-name">${a.name}</div><div class="a-desc">${a.desc}</div><div class="a-buff">${done?bt:"🔒"}</div>`;
    box.appendChild(el); });
}
// ♾️ Сингулярность (J)
function renderSingularity(){
  const g=siGain(); const S=save.singularity;
  $("siGain").textContent=fmt(g); $("siHave").textContent=fmt(S.si||0); $("siResets").textContent=S.resets||0;
  const b=$("singularityBtn"); if(b) b.disabled=g<1;
  $("siNote").textContent = g<1 ? ("Нужно 10 трансценденций (есть "+(save.transcends||0)+")") : "Сбросит призмы/звёзды/кварки/пантеон/искажение/мастерскую";
  const box=$("siUpList"); if(!box) return; box.innerHTML="";
  SI_UPS.forEach(s=>{ const l=S.ups[s.id]||0, maxed=l>=s.max, cost=s.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.siu=s.id;
    row.innerHTML=upRowHTML(s.icon,s.name+" "+(l>0?"("+l+(s.max<50?"/"+s.max:"")+")":""),s.desc(l),l,s.max,maxed?"МАКС":"♾️ "+fmt(cost),"si");
    if(!maxed) row.addEventListener("click",()=>buySiUp(s.id)); box.appendChild(row); });
  document.querySelectorAll("#siUpList .buyrow").forEach(row=>{ const s=SI_UP_M[row.dataset.siu]; const l=S.ups[s.id]||0;
    if(l>=s.max) return; row.classList.toggle("afford",(S.si||0)>=s.cost(l)); });
}

/* ---- Мастерская ---- */
let wsSub="normal";
function wsSwitchSub(sub){ wsSub=sub;
  document.querySelectorAll("#wsSubs button").forEach(b=>b.classList.toggle("on",b.dataset.wsub===sub));
  document.querySelectorAll('.tabpage[data-page="workshop"] [data-wsp]').forEach(p=>p.classList.toggle("hidden",p.dataset.wsp!==sub));
  wsRenderSub();
}
function wsRenderSub(){
  renderWsFarm(); renderWsLevel();
  if(wsSub==="normal") renderWorkshop();
  else if(wsSub==="proj") renderWsProjects();
  else if(wsSub==="bp") renderWsBlueprints();
  else if(wsSub==="conv") renderWsConveyors();
  else if(wsSub==="reforge") renderWsReforge();
}
function wsRefreshLive(){
  renderWsFarm();
  if(wsSub==="normal") updateWorkshopLive();
  else if(wsSub==="proj") updateWsProjTimer();
  else if(wsSub==="conv") renderWsConveyors();
}
// J-часть + E — шапка фарма со сценой и перегревом
function renderWsFarm(){
  const gb=$("gearBig"); if(gb) gb.textContent=fmt(save.gears);
  const rt=$("gearRateTxt"); if(rt) rt.textContent="+"+fmt(D.gearRate||0)+" ⚙️/с";
  const o=save.overheat||{}; const cooling=o.coolUntil>Date.now();
  const btn=$("overheatBtn");
  if(btn){ btn.textContent = cooling ? "🧊 Обслуживание…" : (o.on?"🔥 Форсаж ВКЛ":"🔥 Форсаж");
    btn.classList.toggle("on",!!o.on&&!cooling); }
  const wf=$("wearFill"); if(wf){ wf.style.width=Math.min(100,o.wear||0)+"%"; wf.classList.toggle("hot",(o.wear||0)>75||cooling); }
  const wt=$("wearTxt"); if(wt) wt.textContent = cooling ? ("перегрев · "+Math.ceil((o.coolUntil-Date.now())/1000)+"с") : ("износ "+Math.round(o.wear||0)+"%"+(o.on?" · ×3":""));
}
// A/H — уровень верстака + вехи
function renderWsLevel(){
  const lv=wsLevel(), next=wsNextMile();
  const lt=$("wsLevelTxt"); if(lt) lt.textContent="Верстак ур."+lv+(save.wsReforges?(" · ♻️"+save.wsReforges):"");
  const bar=$("wsLevelFill"), nt=$("wsLevelNext");
  if(bar&&nt){ if(next){ const prev=[...WS_MILE].reverse().find(x=>x.at<=(save.gearsEver||0)); const lo=prev?prev.at:0;
      bar.style.width=Math.min(100,((save.gearsEver||0)-lo)/(next.at-lo)*100)+"%";
      nt.textContent="След.: "+next.icon+" "+next.name+" @ "+fmt(next.at)+" ⚙️ ("+next.txt+")"; }
    else { bar.style.width="100%"; nt.textContent="Все вехи взяты ✓"; } }
  const chips=$("wsMileBar"); if(chips){ chips.innerHTML="";
    WS_MILE.forEach(ms=>{ const got=(save.gearsEver||0)>=ms.at; const el=document.createElement("div");
      el.className="cat-chip"+(got?" done":""); el.textContent=ms.icon+(got?" ✓":""); el.title=ms.name+" · "+ms.txt+" @ "+fmt(ms.at)+" ⚙️"; chips.appendChild(el); }); }
}
function renderWorkshop(){
  renderWsFarm();
  const box=$("workshopList"); box.innerHTML="";
  if(save.prestiges>=1) CROSS_UPS.filter(c=>c.tab==="workshop").forEach(c=>box.appendChild(crossRow(c)));
  WORKSHOP_UPS.forEach(w=>{
    const l=save.workshopUps[w.id]||0, maxed=l>=w.max, cost=w.cost(l), st=wsStar(w.id), q=wsQ(w.id);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.wup=w.id;
    const stars = l>0 ? ('<span class="ws-stars" title="Звёзды модуля">'+"★".repeat(st)+"☆".repeat(5-st)+(q!==1?' <span class="dim">×'+q.toFixed(2)+'</span>':'')+'</span>') : '';
    row.innerHTML=`<div class="buy-ico">${w.icon}</div>
      <div class="buy-main"><div class="buy-name">${w.name} ${l>0?'<span class="buy-cnt">'+l+(w.max<50?"/"+w.max:"")+'</span>':''} ${stars}</div>
        <div class="buy-desc">${w.desc(l)}</div></div>
      <div class="buy-right"><div class="buy-cost gear" data-cost>${maxed?"МАКС":"⚙️ "+fmt(cost)}</div>
        ${l>0?'<div class="ws-mods"><button class="nc-rank" data-wstar>⭐'+fmt(wsStarCost(w.id))+'</button><button class="nc-rank" data-wroll>🎲'+fmt(wsRerollCost(w.id))+'</button></div>':''}</div>`;
    if(!maxed) row.querySelector(".buy-main").addEventListener("click", ()=>buyWorkshopUp(w.id));
    if(!maxed) row.querySelector(".buy-ico").addEventListener("click", ()=>buyWorkshopUp(w.id));
    const bs=row.querySelector("[data-wstar]"); if(bs) bs.addEventListener("click", e=>{ e.stopPropagation(); buyWsStar(w.id); });
    const br=row.querySelector("[data-wroll]"); if(br) br.addEventListener("click", e=>{ e.stopPropagation(); rerollWsQ(w.id); });
    box.appendChild(row);
  });
  updateWorkshopLive();
}
function updateWorkshopLive(){
  renderWsFarm();
  document.querySelectorAll("#workshopList .buyrow").forEach(row=>{
    const w=WORKSHOP_UP[row.dataset.wup]; if(!w) return; const l=save.workshopUps[w.id]||0;
    if(l>=w.max) return; const cost=w.cost(l);
    row.classList.toggle("afford",save.gears>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.gears<cost);
  });
  crossLive("#workshopList");
}
// B — проекты
function renderWsProjects(){
  const act=$("wsProjActive"), R=save.wsProjects;
  if(R.active){ const p=WS_PROJ_M[R.active]; act.innerHTML=`<div class="ra-name">📐 ${p.name} <button class="nc-rank ready" id="wsRush">⏩ Ускорить</button></div><div class="ra-bar"><div id="wsProjFill"></div></div><div class="ra-time" id="wsProjTime"></div>`;
    const rb=act.querySelector("#wsRush"); if(rb) rb.addEventListener("click", rushWsProject); updateWsProjTimer(); }
  else act.innerHTML='<div class="dim" style="text-align:center;padding:6px">Нет активного проекта</div>';
  const box=$("wsProjList"); box.innerHTML="";
  WS_PROJECTS.forEach(p=>{ const done=wsProjDone(p.id), reqOk=wsProjReqMet(p), active=R.active===p.id;
    const row=document.createElement("div"); row.className="buyrow"+(done?" afford":"")+((reqOk||done||active)?"":" locked");
    let right;
    if(done) right='<div class="buy-cost" style="color:var(--green)">✓</div>';
    else if(active) right='<div class="buy-cost dim">идёт…</div>';
    else if(!reqOk) right='<div class="buy-cost">🔒</div>';
    else right='<button class="nc-rank ready" data-startp="'+p.id+'">📐 ⚙️'+fmt(p.cost)+'</button>';
    row.innerHTML=`<div class="buy-ico">${p.icon}</div>
      <div class="buy-main"><div class="buy-name">${p.name}</div><div class="buy-desc">${p.desc} · ${(p.time/60).toFixed(1)}мин</div></div>
      <div class="buy-right">${right}</div>`;
    box.appendChild(row); });
  box.querySelectorAll("[data-startp]").forEach(b=>b.addEventListener("click",()=>startWsProject(b.dataset.startp)));
}
function updateWsProjTimer(){ const R=save.wsProjects; if(!R.active) return; const p=WS_PROJ_M[R.active];
  const left=Math.max(0,(R.until-Date.now())/1000), f=1-left/p.time;
  const fill=$("wsProjFill"), tt=$("wsProjTime"); if(fill) fill.style.width=Math.min(100,f*100)+"%"; if(tt) tt.textContent=Math.ceil(left)+"с осталось"; }
// C — чертежи
function renderWsBlueprints(){
  const box=$("bpList"); if(!box) return; box.innerHTML="";
  const cnt=$("bpCount"); if(cnt) cnt.textContent=fmt(save.bpCount||0);
  const setEl=$("bpSet"); if(setEl){ const ok=bpSetComplete(); setEl.textContent=ok?"✓ Комплект собран: +25% всего":"Собери все 4 схемы → +25% всего"; setEl.classList.toggle("done",ok); }
  BLUEPRINTS.forEach(bp=>{ const p=(save.blueprints[bp.id]||0)*bpPowMul();
    const row=document.createElement("div"); row.className="buyrow"+(p>0?" afford":" locked");
    row.innerHTML=`<div class="buy-ico">${bp.icon}</div>
      <div class="buy-main"><div class="buy-name">${bp.name}</div><div class="buy-desc">${p>0?("+"+(p*100).toFixed(0)+"% "+bp.txt):"ещё не выпал — падает за престиж"}</div></div>
      <div class="buy-right"><div class="buy-cost ${p>0?'':'dim'}">${p>0?'📜':'—'}</div></div>`;
    box.appendChild(row); });
}
// G — конвейеры
function renderWsConveyors(){
  const box=$("convList"); if(!box) return; box.innerHTML="";
  WS_CONV.forEach(c=>{ const owned=save.wsConveyors[c.id], afford=save.gears>=c.cost;
    const row=document.createElement("div"); row.className="buyrow"+(owned||afford?" afford":"");
    row.innerHTML=`<div class="buy-ico">${c.icon}</div>
      <div class="buy-main"><div class="buy-name">${c.name}${owned?' ✓':''}</div><div class="buy-desc">${c.desc()}</div></div>
      <div class="buy-right"><div class="buy-cost gear ${(!owned&&!afford)?'cant':''}">${owned?'активен':'⚙️ '+fmt(c.cost)}</div></div>`;
    if(!owned) row.addEventListener("click", ()=>buyConveyor(c.id));
    box.appendChild(row); });
}
// I — переоснастка
function renderWsReforge(){
  const g=reforgeGain();
  const info=$("reforgeInfo"); if(info) info.innerHTML=`🗝️ Ключей: <b>${fmt(save.wsKeys||0)}</b> · Переоснасток: <b>${save.wsReforges||0}</b> (каждая +10% всего, +15% фарма)`;
  const btn=$("reforgeBtn"); if(btn){ btn.textContent="♻️ Переоснастить → +"+g+" 🗝️"; btn.disabled=g<1; }
  const box=$("keyList"); if(!box) return; box.innerHTML="";
  WS_KEY_UPS.forEach(k=>{ const l=save.wsKeyUps[k.id]||0, maxed=l>=k.max, cost=k.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.keyup=k.id;
    row.innerHTML=upRowHTML(k.icon, k.name+" "+(l>0?"("+l+"/"+k.max+")":""), k.desc(l), l, k.max, maxed?"МАКС":"🗝️ "+fmt(cost), "key");
    if(!maxed) row.addEventListener("click", ()=>buyKeyUp(k.id));
    box.appendChild(row); });
  document.querySelectorAll("#keyList .buyrow").forEach(row=>{ const k=WS_KEY_M[row.dataset.keyup]; const l=save.wsKeyUps[k.id]||0;
    if(l>=k.max) return; const cost=k.cost(l); row.classList.toggle("afford",(save.wsKeys||0)>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",(save.wsKeys||0)<cost); });
}
// J — живая 2D-сцена: вращающиеся шестерёнки
let wsGearAng=0;
function drawWsScene(dt){
  const cv=$("wsCanvas"); if(!cv) return;
  const ctx2=cv.getContext("2d"); const DPR=Math.min(2,window.devicePixelRatio||1);
  const W=cv.clientWidth, H=cv.clientHeight; if(!W||!H) return;
  if(cv.width!==W*DPR||cv.height!==H*DPR){ cv.width=W*DPR; cv.height=H*DPR; }
  ctx2.setTransform(DPR,0,0,DPR,0,0); ctx2.clearRect(0,0,W,H);
  const spd=Math.min(3, 0.3+Math.log10(1+(D.gearRate||0))*0.5)*wsOverheatFactor();
  wsGearAng+=dt*spd;
  const lv=wsLevel();
  const gears=[ {x:W*0.28,y:H*0.55,r:H*0.34,t:9,c:"#c7b8ff",dir:1},
                {x:W*0.62,y:H*0.42,r:H*0.24,t:7,c:"#7cf3ff",dir:-1.3},
                {x:W*0.82,y:H*0.66,r:H*0.18,t:6,c:"#ffd23f",dir:1.6} ];
  gears.forEach((g,i)=>{ if(i>0 && lv<i*2) return; drawGear(ctx2,g.x,g.y,g.r,g.t,wsGearAng*g.dir,g.c); });
  // искры при форсаже
  if((save.overheat||{}).on){ for(let k=0;k<3;k++){ ctx2.globalAlpha=Math.random()*0.6+0.2; ctx2.fillStyle="#ff9d3f";
    ctx2.beginPath(); ctx2.arc(W*0.28+Math.random()*W*0.5, H*0.3+Math.random()*H*0.4, 1.5+Math.random()*2,0,6.29); ctx2.fill(); } ctx2.globalAlpha=1; }
}
function drawGear(c,x,y,r,teeth,ang,col){
  c.save(); c.translate(x,y); c.rotate(ang);
  c.fillStyle=col; c.beginPath();
  for(let i=0;i<teeth;i++){ const a0=i/teeth*6.283, a1=(i+0.5)/teeth*6.283;
    const ro=r, ri=r*0.82;
    c.lineTo(Math.cos(a0)*ro, Math.sin(a0)*ro); c.lineTo(Math.cos(a0+0.12)*ro, Math.sin(a0+0.12)*ro);
    c.lineTo(Math.cos(a1)*ri, Math.sin(a1)*ri); c.lineTo(Math.cos(a1+0.28)*ri, Math.sin(a1+0.28)*ri); }
  c.closePath(); c.fill();
  c.fillStyle="#141a3c"; c.beginPath(); c.arc(0,0,r*0.38,0,6.29); c.fill();
  c.strokeStyle=col; c.lineWidth=r*0.1; c.beginPath(); c.arc(0,0,r*0.55,0,6.29); c.stroke();
  c.restore();
}

/* ---- Шахта: спуск и находки ---- */
function descendCore(){
  const before=stratumIndex(save.depth||0);
  save.depth=(save.depth||0)+1;
  const after=stratumIndex(save.depth);
  if(after>before){ const st=STRATA[after]; toast(st.icon+" Новый пласт: "+st.name+" (глубина "+save.depth+"м)"); }
  const chance=Math.min(0.02 + save.depth*0.0006, 0.3);
  if(Math.random()<chance) rareFind();
}
function rareFind(){
  const roll=Math.random();
  if(roll<0.5){ const lump=Math.max(50,(D.oreRate||1)*300); save.ore+=lump; save.oreEver=(save.oreEver||0)+lump; toast("🏺 Находка: +"+fmt(lump)+" руды"); }
  else if(roll<0.82){ const d=Math.ceil(20*(1+save.depth*0.1)); save.dust+=d; toast("🏺 Находка: +"+fmt(d)+" пыли"); }
  else { save.artifacts=(save.artifacts||0)+1; toast("🏺 Артефакт! +1% ко всему навсегда"); }
}
/* ---- Шахта ---- */
function buyMiner(){
  const c=minerCost(); if(save.oof<c) return;
  save.oof-=c; save.miners++;
  recompute(); renderMining(); refreshTop(); queueSave();
}
function buyMinerMax(){
  let n=0; while(n<1000){ const c=minerCost(); if(save.oof<c) break; save.oof-=c; save.miners++; n++; }
  if(n){ recompute(); renderMining(); refreshTop(); queueSave(); toast("Нанято "+n+" шахтёров"); }
}
function buyMiningUp(id){
  const mu=MINING_UP[id]; const l=save.miningUps[id]||0;
  if(l>=mu.max) return; const cost=mu.cost(l);
  if(save.ore<cost) return;
  save.ore-=cost; save.miningUps[id]=l+1;
  recompute(); renderMining(); refreshTop(); queueSave();
}
function renderMining(){
  $("oreBig").textContent=fmt(save.ore);
  $("oreRateTxt").textContent="+"+fmt(D.oreRate||0)+" 🪨/с";
  const mr=$("minerRow"); mr.innerHTML="";
  const row=document.createElement("div"); row.className="buyrow"; row.id="minerBuy";
  row.innerHTML=`<div class="buy-ico">👷</div>
    <div class="buy-main"><div class="buy-name">Шахтёр <span class="buy-cnt" data-cnt>${fmt(save.miners)}</span></div>
      <div class="buy-desc">Копает руду · удержи для найма пачкой</div></div>
    <div class="buy-right"><div class="buy-cost" data-cost></div><div class="buy-prod">+${fmt(MINER_RATE)} 🪨/с</div></div>`;
  row.addEventListener("click", buyMiner);
  let pt; row.addEventListener("pointerdown",()=>{pt=setTimeout(buyMinerMax,500);});
  row.addEventListener("pointerup",()=>clearTimeout(pt)); row.addEventListener("pointerleave",()=>clearTimeout(pt));
  mr.appendChild(row);
  const box=$("miningList"); box.innerHTML="";
  if(save.prestiges>=1) CROSS_UPS.filter(c=>c.tab==="mining").forEach(c=>box.appendChild(crossRow(c)));
  MINING_UPS.forEach(mu=>{
    const l=save.miningUps[mu.id]||0, maxed=l>=mu.max, cost=mu.cost(l);
    const r2=document.createElement("div"); r2.className="buyrow"; r2.dataset.miningup=mu.id;
    r2.innerHTML=upRowHTML(mu.icon, mu.name+" "+(l>0?"("+l+(mu.max<50?"/"+mu.max:"")+")":""), mu.desc(l), l, mu.max, maxed?"МАКС":"🪨 "+fmt(cost), "ore");
    if(!maxed) r2.addEventListener("click", ()=>buyMiningUp(mu.id));
    box.appendChild(r2);
  });
  updateMiningLive();
}
function updateMiningLive(){
  const ob=$("oreBig"); if(ob) ob.textContent=fmt(save.ore);
  const rt=$("oreRateTxt"); if(rt) rt.textContent="+"+fmt(D.oreRate||0)+" 🪨/с";
  // глубина/пласт
  const sI=$("stratumIco");
  if(sI){ const dep=save.depth||0, si=stratumIndex(dep), st=STRATA[si], nextSt=STRATA[si+1], need=depthNeed(dep);
    sI.textContent=st.icon; $("stratumName").textContent=st.name; $("depthVal").textContent=fmt(dep);
    $("depthFill").style.width=Math.min(100,(save.digProg||0)/need*100)+"%";
    $("depthNext").textContent = "добыча ×"+(D.depthMul||1).toFixed(2)+(nextSt?(" · след. пласт «"+nextSt.name+"» на "+nextSt.d+"м"):" · глубочайший пласт");
    const at=$("artifactTxt"); if(at) at.textContent=(save.artifacts||0)>0?(" · 🏺"+save.artifacts):"";
  }
  const mb=$("minerBuy"); if(mb){ const c=minerCost();
    mb.classList.toggle("afford",save.oof>=c);
    mb.querySelector("[data-cnt]").textContent=fmt(save.miners);
    const ce=mb.querySelector("[data-cost]"); ce.textContent="🪙 "+fmt(c); ce.classList.toggle("cant",save.oof<c); }
  document.querySelectorAll("#miningList .buyrow").forEach(row=>{
    const mu=MINING_UP[row.dataset.miningup]; if(!mu) return; const l=save.miningUps[mu.id]||0;
    if(l>=mu.max) return; const cost=mu.cost(l);
    row.classList.toggle("afford",save.ore>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.ore<cost);
  });
  crossLive("#miningList");
}

/* ---- Алхимия: питомцы и зелья ---- */
let potionState="";
function buyPet(id){
  const p=PET[id]; const l=save.pets[id]||0;
  if(l>=p.max) return; const c=p.cost(l);
  if(save.ore<c.ore || save.dust<c.dust){ toast("Не хватает руды/пыли"); return; }
  save.ore-=c.ore; save.dust-=c.dust; save.pets[id]=l+1;
  recompute(); renderAlchemy(); refreshTop(); queueSave();
}
function brewPotion(id){
  const p=POTION[id], c=p.cost;
  if(save.ore<c.ore || save.dust<c.dust){ toast("Не хватает руды/пыли"); return; }
  save.ore-=c.ore; save.dust-=c.dust;
  const now=Date.now();
  const base=(save.potions[id]||0)>now ? save.potions[id] : now;
  save.potions[id]=base + p.dur*1000;
  potionState=""; recompute(); renderAlchemy(); refreshTop(); queueSave();
  toast(p.icon+" "+p.name+" активно!");
}
function renderAlchemy(){
  const pbox=$("petList"); pbox.innerHTML="";
  PETS.forEach(p=>{
    const l=save.pets[p.id]||0, maxed=l>=p.max, c=maxed?null:p.cost(l);
    const costTxt = maxed?"МАКС":("🪨 "+fmt(c.ore)+" · 💠 "+fmt(c.dust));
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.pet=p.id;
    row.innerHTML=`<div class="buy-ico">${p.icon}</div>
      <div class="buy-main"><div class="buy-name">${p.name} ${l>0?'<span class="buy-cnt">ур.'+l+'</span>':''}</div>
        <div class="buy-desc">${p.desc(l)}</div></div>
      <div class="buy-right"><div class="buy-cost ore" data-cost>${costTxt}</div></div>`;
    if(!maxed) row.addEventListener("click", ()=>buyPet(p.id));
    pbox.appendChild(row);
  });
  const bbox=$("potionList"); bbox.innerHTML="";
  POTIONS.forEach(p=>{
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.potion=p.id;
    row.innerHTML=`<div class="buy-ico">${p.icon}</div>
      <div class="buy-main"><div class="buy-name">${p.name}</div>
        <div class="buy-desc">${p.desc}</div></div>
      <div class="buy-right"><div class="buy-cost ore">🪨 ${fmt(p.cost.ore)} · 💠 ${fmt(p.cost.dust)}</div>
        <div class="buy-prod" data-timer></div></div>`;
    row.addEventListener("click", ()=>brewPotion(p.id));
    bbox.appendChild(row);
  });
  updateAlchemyLive();
}
function updateAlchemyLive(){
  const now=Date.now();
  document.querySelectorAll("#petList .buyrow").forEach(row=>{
    const p=PET[row.dataset.pet]; const l=save.pets[p.id]||0; if(l>=p.max) return;
    const c=p.cost(l), ok=save.ore>=c.ore&&save.dust>=c.dust;
    row.classList.toggle("afford",ok);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",!ok);
  });
  document.querySelectorAll("#potionList .buyrow").forEach(row=>{
    const p=POTION[row.dataset.potion], c=p.cost, ok=save.ore>=c.ore&&save.dust>=c.dust;
    row.classList.toggle("afford",ok);
    const exp=save.potions[p.id]||0, t=row.querySelector("[data-timer]");
    if(exp>now){ t.textContent="⏳ "+Math.ceil((exp-now)/1000)+"с"; t.classList.add("active"); }
    else { t.textContent=""; t.classList.remove("active"); }
  });
}
function tickPotions(){
  const now=Date.now();
  const key=POTIONS.map(p=>(save.potions[p.id]||0)>now?"1":"0").join("");
  if(key!==potionState){ potionState=key; recompute(); refreshTop(); if(curTab==="alchemy") renderAlchemy(); }
  else if(curTab==="alchemy") updateAlchemyLive();
}

/* ============ Вкладки/навигация ============ */
let curTab="noobs";
function switchTab(t){
  curTab=t;
  document.querySelectorAll("#tabbar .tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));
  document.querySelectorAll(".tabpage").forEach(p=>p.classList.toggle("hidden",p.dataset.page!==t));
  if(t==="noobs") renderNoobs();
  else if(t==="ups") renderSub();
  else if(t==="runes") renderRunes();
  else if(t==="prestige") renderPrestige();
  else if(t==="workshop") wsRenderSub();
  else if(t==="mining") renderMining();
  else if(t==="alchemy") renderAlchemy();
  else if(t==="meta") metaRenderSub();
}
document.querySelectorAll("#tabbar .tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
document.querySelectorAll("#upSubs button").forEach(b=>b.addEventListener("click",()=>switchSub(b.dataset.sub)));
document.querySelectorAll("#wsSubs button").forEach(b=>b.addEventListener("click",()=>wsSwitchSub(b.dataset.wsub)));
document.querySelectorAll("#metaSubs button").forEach(b=>b.addEventListener("click",()=>metaSwitchSub(b.dataset.msub)));
on("overheatBtn","click", toggleOverheat);
on("maintainBtn","click", maintainWorkshop);
on("reforgeBtn","click", ()=>askConfirm("Переоснастить мастерскую? Улучшения станков, звёзды и текущие шестерёнки сбросятся ради 🗝️ ключей.", doReforge));
on("singularityBtn","click", ()=>askConfirm("Сингулярность? Призмы, звёзды, кварки, пантеон, искажение и мастерская сбросятся ради ♾️ бесконечных очков.", doSingularity));
on("openPortalBtn","click", ()=>{ if(typeof openPortal==="function") openPortal(); });

function renderAll(){ renderNoobs();
  if(curTab==="ups")renderUps(); if(curTab==="runes")renderRunes();
  if(curTab==="prestige")renderPrestige(); if(curTab==="workshop")wsRenderSub();
  if(curTab==="mining")renderMining(); if(curTab==="alchemy")renderAlchemy();
  if(curTab==="meta")metaRenderSub(); }

/* ============ Тосты/подсказка ============ */
function toast(msg){
  const t=document.createElement("div"); t.className="toast"; t.textContent=msg;
  $("toast").appendChild(t); setTimeout(()=>t.remove(),2200);
}
let hintHidden=false;
function hideHint(){ if(!hintHidden){ hintHidden=true; const h=$("tapHint"); h.style.opacity=0; } }

/* ============ Кнопки меню ============ */
on("menuBtn","click", ()=>{
  $("mStatLife").textContent=fmt(save.lifetimeOof);
  $("mStatPrest").textContent=fmt(save.prestiges);
  let tot=0; for(const nb of NOOBS) tot+=(save.noobs[nb.id]||0);
  $("mStatNoobs").textContent=fmt(tot);
  $("achCount").textContent="("+achDone()+"/"+ACHS.length+")";
  $("menuModal").classList.remove("hidden");
});
on("closeMenu","click", ()=>$("menuModal").classList.add("hidden"));

/* ---- Достижения ---- */
let achOpen=false;
function checkAchievements(){
  const got=[];
  for(const a of ACHS){ if(!save.achieved[a.id] && a.cond()){ save.achieved[a.id]=1; got.push(a.name); } }
  if(got.length){
    if(got.length<=2) got.forEach(n=>toast("🏆 "+n));
    else toast("🏆 +"+got.length+" достижений!");
    recompute(); refreshTop(); queueSave(); if(achOpen) renderAch();
  }
}
function achDone(){ let n=0; for(const a of ACHS) if(save.achieved[a.id]) n++; return n; }
function renderAch(){
  $("achCount").textContent="("+achDone()+"/"+ACHS.length+")";
  const box=$("achGrid"); box.innerHTML="";
  ACHS.forEach(a=>{
    const done=!!save.achieved[a.id];
    const el=document.createElement("div");
    el.className="ach-card"+(done?" done":"");
    el.innerHTML=`<div class="a-ico">${done?a.icon:"🔒"}</div>
      <div class="a-name">${a.name}</div>
      <div class="a-desc">${a.desc}</div>
      <div class="a-buff">${achBuffText(a.buff)}</div>`;
    box.appendChild(el);
  });
}
on("achBtn","click", ()=>{ $("menuModal").classList.add("hidden"); achOpen=true; renderAch(); $("achModal").classList.remove("hidden"); });
on("achClose","click", ()=>{ achOpen=false; $("achModal").classList.add("hidden"); });
on("achModal","click", e=>{ if(e.target.id==="achModal"){ achOpen=false; $("achModal").classList.add("hidden"); } });

/* ---- Мутации (конвейер) ---- */
let mutOpen=false;
function buyMutant(id){
  const x=MUTANT[id]; if(save.mutants[id]) return; const c=x.cost;
  if(save.ore<c.ore||save.dust<c.dust||save.gears<c.gears){ toast("Не хватает ресурсов"); return; }
  save.ore-=c.ore; save.dust-=c.dust; save.gears-=c.gears; save.mutants[id]=1;
  recompute(); refreshTop(); renderMutants(); queueSave();
  toast(x.icon+" Создан: "+x.name);
}
function renderMutants(){
  const box=$("mutList"); box.innerHTML="";
  MUTANTS.forEach(x=>{
    const done=!!save.mutants[x.id], c=x.cost;
    const el=document.createElement("div"); el.className="buyrow"+(done?" afford":""); el.dataset.mut=x.id;
    el.innerHTML=`<div class="buy-ico">${x.icon}</div>
      <div class="buy-main"><div class="buy-name">${x.name}</div><div class="buy-desc">${x.desc}</div></div>
      <div class="buy-right">${done?'<div class="chal-status" style="padding:0">✓</div>'
        :`<div class="buy-cost ore" data-cost>🪨 ${fmt(c.ore)} · 💠 ${fmt(c.dust)} · ⚙️ ${fmt(c.gears)}</div>`}</div>`;
    if(!done) el.addEventListener("click",()=>buyMutant(x.id));
    box.appendChild(el);
  });
  updateMutLive();
}
function updateMutLive(){
  document.querySelectorAll("#mutList .buyrow").forEach(row=>{
    const x=MUTANT[row.dataset.mut]; if(save.mutants[x.id]) return;
    const c=x.cost, ok=save.ore>=c.ore&&save.dust>=c.dust&&save.gears>=c.gears;
    row.classList.toggle("afford",ok);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",!ok);
  });
}

/* ---- Хроно-биржа ---- */
let mktOpen=false;
function driftMarket(){
  const m=save.market; const now=Date.now();
  if(now < (m.nextDrift||0)) return;
  m.nextDrift = now + 18000;
  for(const r of MARKET_RES){ let f=(m[r.id]||1)*(0.82+Math.random()*0.42); m[r.id]=Math.max(0.4,Math.min(2.6,f)); }
  if(!m.event || now>=m.event.until){
    if(Math.random()<0.4){ const e=MARKET_EVENTS[Math.floor(Math.random()*MARKET_EVENTS.length)];
      m.event={ res:e.res, mult:e.mult, text:e.text, until:now+28000 }; }
    else m.event=null;
  }
  if(mktOpen) renderMarket();
}
function sellRes(res){
  const amt=save[res]||0; if(amt<=0){ toast("Нечего продавать"); return; }
  const oof=amt*marketPrice(res);
  save[res]=0; gainOof(oof);
  refreshTop(); renderMarket(); queueSave();
  toast("Продано "+fmt(amt)+" за "+fmt(oof)+" Oof");
}
function buyRes(res){
  const spend=save.oof*0.1; if(spend<=0){ toast("Мало Oof"); return; }
  const got=spend/marketPrice(res);
  save.oof-=spend; save[res]=(save[res]||0)+got;
  if(res==="ore") save.oreEver=(save.oreEver||0)+got; if(res==="gears") save.gearsEver=(save.gearsEver||0)+got;
  refreshTop(); renderMarket(); queueSave();
  toast("Куплено "+fmt(got)+" "+MARKET_RES.find(r=>r.id===res).name);
}
function renderMarket(){
  const ev=$("mktEvent"); const m=save.market;
  if(m.event && Date.now()<m.event.until){ ev.textContent=m.event.text; ev.classList.remove("hidden"); }
  else ev.classList.add("hidden");
  const box=$("mktList"); box.innerHTML="";
  MARKET_RES.forEach(r=>{
    const price=marketPrice(r.id), have=save[r.id]||0;
    const row=document.createElement("div"); row.className="mkt-row";
    row.innerHTML=`<div class="mkt-head"><span>${r.icon} ${r.name}</span><span class="mkt-price">💱 ${fmt(price)} Oof/шт</span></div>
      <div class="mkt-have">В наличии: ${fmt(have)}</div>
      <div class="mkt-btns">
        <button class="adm-btn" data-sell="${r.id}">Продать всё</button>
        <button class="adm-btn pri" data-buy="${r.id}">Купить на 10% Oof</button>
      </div>`;
    box.appendChild(row);
  });
  box.querySelectorAll("[data-sell]").forEach(b=>b.addEventListener("click",()=>sellRes(b.dataset.sell)));
  box.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",()=>buyRes(b.dataset.buy)));
}

/* ---- Карманные реальности (глитч-портал) ---- */
let portalActive=false, portalBalance=0, portalBase=0, portalTime=0, portalLastTap=0;
const PORTAL_COST=50;
function openPortal(){
  if(portalActive) return;
  if((save.corr||0)<PORTAL_COST){ toast("Нужно "+PORTAL_COST+" ⚫ искажения"); return; }
  save.corr-=PORTAL_COST;
  portalBase=Math.max(1e3, D.ops*20 + D.clickBase*50);
  portalBalance=portalBase; portalTime=30; portalLastTap=Date.now(); portalActive=true;
  $("portalModal").classList.remove("hidden"); refreshTop(); renderPortal(); queueSave();
}
function tapPortal(){
  if(!portalActive) return;
  portalBalance*=1.18; portalLastTap=Date.now();
  burst(W/2, Hc*0.5);
}
function collectPortal(){
  if(!portalActive) return;
  const won=Math.floor(portalBalance);
  gainOof(won);
  // H — осколки реальности за успешный забег (чем больше множитель, тем больше)
  const shards=Math.max(1, Math.floor(Math.log10(1+portalBalance/Math.max(1,portalBase))*2));
  save.realities.shards=(save.realities.shards||0)+shards;
  portalActive=false; $("portalModal").classList.add("hidden");
  refreshTop(); toast("🌀 Из портала: +"+fmt(won)+" Oof · 🔹 +"+shards+" осколков"); queueSave();
}
function renderPortal(){
  $("portalBal").textContent=fmt(portalBalance);
  $("portalTime").textContent=Math.ceil(portalTime)+"с";
}
function tickPortal(dt){
  if(!portalActive) return;
  portalTime-=dt;
  if(Date.now()-portalLastTap>3000){ portalBalance=portalBase; } // застой сбрасывает
  const stall=Math.max(0,1-(Date.now()-portalLastTap)/3000);
  const sb=$("portalStall"); if(sb) sb.style.width=(stall*100)+"%";
  renderPortal();
  if(portalTime<=0) collectPortal();
}

/* ---- Испытания ---- */
let chalOpen=false;
function completeChallenge(){
  const id=save.activeChallenge, c=CHAL[id]; if(!c) return;
  save.chalDone[id]=1; save.activeChallenge=null;
  softReset(); recompute(); syncNoobSprites(); refreshTop(); renderAll();
  toast("🎯 Пройдено: "+c.name+" — "+c.rewardText); persist();
  if(chalOpen) renderChallenges();
}
function enterChallenge(id){
  if(save.activeChallenge) return;
  save.activeChallenge=id; softReset(); recompute(); syncNoobSprites(); refreshTop(); renderAll();
  toast(CHAL[id].icon+" Испытание: "+CHAL[id].name); renderChallenges(); persist();
}
function abandonChallenge(){
  save.activeChallenge=null; softReset(); recompute(); syncNoobSprites(); refreshTop(); renderAll();
  renderChallenges(); persist();
}
function renderChallenges(){
  const box=$("chalList"); box.innerHTML="";
  CHALLENGES.forEach(c=>{
    const done=!!save.chalDone[c.id], active=save.activeChallenge===c.id;
    const el=document.createElement("div"); el.className="chal-card"+(done?" done":"")+(active?" active":"");
    let btn;
    if(done) btn=`<div class="chal-status">✓ Пройдено</div>`;
    else if(active) btn=`<button class="btn btn-ghost chal-b" data-abandon>Выйти из испытания</button>`;
    else btn=`<button class="btn btn-primary chal-b" data-enter="${c.id}" ${save.activeChallenge?'disabled':''}>Войти</button>`;
    el.innerHTML=`<div class="chal-top"><span class="chal-ico">${c.icon}</span>
        <div><div class="chal-name">${c.name}</div><div class="chal-desc">${c.desc}</div></div></div>
      <div class="chal-goal">Цель: ${fmt(c.goal)} Oof · Награда: <b>${c.rewardText}</b></div>
      ${active?`<div class="chal-prog"><div style="width:${Math.min(100,save.totalOof/c.goal*100)}%"></div></div>`:''}
      ${btn}`;
    box.appendChild(el);
  });
  box.querySelectorAll("[data-enter]").forEach(b=>b.addEventListener("click",()=>enterChallenge(b.dataset.enter)));
  box.querySelectorAll("[data-abandon]").forEach(b=>b.addEventListener("click",abandonChallenge));
}
function updateChalLive(){
  if(!chalOpen||!save.activeChallenge) return;
  const c=CHAL[save.activeChallenge], bar=document.querySelector(".chal-card.active .chal-prog>div");
  if(bar) bar.style.width=Math.min(100,save.totalOof/c.goal*100)+"%";
}
on("chalBtn","click", ()=>{ $("menuModal").classList.add("hidden"); chalOpen=true; renderChallenges(); $("chalModal").classList.remove("hidden"); });
on("chalClose","click", ()=>{ chalOpen=false; $("chalModal").classList.add("hidden"); });
on("chalModal","click", e=>{ if(e.target.id==="chalModal"){ chalOpen=false; $("chalModal").classList.add("hidden"); } });

// Мутации
on("mutBtn","click", ()=>{ $("menuModal").classList.add("hidden"); mutOpen=true; renderMutants(); $("mutModal").classList.remove("hidden"); });
on("mutClose","click", ()=>{ mutOpen=false; $("mutModal").classList.add("hidden"); });
on("mutModal","click", e=>{ if(e.target.id==="mutModal"){ mutOpen=false; $("mutModal").classList.add("hidden"); } });
// Хроно-биржа
on("mktBtn","click", ()=>{ $("menuModal").classList.add("hidden"); mktOpen=true; renderMarket(); $("mktModal").classList.remove("hidden"); });
on("mktClose","click", ()=>{ mktOpen=false; $("mktModal").classList.add("hidden"); });
on("mktModal","click", e=>{ if(e.target.id==="mktModal"){ mktOpen=false; $("mktModal").classList.add("hidden"); } });
// Глитч-портал
on("portalBtn","click", ()=>{ $("menuModal").classList.add("hidden"); openPortal(); });
on("portalTap","click", tapPortal);
on("portalCollect","click", collectPortal);

/* ---- Пыльцевые улучшения (пыль → основная характеристика) ---- */
function renderDustUps(){
  const box=$("dustUpList"); if(!box) return; box.innerHTML="";
  DUST_UPS.forEach(d=>{ const l=save.dustUps[d.id]||0, maxed=l>=d.max, cost=d.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.dup=d.id;
    row.innerHTML=upRowHTML(d.icon, d.name+" "+(l>0?"("+l+"/"+d.max+")":""), d.desc(l), l, d.max, maxed?"МАКС":"💠 "+fmt(cost), "dust");
    if(!maxed) row.addEventListener("click",()=>buyDustUp(d.id)); box.appendChild(row); });
}
function buyDustUp(id){
  const d=DUST_UP[id], l=save.dustUps[id]||0; if(l>=d.max) return;
  const cost=d.cost(l); if(save.dust<cost) return;
  save.dust-=cost; save.dustUps[id]=l+1; recompute(); renderRunes(); refreshTop(); queueSave();
}

/* ---- Массовая покупка «Купить всё» ---- */
function massLeveled(defs,storeKey,curKey){
  let n=0,ch=true; while(ch&&n<5000){ ch=false;
    for(const d of defs){ const l=save[storeKey][d.id]||0; if(l>=d.max) continue; const cost=d.cost(l);
      if((save[curKey]||0)>=cost){ save[curKey]-=cost; save[storeKey][d.id]=l+1; n++; ch=true; } } }
  return n;
}
function buyAllNoobs(){
  let n=0; while(n<20000){ let best=null,bc=Infinity;
    for(const nb of NOOBS){ const c=noobCost(nb.id,save.noobs[nb.id]||0); if(c<=save.oof&&c<bc){bc=c;best=nb.id;} }
    if(!best) break; save.oof-=bc; save.noobs[best]=(save.noobs[best]||0)+1; n++; }
  if(n){ recompute(); syncNoobSprites(); renderNoobs(); refreshTop(); queueSave(); toast("Куплено нубов: "+n); }
  else toast("Не хватает Oof");
}
function buyAllUps(){
  let n=0,ch=true; while(ch&&n<2000){ ch=false;
    for(const u of UPS){ if(!save.ups[u.id]&&u.req()&&save.oof>=u.cost){ save.oof-=u.cost; save.ups[u.id]=true; n++; ch=true; } } }
  if(n){ recompute(); renderUps(); refreshTop(); queueSave(); toast("Куплено улучшений: "+n); } else toast("Нечего купить");
}
function buyAllMining(){ buyMinerMax(); const n=massLeveled(MINING_UPS,'miningUps','ore'); recompute(); renderMining(); refreshTop(); queueSave(); if(n) toast("Улучшений шахты: "+n); }
function buyAllWorkshop(){ const n=massLeveled(WORKSHOP_UPS,'workshopUps','gears'); if(n){ recompute(); renderWorkshop(); refreshTop(); queueSave(); toast("Улучшений цеха: "+n); } else toast("Не хватает шестерёнок"); }
function buyAllDust(){ const n=massLeveled(DUST_UPS,'dustUps','dust'); if(n){ recompute(); renderRunes(); refreshTop(); queueSave(); toast("Пыльцы: "+n); } else toast("Не хватает пыли"); }
function buyAllPrism(){ if(massLeveled(PRISM_UPS,'prismUps','prisms')){ recompute(); renderPrestige(); refreshTop(); queueSave(); } }
function buyAllStar(){ if(massLeveled(STAR_UPS,'starUps','stars')){ recompute(); renderPrestige(); refreshTop(); queueSave(); } }
function buyAllQuark(){ let n=0,ch=true; while(ch&&n<5000){ ch=false;
    for(const q of QUARK_UPS){ if(!quarkReqMet(q)) continue; const l=save.quarkUps[q.id]||0; if(l>=q.max) continue; const c=q.cost(l);
      if(save.quarks>=c){ save.quarks-=c; save.quarkUps[q.id]=l+1; n++; ch=true; } } }
  if(n){ recompute(); if(curTab==="meta")renderQuarkTree(); refreshTop(); queueSave(); } }
function buyAllCorr(){ if(massLeveled(CORR_UPS,'corrUps','corr')){ recompute(); if(curTab==="meta")renderCorr(); refreshTop(); queueSave(); } }

/* ---- Автоматизация ---- */
let autoOpen=false, autoTimer=0;
function renderAuto(){
  const box=$("autoList"); box.innerHTML="";
  AUTOS.forEach(a=>{ const un=a.unlock(), on=un&&save.auto[a.id]!==false;
    const row=document.createElement("div"); row.className="auto-row"+(un?"":" locked");
    row.innerHTML=`<div class="auto-ico">${a.icon}</div>
      <div class="auto-main"><div class="auto-name">${a.name}</div>
        <div class="auto-hint">${un?(on?'Включено':'Выключено'):('🔒 '+a.hint)}</div></div>
      <span class="tg ${on?'on':''}"><span class="knob"></span></span>`;
    if(un) row.addEventListener("click",()=>{ save.auto[a.id]=!on; renderAuto(); queueSave(); });
    box.appendChild(row); });
}
function runAutomation(edt){
  autoTimer+=edt; if(autoTimer<1) return; autoTimer=0;
  let changed=false;
  if(save.prestiges>=3 && save.auto.ups!==false){
    for(const u of UPS){ if(!save.ups[u.id]&&u.req()&&save.oof>=u.cost){ save.oof-=u.cost; save.ups[u.id]=true; changed=true; } } }
  if(((save.miningUps||{}).auto>0) && save.auto.mining!==false){
    let c=minerCost(),k=0; while(save.oof>=c && save.oof-c>c*0.4 && k<100){ save.oof-=c; save.miners++; c=minerCost(); k++; changed=true; }
    for(const d of MINING_UPS){ const l=save.miningUps[d.id]||0; if(l<d.max && save.ore>=d.cost(l)){ save.ore-=d.cost(l); save.miningUps[d.id]=l+1; changed=true; } } }
  if((save.prestiges>=5||save.transcends>0) && save.auto.workshop!==false){
    // D — мощность линии = уровень верстака: за тик покупаем несколько раз
    const power=1+wsLevel();
    for(const d of WORKSHOP_UPS){ let k=0; let l=save.workshopUps[d.id]||0;
      while(l<d.max && save.gears>=d.cost(l) && k<power){ save.gears-=d.cost(l); l++; k++; changed=true; } save.workshopUps[d.id]=l; }
    // авто-старт ближайшего проекта
    if(!save.wsProjects.active){ for(const p of WS_PROJECTS){ if(!wsProjDone(p.id)&&wsProjReqMet(p)&&save.gears>=p.cost){ save.gears-=p.cost; save.wsProjects.active=p.id; save.wsProjects.until=Date.now()+p.time*1000; changed=true; break; } } }
    // авто-подключение конвейеров
    for(const c of WS_CONV){ if(!save.wsConveyors[c.id]&&save.gears>=c.cost){ save.gears-=c.cost; save.wsConveyors[c.id]=true; changed=true; } } }
  if(save.transcends>0 && save.auto.potions){
    const now=Date.now();
    for(const p of POTIONS){ if((save.potions[p.id]||0)<=now && save.ore>=p.cost.ore && save.dust>=p.cost.dust){
      save.ore-=p.cost.ore; save.dust-=p.cost.dust; save.potions[p.id]=now+p.dur*1000; potionState=""; changed=true; } } }
  if(changed){ recompute(); syncNoobSprites(); refreshTop(); if(!menuIsOpen()) renderAll(); }
}
function menuIsOpen(){ return !$("menuModal").classList.contains("hidden"); }
on("autoBtn","click", ()=>{ $("menuModal").classList.add("hidden"); autoOpen=true; renderAuto(); $("autoModal").classList.remove("hidden"); });
on("autoClose","click", ()=>{ autoOpen=false; $("autoModal").classList.add("hidden"); });
on("autoModal","click", e=>{ if(e.target.id==="autoModal"){ autoOpen=false; $("autoModal").classList.add("hidden"); } });
// mass-buy кнопки
on("massNoobs","click", buyAllNoobs);
on("massUps","click", buyAllUps);
on("massMining","click", buyAllMining);
on("massWorkshop","click", buyAllWorkshop);
on("massDust","click", buyAllDust);
on("massPrism","click", buyAllPrism);
on("massStar","click", buyAllStar);
on("massQuark","click", buyAllQuark);
on("massCorr","click", buyAllCorr);
on("howBtn2","click", ()=>{ $("menuModal").classList.add("hidden"); $("howModal").classList.remove("hidden"); });
on("howClose2","click", ()=>$("howModal").classList.add("hidden"));
on("prestigeBtn","click", ()=>doPrestige());
on("ascendBtn","click", ()=>askConfirm("Вознестись? Призмы и призматические улучшения сбросятся ради звёзд.", doAscend));
on("transBtn","click", ()=>askConfirm("Трансцендировать? Призмы, звёзды и их улучшения сбросятся ради кварков.", doTranscend));
on("corrMinus","click", ()=>setCorruption(-1));
on("corrPlus","click", ()=>setCorruption(1));
on("apMinus","click", ()=>setApMult(-0.5));
on("apPlus","click", ()=>setApMult(0.5));
on("rollBtn","click", rollRune);
on("wipeBtn","click", ()=>askConfirm("Стереть весь прогресс безвозвратно?", wipeSave));

/* ---- свой диалог подтверждения (системный confirm часто не работает в PWA) ---- */
let cfCb=null;
function askConfirm(text, onYes){
  $("cfText").textContent=text; cfCb=onYes||null;
  $("confirmModal").classList.remove("hidden");
}
on("cfYes","click", ()=>{ $("confirmModal").classList.add("hidden"); const cb=cfCb; cfCb=null; if(cb) cb(); });
on("cfNo","click", ()=>{ $("confirmModal").classList.add("hidden"); cfCb=null; });
on("confirmModal","click", e=>{ if(e.target.id==="confirmModal"){ $("confirmModal").classList.add("hidden"); cfCb=null; } });
// закрытие модалок по фону
["menuModal","howModal","runeModal"].forEach(id=>{
  on(id,"click", e=>{ if(e.target.id===id){ if(id==="runeModal") return; $(id).classList.add("hidden"); } });
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
  secR.appendChild(admResRow("Шестерёнки", "gears", ["100","1e4","1e6"]));
  secR.appendChild(admResRow("Руда", "ore", ["100","1e4","1e6"]));
  secR.appendChild(admResRow("Кварки", "quarks", ["10","100","1000"]));
  secR.appendChild(admResRow("Искажение ⚫", "corr", ["100","1e4","1e6"]));
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
  orow2.appendChild(admBtn("🗑 Полный сброс игры", ()=>askConfirm("Стереть весь прогресс безвозвратно?", wipeSave), "dng"));
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
on("adminBtn","click", ()=>{ $("menuModal").classList.add("hidden"); openAdmin(); });
on("adminClose","click", ()=>$("adminModal").classList.add("hidden"));
on("adminModal","click", e=>{ if(e.target.id==="adminModal") $("adminModal").classList.add("hidden"); });

/* ============ Старт ============ */
function init(){
  load();
  resize();
  applyOffline();
  recompute();
  checkAchievements();
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
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").then(reg=>{ try{ reg.update(); }catch(e){} }).catch(()=>{});
    // авто-перезагрузка, когда активировался новый service worker (кроме первого захвата)
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", ()=>{
      if(!hadController){ hadController=true; return; }
      if(window.__swReloaded) return; window.__swReloaded=true;
      location.reload();
    });
  }
}
init();
