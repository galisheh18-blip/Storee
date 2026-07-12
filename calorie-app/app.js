/* Калории и БЖУ — оффлайн PWA для дневника питания.
   Данные хранятся локально в браузере (localStorage). */

const STORE_KEY = "calorie-app-v1";

/* ---------- База продуктов (значения на 100 г) ---------- */
/* [название, ккал, белки, жиры, углеводы] */
const SEED = [
  ["Куриная грудка (варёная)", 137, 29.8, 1.8, 0.5],
  ["Куриное филе (сырое)", 110, 23, 1.2, 0],
  ["Говядина (варёная)", 254, 25.8, 16.8, 0],
  ["Свинина (нежирная)", 142, 19.4, 7.1, 0],
  ["Индейка (филе)", 104, 19.2, 2.2, 0],
  ["Лосось", 208, 20, 13, 0],
  ["Треска", 78, 17.7, 0.7, 0],
  ["Тунец (консерв. в собств. соку)", 96, 21, 1, 0],
  ["Креветки", 95, 19, 2.2, 0],
  ["Яйцо куриное", 157, 12.7, 11.5, 0.7],
  ["Яичный белок", 52, 11, 0, 0],
  ["Творог 5%", 121, 17, 5, 1.8],
  ["Творог 0%", 71, 16.5, 0, 1.3],
  ["Творог 9%", 159, 16.7, 9, 2],
  ["Молоко 2.5%", 52, 2.8, 2.5, 4.7],
  ["Кефир 1%", 40, 3, 1, 4],
  ["Йогурт натуральный", 66, 5, 3.2, 3.5],
  ["Греческий йогурт 2%", 73, 9, 2, 3.8],
  ["Сыр 45%", 340, 23, 27, 0],
  ["Сметана 15%", 158, 2.6, 15, 3],
  ["Овсянка (сухая)", 366, 12, 6.5, 62],
  ["Гречка (сухая)", 343, 13, 3.4, 62],
  ["Рис белый (сухой)", 344, 6.7, 0.7, 78],
  ["Рис бурый (сухой)", 337, 7.4, 1.8, 72],
  ["Макароны (сухие)", 344, 10.4, 1.1, 71],
  ["Хлеб белый", 265, 8, 3.2, 49],
  ["Хлеб ржаной", 210, 6.6, 1.2, 42],
  ["Картофель (варёный)", 82, 2, 0.4, 17],
  ["Картофель фри", 312, 3.4, 15, 41],
  ["Банан", 95, 1.5, 0.2, 21],
  ["Яблоко", 47, 0.4, 0.4, 10],
  ["Апельсин", 43, 0.9, 0.2, 8.1],
  ["Виноград", 65, 0.6, 0.2, 16],
  ["Клубника", 33, 0.7, 0.3, 7],
  ["Авокадо", 160, 2, 15, 9],
  ["Помидор", 20, 0.9, 0.2, 3.7],
  ["Огурец", 15, 0.8, 0.1, 2.5],
  ["Морковь", 35, 1.3, 0.1, 6.9],
  ["Брокколи", 34, 2.8, 0.4, 7],
  ["Капуста белокочанная", 27, 1.8, 0.1, 4.7],
  ["Салат листовой", 15, 1.4, 0.2, 2],
  ["Гриб шампиньон", 22, 4.3, 1, 0.1],
  ["Фасоль (варёная)", 123, 7.8, 0.5, 21],
  ["Чечевица (варёная)", 116, 9, 0.4, 20],
  ["Орех грецкий", 654, 15, 65, 14],
  ["Миндаль", 579, 21, 49, 22],
  ["Арахисовая паста", 588, 25, 50, 20],
  ["Масло сливочное", 748, 0.5, 82.5, 0.8],
  ["Масло растительное", 899, 0, 99.9, 0],
  ["Сахар", 399, 0, 0, 99.7],
  ["Мёд", 329, 0.8, 0, 81],
  ["Шоколад молочный", 550, 6.9, 35, 54],
  ["Протеин (сыв., порошок)", 400, 80, 6, 8],
  ["Кофе без сахара", 2, 0.2, 0, 0.3],
  ["Кола", 42, 0, 0, 10.6],
];

function seedFoods() {
  return SEED.map((r) => ({ id: uid(), name: r[0], kcal: r[1], p: r[2], f: r[3], c: r[4], barcode: "", fav: false, custom: false }));
}

/* ---------- Состояние ---------- */
function defaultState() {
  return {
    settings: { autoNorm: true, manualCal: 2000, macroPct: { p: 30, f: 30, c: 40 }, waterGoal: 2000 },
    profile: { sex: "m", age: 30, height: 175, weight: 75, activity: 1.55, goal: "maintain" },
    foods: seedFoods(),
    recipes: [],
    diary: {},        // { 'YYYY-MM-DD': { meals:[...], water:0, exercise:[...] } }
    weightLog: [],    // [{ date, weight, waist, fat }]
    recent: [],       // id последних использованных продуктов/рецептов
  };
}

let state = load();
let viewDate = todayKey();
let picked = null; // выбранный продукт/рецепт в форме добавления

function uid() { return Math.random().toString(36).slice(2, 10); }

function migrate(s) {
  if (!s.settings) s.settings = {};
  const d = defaultState().settings;
  s.settings = Object.assign({}, d, s.settings);
  if (!s.settings.macroPct) s.settings.macroPct = { p: 30, f: 30, c: 40 };
  if (!s.profile) s.profile = defaultState().profile;
  if (!Array.isArray(s.foods)) s.foods = seedFoods();
  if (!Array.isArray(s.recipes)) s.recipes = [];
  if (!s.diary || typeof s.diary !== "object") s.diary = {};
  if (!Array.isArray(s.weightLog)) s.weightLog = [];
  if (!Array.isArray(s.recent)) s.recent = [];
  s.foods.forEach((f) => { if (!("fav" in f)) f.fav = false; if (!("barcode" in f)) f.barcode = ""; });
  return s;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {}
  const s = defaultState();
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Даты ---------- */
function todayKey() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function shiftDay(key, delta) { const [y, m, d] = key.split("-").map(Number); const dt = new Date(y, m - 1, d + delta); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
const WDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function dayLabel(key) {
  if (key === todayKey()) return "Сегодня";
  if (key === shiftDay(todayKey(), -1)) return "Вчера";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return WDAYS[dt.getDay()] + ", " + d + " " + MONTHS_SHORT[m - 1];
}

/* ---------- Дневник: доступ ---------- */
function day(key) {
  if (!state.diary[key]) state.diary[key] = { meals: [], water: 0, exercise: [] };
  const d = state.diary[key];
  if (!Array.isArray(d.meals)) d.meals = [];
  if (!Array.isArray(d.exercise)) d.exercise = [];
  if (typeof d.water !== "number") d.water = 0;
  return d;
}
const MEALS = [
  { id: "breakfast", icon: "🌅", name: "Завтрак" },
  { id: "lunch", icon: "☀️", name: "Обед" },
  { id: "dinner", icon: "🌙", name: "Ужин" },
  { id: "snack", icon: "🍎", name: "Перекус" },
];

function dayTotals(key) {
  const d = day(key);
  let kcal = 0, p = 0, f = 0, c = 0;
  for (const m of d.meals) { kcal += m.kcal; p += m.p; f += m.f; c += m.c; }
  const burned = d.exercise.reduce((a, e) => a + (Number(e.kcal) || 0), 0);
  return { kcal, p, f, c, burned, water: d.water };
}

/* ---------- Цели: норма и БЖУ ---------- */
function calcNorm() {
  const pr = state.profile;
  const w = Number(pr.weight) || 0, h = Number(pr.height) || 0, a = Number(pr.age) || 0;
  const bmr = 10 * w + 6.25 * h - 5 * a + (pr.sex === "f" ? -161 : 5);
  const tdee = bmr * (Number(pr.activity) || 1.2);
  let goal = tdee;
  if (pr.goal === "lose") goal = tdee * 0.85;
  else if (pr.goal === "gain") goal = tdee * 1.10;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), goal: Math.round(goal) };
}
function goalCalories() {
  return state.settings.autoNorm ? calcNorm().goal : (Number(state.settings.manualCal) || 0);
}
function goalMacros() {
  const cal = goalCalories();
  const m = state.settings.macroPct;
  return {
    kcal: cal,
    p: Math.round((cal * (Number(m.p) || 0) / 100) / 4),
    f: Math.round((cal * (Number(m.f) || 0) / 100) / 9),
    c: Math.round((cal * (Number(m.c) || 0) / 100) / 4),
  };
}

/* ---------- Стрик ---------- */
function calcStreak() {
  let n = 0, key = todayKey();
  // если сегодня пусто — считаем со вчера
  const hasEntries = (k) => state.diary[k] && state.diary[k].meals && state.diary[k].meals.length > 0;
  if (!hasEntries(key)) key = shiftDay(key, -1);
  while (hasEntries(key)) { n++; key = shiftDay(key, -1); }
  return n;
}

/* ---------- Рецепты: КБЖУ на порцию ---------- */
function recipeTotals(r) {
  let kcal = 0, p = 0, f = 0, c = 0, grams = 0;
  for (const it of r.items) {
    const food = state.foods.find((x) => x.id === it.foodId);
    if (!food) continue;
    const k = (Number(it.grams) || 0) / 100;
    kcal += food.kcal * k; p += food.p * k; f += food.f * k; c += food.c * k; grams += Number(it.grams) || 0;
  }
  const s = Math.max(1, Number(r.servings) || 1);
  return { kcal: kcal / s, p: p / s, f: f / s, c: c / s, grams: grams / s };
}

/* ---------- Рендер: Дневник ---------- */
function renderDiary() {
  document.getElementById("dayTitle").textContent = dayLabel(viewDate);
  const t = dayTotals(viewDate);
  const g = goalMacros();
  const remaining = g.kcal - t.kcal + t.burned;

  // Кольцо калорий
  const R = 52, CIRC = 2 * Math.PI * R;
  const consumedNet = t.kcal;
  const pct = g.kcal > 0 ? consumedNet / g.kcal : 0;
  const dash = Math.min(1, pct) * CIRC;
  const ring = document.getElementById("calRing");
  ring.setAttribute("stroke-dasharray", dash + " " + (CIRC - dash));
  ring.classList.toggle("over", consumedNet > g.kcal && g.kcal > 0);
  document.getElementById("calNum").textContent = Math.round(t.kcal);
  document.getElementById("calCap").textContent = "из " + g.kcal + " ккал";
  const hint = document.getElementById("calHint");
  if (remaining >= 0) { hint.textContent = "осталось " + Math.round(remaining) + " ккал"; hint.classList.remove("over"); }
  else { hint.textContent = "перебор " + Math.round(-remaining) + " ккал"; hint.classList.add("over"); }

  // Макро-бары
  setMacro("p", t.p, g.p);
  setMacro("f", t.f, g.f);
  setMacro("c", t.c, g.c);

  // Чипсы
  document.getElementById("waterStat").textContent = t.water + " / " + (state.settings.waterGoal || 0) + " мл";
  document.getElementById("burnStat").textContent = "−" + Math.round(t.burned) + " ккал";
  document.getElementById("streakTxt").textContent = calcStreak() + " дн.";

  // Приёмы пищи
  const wrap = document.getElementById("mealsWrap");
  wrap.innerHTML = "";
  const d = day(viewDate);
  for (const meal of MEALS) {
    const items = d.meals.filter((m) => m.meal === meal.id);
    const mk = items.reduce((a, m) => a + m.kcal, 0);
    const block = document.createElement("div");
    block.className = "meal-block";
    let rows = items.map((m) => `
      <div class="meal-item" data-edit="${m.id}">
        <div class="mi-main">
          <div class="mi-name">${escapeHtml(m.name)}</div>
          <div class="mi-sub">${Math.round(m.grams)} г · Б ${r1(m.p)} · Ж ${r1(m.f)} · У ${r1(m.c)}</div>
        </div>
        <div class="mi-kcal">${Math.round(m.kcal)}</div>
      </div>`).join("");
    if (!items.length) rows = `<div class="meal-empty">Ничего не добавлено</div>`;
    block.innerHTML = `
      <div class="meal-head">
        <span style="font-size:18px">${meal.icon}</span>
        <span class="mh-title">${meal.name}</span>
        <span class="mh-kcal">${Math.round(mk)} ккал</span>
        <button class="meal-add" data-add-meal="${meal.id}" title="Добавить">＋</button>
      </div>${rows}`;
    wrap.appendChild(block);
  }

  // Активность
  const exList = document.getElementById("exerciseList");
  exList.innerHTML = "";
  if (!d.exercise.length) exList.innerHTML = `<div class="empty">Тренировок нет</div>`;
  for (const ex of d.exercise) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main"><div class="row-title">🏃 ${escapeHtml(ex.name)}</div><div class="row-sub">сожжено калорий</div></div>
      <div class="row-amount">−${Math.round(ex.kcal)}</div>
      <button class="icon-btn" data-del-ex="${ex.id}" title="Удалить">✕</button>`;
    exList.appendChild(row);
  }
}
function setMacro(key, cur, goal) {
  const pct = goal > 0 ? Math.min(100, (cur / goal) * 100) : 0;
  const bar = document.getElementById(key + "Bar");
  bar.style.width = pct + "%";
  bar.classList.toggle("over", goal > 0 && cur > goal);
  document.getElementById(key + "Txt").textContent = r1(cur) + " / " + goal + " г";
}

/* ---------- Рендер: Добавить ---------- */
function renderQuickPicks() {
  const box = document.getElementById("quickPicks");
  const favs = state.foods.filter((f) => f.fav);
  const recentItems = state.recent.map((id) => findItem(id)).filter(Boolean).slice(0, 8);
  const seen = new Set();
  const list = [];
  for (const it of [...favs, ...recentItems]) {
    if (seen.has(it.id)) continue; seen.add(it.id); list.push(it);
    if (list.length >= 10) break;
  }
  if (!list.length) { box.innerHTML = ""; return; }
  box.innerHTML = list.map((it) =>
    `<button type="button" class="qp" data-pick="${it.id}">${it.fav ? "⭐ " : ""}${escapeHtml(it.name)}</button>`).join("");
}
function findItem(id) {
  const f = state.foods.find((x) => x.id === id);
  if (f) return { ...f, kind: "food" };
  const r = state.recipes.find((x) => x.id === id);
  if (r) { const t = recipeTotals(r); return { id: r.id, name: r.name, kcal: t.kcal, p: t.p, f: t.f, c: t.c, kind: "recipe", perServing: true }; }
  return null;
}
function searchFoods(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const r of state.recipes) {
    if (r.name.toLowerCase().includes(q)) { const t = recipeTotals(r); out.push({ id: r.id, name: r.name, kcal: t.kcal, p: t.p, f: t.f, c: t.c, kind: "recipe", tag: "recipe" }); }
  }
  for (const f of state.foods) {
    if (f.name.toLowerCase().includes(q) || (f.barcode && f.barcode.includes(q)))
      out.push({ ...f, kind: "food", tag: f.custom ? "custom" : "" });
  }
  return out.slice(0, 30);
}
function renderResults() {
  const q = document.getElementById("foodSearch").value;
  const box = document.getElementById("foodResults");
  const res = searchFoods(q);
  if (!q.trim()) { box.classList.remove("show"); box.innerHTML = ""; return; }
  if (!res.length) { box.classList.add("show"); box.innerHTML = `<div class="fr-item"><div class="fr-sub">Ничего не найдено. Добавьте продукт на вкладке «Продукты».</div></div>`; return; }
  box.classList.add("show");
  box.innerHTML = res.map((it) => {
    const tag = it.tag === "recipe" ? `<span class="fr-tag recipe">рецепт</span>` : it.tag === "custom" ? `<span class="fr-tag custom">своё</span>` : "";
    const unit = it.kind === "recipe" ? "порция" : "100 г";
    return `<div class="fr-item" data-pick="${it.id}">
      <div class="fr-name">${escapeHtml(it.name)}${tag}</div>
      <div class="fr-sub">${Math.round(it.kcal)} ккал / ${unit} · Б ${r1(it.p)} Ж ${r1(it.f)} У ${r1(it.c)}</div></div>`;
  }).join("");
}
function pickItem(id) {
  const it = findItem(id);
  if (!it) return;
  picked = it;
  document.getElementById("foodResults").classList.remove("show");
  document.getElementById("foodSearch").value = "";
  const box = document.getElementById("pickedBox");
  box.classList.remove("hidden");
  document.getElementById("pickedName").textContent = it.name + (it.kind === "recipe" ? " (рецепт)" : "");
  const grams = document.getElementById("addGrams");
  document.getElementById("gramsLabel").textContent = it.kind === "recipe" ? "Порции" : "Количество, г";
  grams.value = it.kind === "recipe" ? 1 : 100;
  grams.step = it.kind === "recipe" ? 0.5 : 1;
  updatePickedMacros();
  grams.focus();
}
function scaledMacros() {
  if (!picked) return null;
  const amt = parseFloat(document.getElementById("addGrams").value) || 0;
  const k = picked.kind === "recipe" ? amt : amt / 100;
  return { kcal: picked.kcal * k, p: picked.p * k, f: picked.f * k, c: picked.c * k, amt };
}
function updatePickedMacros() {
  const s = scaledMacros();
  if (!s) return;
  document.getElementById("pickedMacros").innerHTML = `
    <span class="pm-pill kcal">${Math.round(s.kcal)} ккал</span>
    <span class="pm-pill">Б ${r1(s.p)}</span>
    <span class="pm-pill">Ж ${r1(s.f)}</span>
    <span class="pm-pill">У ${r1(s.c)}</span>`;
}
function clearPicked() {
  picked = null;
  document.getElementById("pickedBox").classList.add("hidden");
}

/* ---------- Рендер: Продукты и рецепты ---------- */
function renderFoods() {
  // рецепты
  const rl = document.getElementById("recipeList");
  rl.innerHTML = "";
  if (!state.recipes.length) rl.innerHTML = `<div class="empty">Рецептов пока нет</div>`;
  for (const r of state.recipes) {
    const t = recipeTotals(r);
    const row = document.createElement("div");
    row.className = "row clickable";
    row.dataset.editRecipe = r.id;
    row.innerHTML = `
      <div class="row-main"><div class="row-title">🍲 ${escapeHtml(r.name)}</div>
        <div class="row-sub">${r.items.length} ингр. · ${r.servings} порц. · ${Math.round(t.kcal)} ккал/порц</div></div>
      <button class="icon-btn" data-del-recipe="${r.id}" title="Удалить">✕</button>`;
    rl.appendChild(row);
  }

  // база продуктов
  const q = (document.getElementById("foodDbSearch").value || "").trim().toLowerCase();
  const list = document.getElementById("foodDbList");
  list.innerHTML = "";
  const foods = state.foods
    .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.barcode && f.barcode.includes(q)))
    .sort((a, b) => (b.fav - a.fav) || a.name.localeCompare(b.name, "ru"));
  if (!foods.length) { list.innerHTML = `<div class="empty">Ничего не найдено</div>`; return; }
  for (const f of foods.slice(0, 200)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <button class="fav-star" data-fav="${f.id}" title="В избранное">${f.fav ? "⭐" : "☆"}</button>
      <div class="row-main clickable-food" data-edit-food="${f.id}" style="cursor:pointer">
        <div class="row-title">${escapeHtml(f.name)}${f.custom ? " ✎" : ""}</div>
        <div class="row-sub">${Math.round(f.kcal)} ккал · Б ${r1(f.p)} · Ж ${r1(f.f)} · У ${r1(f.c)} / 100 г</div>
      </div>
      <button class="icon-btn" data-del-food="${f.id}" title="Удалить">✕</button>`;
    list.appendChild(row);
  }
}

/* ---------- Рендер: Графики ---------- */
function renderCharts() {
  // Калории за 7 дней + линия цели
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(viewDate, -i);
    const t = dayTotals(key);
    const [, , dd] = key.split("-");
    const [yy, mm] = key.split("-").map(Number);
    const wd = new Date(yy, mm - 1, Number(dd)).getDay();
    days.push({ key, label: WDAYS[wd], value: t.kcal });
  }
  const goal = goalCalories();
  const maxV = Math.max(goal, 1, ...days.map((d) => d.value));
  const W = 320, H = 150, gap = 10, bw = (W - gap * 6) / 7;
  let bars = "";
  days.forEach((d, i) => {
    const h = Math.round((d.value / maxV) * H);
    const x = i * (bw + gap), y = H - h;
    const over = goal > 0 && d.value > goal;
    const cur = d.key === viewDate;
    const color = over ? "#dc2626" : cur ? "#16a34a" : "#86efac";
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="4" fill="${color}"></rect>`;
    bars += `<text x="${x + bw / 2}" y="${H + 15}" text-anchor="middle" class="cx-lbl">${d.label}</text>`;
    if (d.value > 0) bars += `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" class="cx-val">${Math.round(d.value)}</text>`;
  });
  let goalLine = "";
  if (goal > 0) {
    const gy = H - (goal / maxV) * H;
    goalLine = `<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" class="goal-line"></line>
      <text x="${W}" y="${gy - 4}" text-anchor="end" class="cx-val" fill="#dc2626">цель ${goal}</text>`;
  }
  document.getElementById("calChart").innerHTML = days.every((d) => d.value === 0)
    ? `<div class="empty">Пока нет записей о питании</div>`
    : `<svg viewBox="0 -14 ${W} ${H + 24}" width="100%" class="svg-chart">${goalLine}${bars}</svg>`;

  // БЖУ за день (пончик, по калорийности)
  const t = dayTotals(viewDate);
  const parts = [
    { name: "Белки", g: t.p, kcal: t.p * 4, color: "#6366f1" },
    { name: "Жиры", g: t.f, kcal: t.f * 9, color: "#f59e0b" },
    { name: "Углеводы", g: t.c, kcal: t.c * 4, color: "#14b8a6" },
  ];
  const totKcal = parts.reduce((a, s) => a + s.kcal, 0);
  const donut = document.getElementById("macroChart");
  if (!totKcal) { donut.innerHTML = `<div class="empty">Нет данных за этот день</div>`; }
  else {
    const R = 60, C = 2 * Math.PI * R;
    let off = 0, ring = "";
    for (const s of parts) {
      if (s.kcal <= 0) continue;
      const len = (s.kcal / totKcal) * C;
      ring += `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${s.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"></circle>`;
      off += len;
    }
    const legend = parts.map((s) =>
      `<div class="lg-row"><span class="lg-dot" style="background:${s.color}"></span>
        <span class="lg-name">${s.name}</span>
        <span class="lg-val">${r1(s.g)} г · ${Math.round((s.kcal / totKcal) * 100)}%</span></div>`).join("");
    donut.innerHTML = `<div class="donut-wrap">
      <svg viewBox="0 0 160 160" width="160" height="160" class="svg-chart">${ring}
        <text x="80" y="76" text-anchor="middle" class="cx-mid">${Math.round(t.kcal)}</text>
        <text x="80" y="94" text-anchor="middle" class="cx-sub">ккал</text></svg>
      <div class="legend">${legend}</div></div>`;
  }

  // Динамика веса
  renderWeightChart();
}
function renderWeightChart() {
  const log = [...state.weightLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-20);
  const box = document.getElementById("weightChart");
  if (log.length < 2) { box.innerHTML = `<div class="empty">Добавьте минимум 2 замера веса</div>`; return; }
  const vals = log.map((x) => Number(x.weight));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 320, H = 140, pad = 8;
  const pts = log.map((x, i) => {
    const px = pad + (i / (log.length - 1)) * (W - pad * 2);
    const py = pad + (1 - (Number(x.weight) - min) / range) * (H - pad * 2);
    return [px, py];
  });
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const dots = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="#16a34a"></circle>`).join("");
  const first = log[0], last = log[log.length - 1];
  const diff = (Number(last.weight) - Number(first.weight)).toFixed(1);
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H + 18}" width="100%" class="svg-chart">
      <path d="${path}" fill="none" stroke="#16a34a" stroke-width="2"></path>${dots}
      <text x="0" y="${H + 14}" class="cx-lbl">${first.date.slice(5)}: ${first.weight} кг</text>
      <text x="${W}" y="${H + 14}" text-anchor="end" class="cx-lbl">${last.weight} кг (${diff > 0 ? "+" + diff : diff})</text>
    </svg>`;
}

/* ---------- Рендер: Ещё ---------- */
function renderMore() {
  const pr = state.profile;
  document.querySelectorAll("#profileForm .seg").forEach((b) => b.classList.toggle("active", b.dataset.sex === pr.sex));
  document.getElementById("pAge").value = pr.age;
  document.getElementById("pHeight").value = pr.height;
  document.getElementById("pWeight").value = pr.weight;
  document.getElementById("pActivity").value = String(pr.activity);
  document.getElementById("pGoal").value = pr.goal;

  const n = calcNorm();
  document.getElementById("bmrVal").textContent = n.bmr + " ккал";
  document.getElementById("tdeeVal").textContent = n.tdee + " ккал";
  document.getElementById("normVal").textContent = n.goal + " ккал";

  const st = state.settings;
  document.getElementById("autoNormToggle").classList.toggle("on", st.autoNorm);
  document.getElementById("manualCalField").style.display = st.autoNorm ? "none" : "";
  document.getElementById("manualCal").value = st.manualCal;
  document.getElementById("mPctP").value = st.macroPct.p;
  document.getElementById("mPctF").value = st.macroPct.f;
  document.getElementById("mPctC").value = st.macroPct.c;
  document.getElementById("waterGoal").value = st.waterGoal;
  updatePctHint();

  // журнал веса
  const wl = document.getElementById("weightLog");
  wl.innerHTML = "";
  const log = [...state.weightLog].sort((a, b) => b.date.localeCompare(a.date));
  if (!log.length) wl.innerHTML = `<div class="empty">Замеров пока нет</div>`;
  for (const x of log) {
    const extra = [x.waist ? "талия " + x.waist + " см" : "", x.fat ? x.fat + "% жира" : ""].filter(Boolean).join(" · ");
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main"><div class="row-title">${x.weight} кг</div>
        <div class="row-sub">${x.date.slice(5)}${extra ? " · " + extra : ""}</div></div>
      <button class="icon-btn" data-del-weight="${x.date}" title="Удалить">✕</button>`;
    wl.appendChild(row);
  }
}
function updatePctHint() {
  const sum = (Number(document.getElementById("mPctP").value) || 0) + (Number(document.getElementById("mPctF").value) || 0) + (Number(document.getElementById("mPctC").value) || 0);
  const el = document.getElementById("pctHint");
  const g = goalMacros();
  el.textContent = `Сумма: ${sum}%${sum !== 100 ? " (рекомендуется 100%)" : " ✓"} · при норме ${g.kcal} ккал → Б ${g.p} г, Ж ${g.f} г, У ${g.c} г`;
  el.style.color = sum === 100 ? "var(--green)" : "var(--amber)";
}

function renderAll() {
  renderDiary();
  renderQuickPicks();
  renderFoods();
  renderCharts();
  renderMore();
}

/* ---------- Хелперы ---------- */
function r1(n) { return (Math.round(n * 10) / 10).toString(); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._timer); t._timer = setTimeout(() => t.classList.add("hidden"), 1800);
}
function pushRecent(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 12);
}

/* ---------- Модалка ---------- */
function openModal(html) { document.getElementById("modalBody").innerHTML = html; document.getElementById("modal").classList.remove("hidden"); }
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function openEditEntry(id) {
  const d = day(viewDate);
  const item = d.meals.find((m) => m.id === id);
  if (!item) return;
  const mealOpts = MEALS.map((m) => `<option value="${m.id}" ${m.id === item.meal ? "selected" : ""}>${m.icon} ${m.name}</option>`).join("");
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>${escapeHtml(item.name)}</h3>
    <div class="field"><label>Приём пищи</label><select id="mMeal">${mealOpts}</select></div>
    <div class="field"><label>${item.perUnit === "serving" ? "Порции" : "Количество, г"}</label>
      <input type="number" id="mGrams" inputmode="decimal" step="${item.perUnit === "serving" ? "0.5" : "1"}" min="0" value="${item.grams}" /></div>
    <div class="picked-macros" id="mMacros"></div>
    <div class="modal-actions">
      <button class="btn ghost danger" id="mDelete">Удалить</button>
      <button class="btn primary" id="mSave">Сохранить</button>
    </div>`);
  const base = { kcal: item.kcal / item.grams, p: item.p / item.grams, f: item.f / item.grams, c: item.c / item.grams };
  const upd = () => {
    const g = parseFloat(document.getElementById("mGrams").value) || 0;
    document.getElementById("mMacros").innerHTML = `
      <span class="pm-pill kcal">${Math.round(base.kcal * g)} ккал</span>
      <span class="pm-pill">Б ${r1(base.p * g)}</span>
      <span class="pm-pill">Ж ${r1(base.f * g)}</span>
      <span class="pm-pill">У ${r1(base.c * g)}</span>`;
  };
  upd();
  document.getElementById("mGrams").addEventListener("input", upd);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mDelete").onclick = () => {
    d.meals = d.meals.filter((m) => m.id !== id);
    save(); closeModal(); renderAll(); toast("Удалено");
  };
  document.getElementById("mSave").onclick = () => {
    const g = parseFloat(document.getElementById("mGrams").value);
    if (!(g > 0)) return;
    item.grams = g; item.kcal = base.kcal * g; item.p = base.p * g; item.f = base.f * g; item.c = base.c * g;
    item.meal = document.getElementById("mMeal").value;
    save(); closeModal(); renderAll(); toast("Сохранено");
  };
}

function openFoodEdit(id) {
  const f = state.foods.find((x) => x.id === id);
  if (!f) return;
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Редактировать продукт</h3>
    <div class="field"><label>Название</label><input type="text" id="eName" value="${escapeHtml(f.name)}" maxlength="50" /></div>
    <div class="field-row">
      <div class="field"><label>Ккал / 100 г</label><input type="number" id="eKcal" step="0.1" min="0" value="${f.kcal}" /></div>
      <div class="field"><label>Белки</label><input type="number" id="eP" step="0.1" min="0" value="${f.p}" /></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Жиры</label><input type="number" id="eF" step="0.1" min="0" value="${f.f}" /></div>
      <div class="field"><label>Углеводы</label><input type="number" id="eC" step="0.1" min="0" value="${f.c}" /></div>
    </div>
    <div class="field"><label>Штрих-код</label><input type="text" id="eBarcode" value="${escapeHtml(f.barcode || "")}" /></div>
    <div class="modal-actions">
      <button class="btn ghost danger" id="mDelete">Удалить</button>
      <button class="btn primary" id="mSave">Сохранить</button>
    </div>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mDelete").onclick = () => {
    state.foods = state.foods.filter((x) => x.id !== id);
    save(); closeModal(); renderAll(); toast("Продукт удалён");
  };
  document.getElementById("mSave").onclick = () => {
    const name = document.getElementById("eName").value.trim();
    const kcal = parseFloat(document.getElementById("eKcal").value);
    if (!name || !(kcal >= 0)) { toast("Заполните название и ккал"); return; }
    f.name = name; f.kcal = kcal;
    f.p = parseFloat(document.getElementById("eP").value) || 0;
    f.f = parseFloat(document.getElementById("eF").value) || 0;
    f.c = parseFloat(document.getElementById("eC").value) || 0;
    f.barcode = document.getElementById("eBarcode").value.trim();
    f.custom = true;
    save(); closeModal(); renderAll(); toast("Сохранено");
  };
}

/* ---------- Модалка рецепта ---------- */
function openRecipeModal(id) {
  const editing = state.recipes.find((r) => r.id === id);
  const draft = editing ? JSON.parse(JSON.stringify(editing)) : { id: uid(), name: "", servings: 1, items: [] };
  const render = () => {
    const t = recipeTotals(draft);
    const rows = draft.items.map((it, i) => {
      const food = state.foods.find((x) => x.id === it.foodId);
      return `<div class="ri-row">
        <span class="ri-name">${food ? escapeHtml(food.name) : "?"}</span>
        <input type="number" data-ri="${i}" value="${it.grams}" min="0" step="1" /> г
        <button class="icon-btn" data-ri-del="${i}">✕</button></div>`;
    }).join("");
    const foodOpts = state.foods.slice().sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join("");
    openModal(`
      <button class="modal-close" id="mClose">✕</button>
      <h3>${editing ? "Рецепт" : "Новый рецепт"}</h3>
      <div class="field"><label>Название</label><input type="text" id="rName" value="${escapeHtml(draft.name)}" maxlength="50" placeholder="Например: Овсянка с бананом" /></div>
      <div class="field"><label>Порций</label><input type="number" id="rServings" min="1" step="1" value="${draft.servings}" /></div>
      <label style="font-size:12px;color:var(--muted);font-weight:600">Ингредиенты</label>
      <div id="riList">${rows || `<div class="hint" style="margin:4px 0">Пока пусто</div>`}</div>
      <div class="ri-row">
        <select id="riFood" style="flex:1">${foodOpts}</select>
        <input type="number" id="riGrams" placeholder="г" min="0" step="1" value="100" style="width:80px" />
        <button class="icon-btn" id="riAdd" title="Добавить">➕</button>
      </div>
      <div class="picked-macros" style="margin:12px 0">
        <span class="pm-pill kcal">${Math.round(t.kcal)} ккал/порц</span>
        <span class="pm-pill">Б ${r1(t.p)}</span><span class="pm-pill">Ж ${r1(t.f)}</span><span class="pm-pill">У ${r1(t.c)}</span>
      </div>
      <div class="modal-actions">
        ${editing ? `<button class="btn ghost danger" id="rDelete">Удалить</button>` : ""}
        <button class="btn primary" id="rSave">Сохранить рецепт</button>
      </div>`);
    document.getElementById("mClose").onclick = closeModal;
    document.getElementById("rName").addEventListener("input", (e) => { draft.name = e.target.value; });
    document.getElementById("rServings").addEventListener("input", (e) => { draft.servings = Math.max(1, parseInt(e.target.value) || 1); });
    document.getElementById("riAdd").onclick = () => {
      const fid = document.getElementById("riFood").value;
      const g = parseFloat(document.getElementById("riGrams").value) || 0;
      if (fid && g > 0) { draft.items.push({ foodId: fid, grams: g }); render(); }
    };
    document.querySelectorAll("[data-ri]").forEach((inp) => inp.addEventListener("input", (e) => {
      draft.items[Number(e.target.dataset.ri)].grams = parseFloat(e.target.value) || 0;
    }));
    document.querySelectorAll("[data-ri-del]").forEach((b) => b.onclick = () => { draft.items.splice(Number(b.dataset.riDel), 1); render(); });
    if (editing) document.getElementById("rDelete").onclick = () => {
      state.recipes = state.recipes.filter((r) => r.id !== id);
      save(); closeModal(); renderAll(); toast("Рецепт удалён");
    };
    document.getElementById("rSave").onclick = () => {
      draft.name = document.getElementById("rName").value.trim();
      if (!draft.name) { toast("Введите название"); return; }
      if (!draft.items.length) { toast("Добавьте ингредиенты"); return; }
      if (editing) Object.assign(editing, draft);
      else state.recipes.push(draft);
      save(); closeModal(); renderAll(); toast("Рецепт сохранён");
    };
  };
  render();
}

/* ---------- Модалка тренировки ---------- */
function openExerciseModal() {
  const presets = [["🚶 Ходьба 30 мин", 120], ["🏃 Бег 30 мин", 300], ["🚴 Велосипед 30 мин", 250], ["🏊 Плавание 30 мин", 300], ["💪 Силовая 45 мин", 250], ["🧘 Йога 45 мин", 150]];
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Добавить активность</h3>
    <div class="quick-picks" style="margin-bottom:12px">
      ${presets.map((p, i) => `<button type="button" class="qp" data-ex-preset="${i}">${p[0]} · ${p[1]}</button>`).join("")}
    </div>
    <div class="field"><label>Название</label><input type="text" id="exName" placeholder="Тренировка" maxlength="40" /></div>
    <div class="field"><label>Сожжено калорий</label><input type="number" id="exKcal" inputmode="numeric" min="0" step="10" placeholder="200" /></div>
    <button class="btn primary" id="exSave">Добавить</button>`);
  document.getElementById("mClose").onclick = closeModal;
  document.querySelectorAll("[data-ex-preset]").forEach((b) => b.onclick = () => {
    const p = presets[Number(b.dataset.exPreset)];
    document.getElementById("exName").value = p[0].replace(/^\S+\s/, "");
    document.getElementById("exKcal").value = p[1];
  });
  document.getElementById("exSave").onclick = () => {
    const name = document.getElementById("exName").value.trim() || "Тренировка";
    const kcal = parseFloat(document.getElementById("exKcal").value);
    if (!(kcal > 0)) { toast("Укажите калории"); return; }
    day(viewDate).exercise.push({ id: uid(), name, kcal });
    save(); closeModal(); renderAll(); toast("Активность добавлена");
  };
}

/* ---------- Экспорт / импорт ---------- */
function openExportModal() {
  const json = JSON.stringify(state, null, 2);
  const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
  const fname = "calories-backup-" + todayKey() + ".json";
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Экспорт данных</h3>
    <p class="hint">Скачайте файл или скопируйте текст и сохраните в надёжном месте.</p>
    <a class="btn primary" id="mDownload" href="${dataUrl}" download="${fname}">📥 Скачать файл</a>
    <button class="btn ghost" id="mCopy">Скопировать текст</button>
    <textarea id="mJson" class="backup-area" readonly>${escapeHtml(json)}</textarea>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(json); toast("Скопировано"); }
    catch (e) { const t = document.getElementById("mJson"); t.focus(); t.select(); toast("Выделено — скопируйте вручную"); }
  };
}
function openImportModal() {
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Импорт данных</h3>
    <p class="hint">Выберите файл резервной копии или вставьте текст. Текущие данные будут заменены.</p>
    <input type="file" id="mFile" accept="application/json,.json" />
    <textarea id="mPaste" class="backup-area" placeholder="…или вставьте JSON сюда"></textarea>
    <button class="btn primary" id="mDoImport">Загрузить</button>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mFile").onchange = (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { document.getElementById("mPaste").value = r.result; };
    r.readAsText(f);
  };
  document.getElementById("mDoImport").onclick = () => {
    const txt = document.getElementById("mPaste").value.trim();
    if (!txt) { toast("Нет данных для импорта"); return; }
    try {
      const parsed = migrate(JSON.parse(txt));
      if (!Array.isArray(parsed.foods)) throw new Error("bad");
      state = parsed; save(); closeModal(); renderAll(); toast("Данные загружены");
    } catch (e) { toast("Не удалось прочитать файл"); }
  };
}

/* ---------- События ---------- */
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const page = btn.dataset.tab;
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.toggle("hidden", p.dataset.page !== page));
    window.scrollTo(0, 0);
  });
});
function switchTab(name) { document.querySelector(`.tab[data-tab="${name}"]`).click(); }

// Навигация по дням
document.getElementById("dayPrev").onclick = () => { viewDate = shiftDay(viewDate, -1); renderAll(); };
document.getElementById("dayNext").onclick = () => { viewDate = shiftDay(viewDate, 1); renderAll(); };
document.getElementById("dayTitle").onclick = () => {
  const val = prompt("Дата (ГГГГ-ММ-ДД):", viewDate);
  if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) { viewDate = val; renderAll(); }
};

// Добавление еды: поиск, выбор, количество
document.getElementById("foodSearch").addEventListener("input", renderResults);
document.getElementById("addGrams").addEventListener("input", updatePickedMacros);
document.getElementById("pickedClear").onclick = clearPicked;
document.getElementById("app").addEventListener("click", (e) => {
  const pk = e.target.closest("[data-pick]");
  if (pk) { pickItem(pk.dataset.pick); return; }
});
document.getElementById("addForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!picked) { toast("Выберите продукт"); return; }
  const s = scaledMacros();
  if (!s || !(s.amt > 0)) { toast("Укажите количество"); return; }
  const meal = document.getElementById("addMeal").value;
  day(viewDate).meals.push({
    id: uid(), meal, name: picked.name, grams: s.amt,
    perUnit: picked.kind === "recipe" ? "serving" : "g",
    kcal: s.kcal, p: s.p, f: s.f, c: s.c,
  });
  pushRecent(picked.id);
  save();
  clearPicked();
  document.getElementById("addGrams").value = "";
  renderAll();
  toast("Добавлено в " + MEALS.find((m) => m.id === meal).name.toLowerCase());
});

// Кнопка "+" в приёме пищи → переход на вкладку добавления
document.getElementById("mealsWrap").addEventListener("click", (e) => {
  const add = e.target.closest("[data-add-meal]");
  if (add) { document.getElementById("addMeal").value = add.dataset.addMeal; switchTab("add"); document.getElementById("foodSearch").focus(); return; }
  const row = e.target.closest("[data-edit]");
  if (row) openEditEntry(row.dataset.edit);
});

// Вода
document.getElementById("waterAdd").onclick = () => { day(viewDate).water += 250; save(); renderDiary(); };
document.getElementById("waterMinus").onclick = () => { const d = day(viewDate); d.water = Math.max(0, d.water - 250); save(); renderDiary(); };

// Активность
document.getElementById("addExercise").onclick = openExerciseModal;
document.getElementById("exerciseList").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-ex]");
  if (del) { const d = day(viewDate); d.exercise = d.exercise.filter((x) => x.id !== del.dataset.delEx); save(); renderAll(); }
});

// Свой продукт
document.getElementById("foodForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("fName").value.trim();
  const kcal = parseFloat(document.getElementById("fKcal").value);
  if (!name || !(kcal >= 0)) return;
  state.foods.push({
    id: uid(), name, kcal,
    p: parseFloat(document.getElementById("fP").value) || 0,
    f: parseFloat(document.getElementById("fF").value) || 0,
    c: parseFloat(document.getElementById("fC").value) || 0,
    barcode: document.getElementById("fBarcode").value.trim(),
    fav: false, custom: true,
  });
  save(); e.target.reset(); renderAll(); toast("Продукт добавлен");
});

// Рецепты
document.getElementById("addRecipe").onclick = () => openRecipeModal(null);
document.getElementById("recipeList").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-recipe]");
  if (del) { e.stopPropagation(); state.recipes = state.recipes.filter((r) => r.id !== del.dataset.delRecipe); save(); renderAll(); toast("Рецепт удалён"); return; }
  const row = e.target.closest("[data-edit-recipe]");
  if (row) openRecipeModal(row.dataset.editRecipe);
});

// База продуктов: поиск, избранное, редактирование, удаление
document.getElementById("foodDbSearch").addEventListener("input", renderFoods);
document.getElementById("foodDbList").addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) { const f = state.foods.find((x) => x.id === fav.dataset.fav); if (f) { f.fav = !f.fav; save(); renderFoods(); renderQuickPicks(); } return; }
  const del = e.target.closest("[data-del-food]");
  if (del) { if (confirm("Удалить продукт из базы?")) { state.foods = state.foods.filter((x) => x.id !== del.dataset.delFood); save(); renderAll(); toast("Удалено"); } return; }
  const ed = e.target.closest("[data-edit-food]");
  if (ed) openFoodEdit(ed.dataset.editFood);
});

// Профиль
document.querySelectorAll("#profileForm .seg").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("#profileForm .seg").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
}));
document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.profile = {
    sex: document.querySelector("#profileForm .seg.active").dataset.sex,
    age: parseFloat(document.getElementById("pAge").value) || 30,
    height: parseFloat(document.getElementById("pHeight").value) || 175,
    weight: parseFloat(document.getElementById("pWeight").value) || 75,
    activity: parseFloat(document.getElementById("pActivity").value) || 1.55,
    goal: document.getElementById("pGoal").value,
  };
  save(); renderAll(); toast("Норма пересчитана");
});

// Настройки цели
document.getElementById("autoNormToggle").onclick = () => {
  state.settings.autoNorm = !state.settings.autoNorm; save(); renderMore(); renderDiary(); renderCharts();
};
document.getElementById("manualCal").addEventListener("change", (e) => { state.settings.manualCal = parseFloat(e.target.value) || 0; save(); renderDiary(); renderCharts(); updatePctHint(); });
["mPctP", "mPctF", "mPctC"].forEach((id) => document.getElementById(id).addEventListener("input", () => {
  state.settings.macroPct = {
    p: parseFloat(document.getElementById("mPctP").value) || 0,
    f: parseFloat(document.getElementById("mPctF").value) || 0,
    c: parseFloat(document.getElementById("mPctC").value) || 0,
  };
  save(); updatePctHint(); renderDiary();
}));
document.getElementById("waterGoal").addEventListener("change", (e) => { state.settings.waterGoal = parseFloat(e.target.value) || 0; save(); renderDiary(); });

// Вес и замеры
document.getElementById("weightForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const weight = parseFloat(document.getElementById("wWeight").value);
  if (!(weight > 0)) return;
  const date = todayKey();
  const entry = { date, weight, waist: parseFloat(document.getElementById("wWaist").value) || 0, fat: parseFloat(document.getElementById("wFat").value) || 0 };
  state.weightLog = state.weightLog.filter((x) => x.date !== date); // одна запись в день
  state.weightLog.push(entry);
  // синхронизируем текущий вес профиля
  state.profile.weight = weight;
  save(); e.target.reset(); renderAll(); toast("Замер записан");
});
document.getElementById("weightLog").addEventListener("click", (e) => {
  const del = e.target.closest("[data-del-weight]");
  if (del) { state.weightLog = state.weightLog.filter((x) => x.date !== del.dataset.delWeight); save(); renderAll(); toast("Удалено"); }
});

// Экспорт / импорт / сброс
document.getElementById("exportBtn").onclick = openExportModal;
document.getElementById("importBtn").onclick = openImportModal;
document.getElementById("resetBtn").onclick = () => {
  if (confirm("Удалить ВСЕ данные и вернуть настройки по умолчанию?")) {
    localStorage.removeItem(STORE_KEY); state = load(); viewDate = todayKey(); renderAll(); toast("Данные сброшены");
  }
};

/* ---------- Service Worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

renderAll();
