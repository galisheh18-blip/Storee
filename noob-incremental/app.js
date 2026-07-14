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
];
const MINING_UP = Object.fromEntries(MINING_UPS.map(m=>[m.id,m]));
function minerCost(){
  const l=save.miningUps.cheap||0, red=1-Math.min(l*0.02,0.7);
  return MINER_BASE*Math.pow(MINER_MUL, save.miners)*red;
}

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
function quarkGain(stars){ if(stars<1000) return 0; return Math.floor(Math.pow(stars/1000, 0.5)); }
const QUARK_UPS = [
  { id:"qall",  icon:"⚛️", name:"Квантовый множитель", max:500, desc:l=>"Всё ×"+fmt(1+0.5*l),
    cost:l=>Math.ceil(3*Math.pow(1.4,l)), apply:(m,l)=>m.global*=(1+0.5*l) },
  { id:"qprism",icon:"💎", name:"Призменный резонанс", max:100, desc:l=>"Призм +"+(l*20)+"%",
    cost:l=>Math.ceil(2*Math.pow(1.4,l)), apply:(m,l)=>m.prism*=(1+l*0.2) },
  { id:"qkeep", icon:"⭐", name:"Квантовая память", max:20, desc:l=>"Оставляй "+(l*3)+"% звёзд при трансценденции",
    cost:l=>Math.ceil(3*Math.pow(1.6,l)) },
  // Пантеон — синергии между механиками
  { id:"synRuneMine", icon:"🔗", name:"Созвездие: Руны↔Шахта", max:1, desc:l=>l?"Каждая руна +2% добыча руды":"Соедини механики",
    cost:()=>10, apply:(m,l)=>{ if(l) m._oreBoost += save.runes.filter(Boolean).length*0.02; } },
  { id:"synPet", icon:"🔗", name:"Созвездие: Питомцы", max:1, desc:l=>l?"Каждый ур. питомца +0.5% всего":"Соедини механики",
    cost:()=>15, apply:(m,l)=>{ if(l){ let t=0; for(const p of PETS) t+=(save.pets[p.id]||0); m.global*=(1+t*0.005); } } },
  { id:"synGear", icon:"🔗", name:"Созвездие: Мастерская↔Тап", max:1, desc:l=>l?"log10(шестерёнок) ×множитель тапа":"Соедини механики",
    cost:()=>20, apply:(m,l)=>{ if(l) m.click*=(1+Math.max(0,Math.log10(1+save.gearsEver))*0.5); } },
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
  miners:0, ore:0, oreEver:0, miningUps:{},
  pets:{}, potions:{},
  activeChallenge:null, chalDone:{},
  quarks:0, transcends:0, quarkUps:{}, corruption:0, corr:0, corrEver:0, corrUps:{},
  mutants:{}, market:{ ore:1, dust:1, gears:1, nextDrift:0, event:null },
  dustUps:{}, auto:{ click:true, noobs:true, ups:true, mining:true, workshop:true, potions:false },
  ranks:{},
  lastTime:Date.now(), seen:{},
  admin:{ oofMul:1, clickMul:1, costMul:1, prismMul:1, speed:1 }
});
let save = DEFAULT();
function load(){
  try{
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
    if(raw){ save=Object.assign(DEFAULT(),raw);
      for(const k of ["noobs","ups","prismUps","starUps","workshopUps","achieved","miningUps","pets","potions","chalDone","quarkUps","corrUps","mutants","dustUps","ranks","seen"]) if(!save[k]) save[k]={};
      if(typeof save.corruption!=="number") save.corruption=0;
      if(!save.market) save.market={ ore:1, dust:1, gears:1, nextDrift:0, event:null };
      save.auto=Object.assign({ click:true, noobs:true, ups:true, mining:true, workshop:true, potions:false }, save.auto||{});
      if(typeof save.salvageBelow!=="number") save.salvageBelow=-1;
      if(typeof save.gearsEver!=="number") save.gearsEver=save.gears||0;
      if(typeof save.miners!=="number") save.miners=0;
      if(typeof save.ore!=="number") save.ore=0;
      if(typeof save.oreEver!=="number") save.oreEver=save.ore||0;
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
    _runePow:0, _runeLuck:0, _megaClick:0, _bonusSlots:0, _oreBoost:0, noob:{} };
  const cr = save.activeChallenge ? ((CHAL[save.activeChallenge]||{}).restrict||{}) : {};
  // обычные улучшения
  if(!cr.noUps) for(const id in save.ups){ if(save.ups[id] && UP[id]) UP[id].apply(m); }
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
  // шахта: руда усиливает основную экономику
  let oreMul=1, miningGlob=1;
  for(const mu of MINING_UPS){ const l=save.miningUps[mu.id]||0; if(l>0){ if(mu.rate) oreMul*=mu.rate(l); if(mu.glob) miningGlob*=mu.glob(l); } }
  oreMul *= (1 + Math.max(0, m._oreBoost));
  m.global *= miningGlob;
  D.oreRate = (save.miners||0)*MINER_RATE*oreMul;
  D.autoMiner = (save.miningUps.auto||0)>0;
  // руны (усиливаются резонансом/крепежом)
  const rp = 1 + Math.max(0, m._runePow);
  if(!cr.noRunes) for(const r of save.runes){ if(r) RTYPE[r.type].apply(m, runeValue(r)*rp); }
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
    : 0;
  // тёмная валюта: генерится при искажении, пропорц. дебаффу и производству
  D.corrRate = save.corruption>0 ? save.corruption*0.05*(1+Math.max(0,Math.log10(1+Math.max(0,D.ops)))) : 0;
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
  recompute(); renderUps(); refreshTop(); queueSave();
  toast("⚡ "+u.name);
}

/* ---- Руны ---- */
function rollRune(){
  if(save.energy<1){ toast("Нет энергии рун"); return; }
  save.energy--;
  const rar=pickRarity(), type=RUNE_TYPES[Math.floor(Math.random()*RUNE_TYPES.length)];
  const r={ type:type.id, rar:rar, lvl:1 };
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
  recompute(); renderRunes(); refreshTop(); queueSave();
}

/* ---- Престиж ---- */
function doPrestige(auto){
  recompute();
  const g=prismGain(save.totalOof);
  if(g<1) return;
  const wasUnlocked = save.prestiges>=1;
  save.prisms+=g; save.prestiges++;
  // Мастерская: шестерёнки за престиж
  const conv=0.5+(save.workshopUps.wconv||0)*0.25;
  const gg=Math.floor(g*conv); if(gg>0){ save.gears+=gg; save.gearsEver=(save.gearsEver||0)+gg; }
  softReset();
  recompute(); syncNoobSprites();
  toast("💎 +"+fmt(g)+" призм"+(gg>0?"  ·  ⚙️ +"+fmt(gg):"")+(!wasUnlocked?"  ·  ⚙️ Мастерская открыта!":""));
  if(!auto) switchTab("prestige");
  renderAll(); refreshTop(); persist();
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
function doTranscend(){
  const g=quarkGain(save.stars); if(g<1) return;
  save.quarks+=g; save.transcends=(save.transcends||0)+1;
  const keep=Math.floor(save.stars*(save.quarkUps.qkeep||0)*0.03);
  save.stars=keep; save.prisms=0; save.prismUps={}; save.starUps={};
  softReset(); recompute(); syncNoobSprites();
  toast("⚛️ +"+fmt(g)+" кварков!"); switchTab("prestige"); renderAll(); refreshTop(); persist();
}
function buyQuarkUp(id){
  const q=QUARK_UP[id], l=save.quarkUps[id]||0; if(l>=q.max) return;
  const cost=q.cost(l); if(save.quarks<cost) return;
  save.quarks-=cost; save.quarkUps[id]=l+1;
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function setCorruption(d){
  save.corruption=Math.max(0,Math.min(50,(save.corruption||0)+d));
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function buyCorrUp(id){
  const c=CORR_UP[id], l=save.corrUps[id]||0; if(l>=c.max) return;
  const cost=c.cost(l); if(save.corr<cost) return;
  save.corr-=cost; save.corrUps[id]=l+1;
  recompute(); renderPrestige(); refreshTop(); queueSave();
}
function buyWorkshopUp(id){
  const w=WORKSHOP_UP[id]; const l=save.workshopUps[id]||0;
  if(l>=w.max) return;
  const cost=w.cost(l);
  if(save.gears<cost) return;
  save.gears-=cost; save.workshopUps[id]=l+1;
  recompute(); renderWorkshop(); refreshTop(); queueSave();
}
function softReset(){
  // Наследие нубов — оставляем часть армии
  const keep=(save.prismUps.keepnoob||0)*0.03;
  let kept={};
  if(keep>0){ for(const id in save.noobs){ const c=Math.floor((save.noobs[id]||0)*keep); if(c>0) kept[id]=c; } }
  save.oof=startOof(save.prismUps.start||0);
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
  // добыча руды в шахте
  if(D.oreRate>0){ const o=D.oreRate*edt; save.ore+=o; save.oreEver=(save.oreEver||0)+o; }
  // тёмная валюта искажения
  if(D.corrRate>0){ const cc=D.corrRate*edt; save.corr+=cc; save.corrEver=(save.corrEver||0)+cc; }
  if(D.autoMiner){ mnTimer+=edt; if(mnTimer>=0.5){ mnTimer=0; const c=minerCost();
    if(save.oof>=c && save.oof-c>c*0.5){ save.oof-=c; save.miners++; recompute(); } } }
  // авто-престиж (звёздный автопилот)
  if(D.autoPrestige){ apTimer+=edt; if(apTimer>=4){ apTimer=0;
    const g=prismGain(save.totalOof);
    if(g>=1 && g>=save.prisms*0.5+1){ doPrestige(true); } } }
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

  // периодические обновления UI (не каждый кадр)
  uiAcc+=dt;
  if(uiAcc>0.12){ uiAcc=0; refreshTop(); refreshLive(); checkAchievements(); tickPotions(); updateChalLive(); if(mutOpen) updateMutLive(); }
  saveTimer-=dt; if(saveTimer<0 && saveTimer>-1){ saveTimer=-2; persist(); }
  save.lastTime=Date.now();
  requestAnimationFrame(loop);
}
let uiAcc=0;
let abTimer=0;
let apTimer=0;
let mnTimer=0;
let boomTimer=0;
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
  else if(curTab==="ups") updateUpLive();
  else if(curTab==="prestige") updatePrestigeLive();
  else if(curTab==="runes") updateRuneLive();
  else if(curTab==="workshop") updateWorkshopLive();
  else if(curTab==="mining") updateMiningLive();
  else if(curTab==="alchemy") updateAlchemyLive();
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
function renderRunes(){
  renderSalvage();
  renderDustUps();
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
  const card=$("dropCard"); card.className="rune-drop "+rar.cls;
  card.innerHTML=`<div class="d-ico">${t.icon}</div><div class="d-rar">${rar.name}</div>
    <div class="d-name">${t.name}</div><div class="d-eff">${t.fmt(val)}</div>`;
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
  // трансценденция
  const canTrans = save.stars>=1000 || save.transcends>0 || save.quarks>0;
  $("transWrap").classList.toggle("hidden", !canTrans);
  if(canTrans){
    $("quarkGain").textContent=fmt(quarkGain(save.stars));
    const qbox=$("quarkUpList"); qbox.innerHTML="";
    QUARK_UPS.forEach(q=>{ const l=save.quarkUps[q.id]||0, maxed=l>=q.max, cost=q.cost(l);
      const row=document.createElement("div"); row.className="buyrow"; row.dataset.qup=q.id;
      row.innerHTML=upRowHTML(q.icon,q.name+" "+(l>0?"("+l+(q.max<50?"/"+q.max:"")+")":""),q.desc(l),l,q.max,maxed?"МАКС":"⚛️ "+fmt(cost),"quark");
      if(!maxed) row.addEventListener("click",()=>buyQuarkUp(q.id)); qbox.appendChild(row); });
  }
  // искажение
  const canCorr = save.transcends>0 || save.corruption>0 || save.corr>0;
  $("corrWrap").classList.toggle("hidden", !canCorr);
  if(canCorr){
    $("corrLvl").textContent=save.corruption;
    $("corrVal").textContent=fmt(save.corr);
    const cbox=$("corrUpList"); cbox.innerHTML="";
    CORR_UPS.forEach(c=>{ const l=save.corrUps[c.id]||0, maxed=l>=c.max, cost=c.cost(l);
      const row=document.createElement("div"); row.className="buyrow"; row.dataset.cup=c.id;
      row.innerHTML=upRowHTML(c.icon,c.name+" "+(l>0?"("+l+(c.max<50?"/"+c.max:"")+")":""),c.desc(l),l,c.max,maxed?"МАКС":"⚫ "+fmt(cost),"corr");
      if(!maxed) row.addEventListener("click",()=>buyCorrUp(c.id)); cbox.appendChild(row); });
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
  // трансценденция
  const qg=quarkGain(save.stars), tb=$("transBtn");
  if(tb){ tb.disabled=qg<1; $("quarkGain").textContent=fmt(qg);
    $("transNote").textContent=qg<1?("Нужно 1000 звёзд (есть "+fmt(save.stars)+")"):"Сбрасывает призмы, звёзды и их улучшения ради кварков"; }
  document.querySelectorAll("#quarkUpList .buyrow").forEach(row=>{ const q=QUARK_UP[row.dataset.qup]; const l=save.quarkUps[q.id]||0;
    if(l>=q.max) return; const cost=q.cost(l); row.classList.toggle("afford",save.quarks>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.quarks<cost); });
  // искажение
  const cn=$("corrNote");
  if(cn) cn.textContent = (save.corruption||0)>0
    ? ("Выработка ÷"+(1+save.corruption*0.4).toFixed(1)+" · тёмная валюта +"+fmt(D.corrRate||0)+"/с")
    : "Подними уровень, чтобы копить ⚫ (ценой производства)";
  const cv=$("corrVal"); if(cv) cv.textContent=fmt(save.corr);
  const cl=$("corrLvl"); if(cl) cl.textContent=save.corruption||0;
  document.querySelectorAll("#corrUpList .buyrow").forEach(row=>{ const c=CORR_UP[row.dataset.cup]; const l=save.corrUps[c.id]||0;
    if(l>=c.max) return; const cost=c.cost(l); row.classList.toggle("afford",save.corr>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.corr<cost); });
}

/* ---- Мастерская ---- */
function renderWorkshop(){
  $("gearBig").textContent=fmt(save.gears);
  $("gearRateTxt").textContent="+"+fmt(D.gearRate||0)+" ⚙️/с";
  const box=$("workshopList"); box.innerHTML="";
  WORKSHOP_UPS.forEach(w=>{
    const l=save.workshopUps[w.id]||0, maxed=l>=w.max, cost=w.cost(l);
    const row=document.createElement("div"); row.className="buyrow"; row.dataset.wup=w.id;
    row.innerHTML=upRowHTML(w.icon, w.name+" "+(l>0?"("+l+(w.max<50?"/"+w.max:"")+")":""), w.desc(l), l, w.max, maxed?"МАКС":"⚙️ "+fmt(cost), "gear");
    if(!maxed) row.addEventListener("click", ()=>buyWorkshopUp(w.id));
    box.appendChild(row);
  });
  updateWorkshopLive();
}
function updateWorkshopLive(){
  const gb=$("gearBig"); if(gb) gb.textContent=fmt(save.gears);
  const rt=$("gearRateTxt"); if(rt) rt.textContent="+"+fmt(D.gearRate||0)+" ⚙️/с";
  document.querySelectorAll("#workshopList .buyrow").forEach(row=>{
    const w=WORKSHOP_UP[row.dataset.wup]; const l=save.workshopUps[w.id]||0;
    if(l>=w.max) return; const cost=w.cost(l);
    row.classList.toggle("afford",save.gears>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.gears<cost);
  });
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
  const mb=$("minerBuy"); if(mb){ const c=minerCost();
    mb.classList.toggle("afford",save.oof>=c);
    mb.querySelector("[data-cnt]").textContent=fmt(save.miners);
    const ce=mb.querySelector("[data-cost]"); ce.textContent="🪙 "+fmt(c); ce.classList.toggle("cant",save.oof<c); }
  document.querySelectorAll("#miningList .buyrow").forEach(row=>{
    const mu=MINING_UP[row.dataset.miningup]; const l=save.miningUps[mu.id]||0;
    if(l>=mu.max) return; const cost=mu.cost(l);
    row.classList.toggle("afford",save.ore>=cost);
    const ce=row.querySelector("[data-cost]"); if(ce) ce.classList.toggle("cant",save.ore<cost);
  });
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
  else if(t==="ups") renderUps();
  else if(t==="runes") renderRunes();
  else if(t==="prestige") renderPrestige();
  else if(t==="workshop") renderWorkshop();
  else if(t==="mining") renderMining();
  else if(t==="alchemy") renderAlchemy();
}
document.querySelectorAll("#tabbar .tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));

function renderAll(){ renderNoobs();
  if(curTab==="ups")renderUps(); if(curTab==="runes")renderRunes();
  if(curTab==="prestige")renderPrestige(); if(curTab==="workshop")renderWorkshop();
  if(curTab==="mining")renderMining(); if(curTab==="alchemy")renderAlchemy(); }

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
  portalActive=false; $("portalModal").classList.add("hidden");
  refreshTop(); toast("🌀 Из портала: +"+fmt(won)+" Oof"); queueSave();
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
function buyAllQuark(){ if(massLeveled(QUARK_UPS,'quarkUps','quarks')){ recompute(); renderPrestige(); refreshTop(); queueSave(); } }
function buyAllCorr(){ if(massLeveled(CORR_UPS,'corrUps','corr')){ recompute(); renderPrestige(); refreshTop(); queueSave(); } }

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
    for(const d of WORKSHOP_UPS){ const l=save.workshopUps[d.id]||0; if(l<d.max && save.gears>=d.cost(l)){ save.gears-=d.cost(l); save.workshopUps[d.id]=l+1; changed=true; } } }
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
