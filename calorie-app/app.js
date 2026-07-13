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
function defaultMealPrefs() { return { diet: "any", exclude: "", cuisine: "any", time: "any", meals: 4 }; }
function defaultState() {
  return {
    settings: { autoNorm: true, manualCal: 2000, macroPct: { p: 30, f: 30, c: 40 }, waterGoal: 2000, aiProxyUrl: "", onboarded: false, mealPrefs: defaultMealPrefs() },
    profile: { sex: "m", age: 30, height: 175, weight: 75, activity: 1.55, goal: "maintain", targetWeight: 0 },
    foods: seedFoods(),
    recipes: [],
    templates: [],    // [{ id, name, meals:[{meal,name,grams,perUnit,kcal,p,f,c}] }]
    diary: {},        // { 'YYYY-MM-DD': { meals:[...], water:0, exercise:[...] } }
    weightLog: [],    // [{ date, weight, waist, fat }]
    recent: [],       // id последних использованных продуктов/рецептов
  };
}

let state = load();
let viewDate = todayKey();
let picked = null; // выбранный продукт/рецепт в форме добавления
let searchToken = 0; // защита от гонки при онлайн-поиске
let extCounter = 0;
const extCache = new Map(); // онлайн-продукты до сохранения в базу

function uid() { return Math.random().toString(36).slice(2, 10); }

function migrate(s) {
  const rawSettings = s.settings || {};
  const d = defaultState().settings;
  s.settings = Object.assign({}, d, rawSettings);
  if (!s.settings.macroPct) s.settings.macroPct = { p: 30, f: 30, c: 40 };
  if (!s.settings.mealPrefs) s.settings.mealPrefs = defaultMealPrefs();
  if (typeof rawSettings.onboarded !== "boolean") s.settings.onboarded = true; // существующие данные — не онбордить заново
  if (!s.profile) s.profile = defaultState().profile;
  if (typeof s.profile.targetWeight !== "number") s.profile.targetWeight = 0;
  if (!Array.isArray(s.foods)) s.foods = seedFoods();
  if (!Array.isArray(s.recipes)) s.recipes = [];
  if (!Array.isArray(s.templates)) s.templates = [];
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
function frItemHtml(it) {
  const tag = it.tag === "recipe" ? `<span class="fr-tag recipe">рецепт</span>`
    : it.tag === "custom" ? `<span class="fr-tag custom">своё</span>`
    : it.tag === "online" ? `<span class="fr-tag online">онлайн</span>` : "";
  const unit = it.kind === "recipe" ? "порция" : "100 г";
  return `<div class="fr-item" data-pick="${it.id}">
      <div class="fr-name">${escapeHtml(it.name)}${tag}</div>
      <div class="fr-sub">${Math.round(it.kcal)} ккал / ${unit} · Б ${r1(it.p)} Ж ${r1(it.f)} У ${r1(it.c)}</div></div>`;
}
function renderResults() {
  const q = document.getElementById("foodSearch").value;
  const box = document.getElementById("foodResults");
  const tq = q.trim();
  const token = ++searchToken;
  if (!tq) { box.classList.remove("show"); box.innerHTML = ""; return; }
  const res = searchFoods(q);
  box.classList.add("show");
  box.innerHTML = res.map(frItemHtml).join("");
  if (tq.length >= 3 && navigator.onLine !== false) {
    const loading = document.createElement("div");
    loading.className = "fr-item"; loading.id = "frLoading";
    loading.innerHTML = `<div class="fr-sub">Поиск в онлайн-базе…</div>`;
    box.appendChild(loading);
    searchOnline(tq, token);
  } else if (!res.length) {
    box.innerHTML = `<div class="fr-item"><div class="fr-sub">Ничего не найдено. Добавьте продукт на вкладке «Продукты».</div></div>`;
  }
}

/* ---------- Онлайн-база (Open Food Facts) ---------- */
function offToProduct(p) {
  const n = p.nutriments || {};
  const kcal = n["energy-kcal_100g"];
  if (kcal == null) return null;
  let name = (p.product_name_ru || p.product_name || "").trim();
  if (!name) return null;
  const brand = (p.brands || "").split(",")[0].trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name += " (" + brand + ")";
  return { name: name.slice(0, 60), kcal: Math.round(kcal), p: +(n.proteins_100g || 0), f: +(n.fat_100g || 0), c: +(n.carbohydrates_100g || 0), barcode: p.code || "" };
}
function addExternalFood(prod) {
  let food = null;
  if (prod.barcode) food = state.foods.find((x) => x.barcode && x.barcode === prod.barcode);
  if (!food) food = state.foods.find((x) => x.name === prod.name && Math.round(x.kcal) === Math.round(prod.kcal));
  if (food) return food;
  food = { id: uid(), name: prod.name, kcal: prod.kcal, p: prod.p, f: prod.f, c: prod.c, barcode: prod.barcode || "", fav: false, custom: true };
  state.foods.push(food); save();
  return food;
}
async function searchOnline(q, token) {
  try {
    const url = "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(q) +
      "&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,product_name_ru,brands,nutriments";
    const r = await fetch(url);
    const data = await r.json();
    if (token !== searchToken) return; // запрос устарел
    const items = (data.products || []).map(offToProduct).filter(Boolean).slice(0, 15);
    const box = document.getElementById("foodResults");
    const loading = document.getElementById("frLoading");
    if (loading) loading.remove();
    for (const it of items) {
      const key = "ext_" + (extCounter++);
      extCache.set(key, it);
      box.insertAdjacentHTML("beforeend", frItemHtml({ ...it, id: key, tag: "online" }));
    }
    if (!box.children.length) box.innerHTML = `<div class="fr-item"><div class="fr-sub">Ничего не найдено.</div></div>`;
  } catch (e) {
    const loading = document.getElementById("frLoading");
    if (loading) loading.remove();
  }
}

function pickItem(id) {
  if (extCache.has(id)) { const food = addExternalFood(extCache.get(id)); return pickItem(food.id); }
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
  renderWeekSummary();
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
  document.getElementById("pTarget").value = pr.targetWeight ? pr.targetWeight : "";

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
  document.getElementById("aiProxyUrl").value = st.aiProxyUrl || "";
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
let modalCleanup = null;
function openModal(html) { document.getElementById("modalBody").innerHTML = html; document.getElementById("modal").classList.remove("hidden"); }
function closeModal() {
  if (modalCleanup) { try { modalCleanup(); } catch (e) {} modalCleanup = null; }
  document.getElementById("modal").classList.add("hidden");
}
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

/* ---------- Штрих-код ---------- */
async function lookupBarcode(code) {
  toast("Ищу " + code + "…");
  try {
    const r = await fetch("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) +
      ".json?fields=code,product_name,product_name_ru,brands,nutriments");
    const data = await r.json();
    if (data.status === 1 && data.product) {
      const prod = offToProduct(data.product);
      if (prod) { const food = addExternalFood(prod); switchTab("add"); pickItem(food.id); toast("Найдено: " + prod.name); return; }
    }
    toast("Продукт не найден в базе");
  } catch (e) { toast("Нет соединения"); }
}
function manualBarcode() {
  const code = prompt("Введите штрих-код (только цифры):");
  if (code && /^\d{6,}$/.test(code.trim())) lookupBarcode(code.trim());
  else if (code) toast("Некорректный код");
}
async function openScanner() {
  if (!("BarcodeDetector" in window) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { manualBarcode(); return; }
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Сканирование</h3>
    <video id="scanVideo" class="scan-video" playsinline muted></video>
    <div class="scan-status" id="scanStatus">Наведите камеру на штрих-код…</div>
    <button class="btn ghost" id="scanManual">Ввести код вручную</button>`);
  const video = document.getElementById("scanVideo");
  let stream = null, raf = 0, stopped = false;
  const stop = () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  modalCleanup = stop;
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("scanManual").onclick = () => { closeModal(); manualBarcode(); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream; await video.play();
  } catch (e) { closeModal(); toast("Нет доступа к камере"); manualBarcode(); return; }
  const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
  const tick = async () => {
    if (stopped) return;
    try {
      const codes = await detector.detect(video);
      if (codes.length && codes[0].rawValue) { const code = codes[0].rawValue; closeModal(); lookupBarcode(code); return; }
    } catch (e) {}
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/* ---------- Распознавание по фото ---------- */
function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
      else if (h >= w && h > max) { w = Math.round(w * max / h); h = max; }
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
function startPhoto() {
  if (!(state.settings.aiProxyUrl || "").trim()) { toast("Укажите URL прокси в разделе «Ещё»"); switchTab("more"); return; }
  document.getElementById("photoInput").click();
}
async function handlePhoto(file) {
  let dataUrl;
  try { dataUrl = await resizeImage(file, 1024); } catch (e) { toast("Не удалось прочитать фото"); return; }
  const base64 = dataUrl.split(",")[1];
  openModal(`<h3>Распознаю блюдо…</h3>
    <div class="ai-loading"><img class="photo-preview" src="${dataUrl}" alt="" /><div class="spinner"></div>
    <div class="scan-status">Оцениваю КБЖУ по фото…</div></div>`);
  try {
    const r = await fetch(state.settings.aiProxyUrl.trim(), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mediaType: "image/jpeg" }),
    });
    if (!r.ok) throw new Error("http " + r.status);
    const d = await r.json();
    closeModal();
    if (!d || d.kcal == null) { toast("Не удалось распознать"); return; }
    const grams = Number(d.grams) > 0 ? Number(d.grams) : 100;
    const per = 100 / grams; // приводим к значениям на 100 г
    const food = addExternalFood({
      name: (d.name || "Блюдо (фото)").slice(0, 60),
      kcal: (Number(d.kcal) || 0) * per, p: (Number(d.p) || 0) * per,
      f: (Number(d.f) || 0) * per, c: (Number(d.c) || 0) * per, barcode: "",
    });
    switchTab("add");
    pickItem(food.id);
    document.getElementById("addGrams").value = Math.round(grams);
    updatePickedMacros();
    toast("Распознано: " + food.name);
  } catch (e) { closeModal(); toast("Ошибка распознавания. Проверьте прокси."); }
}

/* ---------- Итоги недели + прогноз ---------- */
function renderWeekSummary() {
  const box = document.getElementById("weekSummary");
  if (!box) return;
  const goal = goalCalories();
  let sumK = 0, sumP = 0, sumF = 0, sumC = 0, logged = 0, inGoal = 0, sumWater = 0, waterDays = 0;
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(viewDate, -i);
    const t = dayTotals(key);
    if (t.kcal > 0) {
      logged++; sumK += t.kcal; sumP += t.p; sumF += t.f; sumC += t.c;
      if (goal > 0 && Math.abs(t.kcal - goal) <= goal * 0.1) inGoal++;
    }
    if (t.water > 0) { sumWater += t.water; waterDays++; }
  }
  if (!logged) { box.innerHTML = `<div class="empty">Записей за неделю пока нет</div>`; return; }
  const avgK = Math.round(sumK / logged), avgP = Math.round(sumP / logged), avgF = Math.round(sumF / logged), avgC = Math.round(sumC / logged);
  const maintenance = calcNorm().tdee;
  const weeklyKg = maintenance > 0 ? ((avgK - maintenance) * 7 / 7700) : 0; // <0 — снижение
  const dir = weeklyKg < -0.005 ? "снижение" : weeklyKg > 0.005 ? "набор" : "без изменений";
  const dirCls = weeklyKg < -0.005 ? "ws-pos" : weeklyKg > 0.005 ? "ws-neg" : "";
  let eta = "";
  const tw = Number(state.profile.targetWeight) || 0;
  const sorted = [...state.weightLog].sort((a, b) => b.date.localeCompare(a.date));
  const curW = sorted.length ? Number(sorted[0].weight) : Number(state.profile.weight) || 0;
  if (tw > 0 && curW > 0 && Math.abs(weeklyKg) > 0.02) {
    const remaining = curW - tw; // >0 — нужно снижать
    if ((remaining > 0 && weeklyKg < 0) || (remaining < 0 && weeklyKg > 0)) {
      const weeks = Math.abs(remaining / weeklyKg);
      const etaDate = new Date(); etaDate.setDate(etaDate.getDate() + Math.round(weeks * 7));
      eta = "≈ " + weeks.toFixed(1) + " нед · к " + etaDate.getDate() + " " + MONTHS_SHORT[etaDate.getMonth()];
    } else { eta = "текущий баланс не ведёт к цели"; }
  }
  box.innerHTML = `
    <div class="ws-grid">
      <div class="ws-cell"><div class="ws-num">${avgK}</div><div class="ws-lbl">ккал/день</div></div>
      <div class="ws-cell"><div class="ws-num">${avgP}</div><div class="ws-lbl">белки, г</div></div>
      <div class="ws-cell"><div class="ws-num">${avgF}</div><div class="ws-lbl">жиры, г</div></div>
      <div class="ws-cell"><div class="ws-num">${avgC}</div><div class="ws-lbl">углеводы, г</div></div>
    </div>
    <div class="ws-rows">
      <div class="ws-row"><span>Дней с записями</span><span>${logged} из 7</span></div>
      ${goal > 0 ? `<div class="ws-row"><span>В пределах нормы (±10%)</span><span>${inGoal} дн.</span></div>` : ""}
      ${waterDays ? `<div class="ws-row"><span>Вода в среднем</span><span>${Math.round(sumWater / waterDays)} мл</span></div>` : ""}
      <div class="ws-row"><span>Прогноз веса</span><span class="${dirCls}">${dir} ${Math.abs(weeklyKg).toFixed(2)} кг/нед</span></div>
      ${eta ? `<div class="ws-row"><span>До цели ${tw} кг</span><span>${eta}</span></div>` : ""}
    </div>`;
}

/* ---------- Онбординг ---------- */
function openOnboarding() {
  const pr = state.profile;
  openModal(`
    <h3>Добро пожаловать 👋</h3>
    <p class="hint">Заполните профиль — посчитаем дневную норму калорий и БЖУ.</p>
    <div class="segmented" id="obSex">
      <button type="button" class="seg ${pr.sex === "m" ? "active" : ""}" data-sex="m">Мужчина</button>
      <button type="button" class="seg ${pr.sex === "f" ? "active" : ""}" data-sex="f">Женщина</button>
    </div>
    <div class="field-row">
      <div class="field"><label>Возраст</label><input type="number" id="obAge" inputmode="numeric" value="${pr.age}" /></div>
      <div class="field"><label>Рост, см</label><input type="number" id="obHeight" inputmode="decimal" value="${pr.height}" /></div>
      <div class="field"><label>Вес, кг</label><input type="number" id="obWeight" inputmode="decimal" value="${pr.weight}" /></div>
    </div>
    <div class="field"><label>Активность</label><select id="obActivity">
      <option value="1.2">Минимальная (сидячий образ)</option>
      <option value="1.375">Лёгкая (1–3 трен./нед)</option>
      <option value="1.55" selected>Средняя (3–5 трен./нед)</option>
      <option value="1.725">Высокая (6–7 трен./нед)</option>
      <option value="1.9">Очень высокая</option>
    </select></div>
    <div class="field"><label>Цель</label><select id="obGoal">
      <option value="lose">Похудение</option>
      <option value="maintain" selected>Поддержание веса</option>
      <option value="gain">Набор массы</option>
    </select></div>
    <div class="modal-actions">
      <button class="btn ghost" id="obSkip">Пропустить</button>
      <button class="btn primary" id="obSave">Готово</button>
    </div>`);
  document.querySelectorAll("#obSex .seg").forEach((b) => b.onclick = () => {
    document.querySelectorAll("#obSex .seg").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  });
  const finish = () => { state.settings.onboarded = true; save(); closeModal(); renderAll(); };
  document.getElementById("obSkip").onclick = finish;
  document.getElementById("obSave").onclick = () => {
    state.profile.sex = document.querySelector("#obSex .seg.active").dataset.sex;
    state.profile.age = parseFloat(document.getElementById("obAge").value) || 30;
    state.profile.height = parseFloat(document.getElementById("obHeight").value) || 175;
    state.profile.weight = parseFloat(document.getElementById("obWeight").value) || 75;
    state.profile.activity = parseFloat(document.getElementById("obActivity").value) || 1.55;
    state.profile.goal = document.getElementById("obGoal").value;
    const n = calcNorm();
    finish();
    toast("Ваша норма: " + n.goal + " ккал/день");
  };
}

/* ---------- Повтор дня и шаблоны ---------- */
function copyYesterday() {
  const prev = day(shiftDay(viewDate, -1));
  if (!prev.meals.length) { toast("Вчера нет записей"); return; }
  const d = day(viewDate);
  for (const m of prev.meals) d.meals.push({ ...m, id: uid() });
  save(); renderAll(); toast("Скопировано из вчера: " + prev.meals.length);
}
function openTemplatesModal() {
  const list = state.templates.map((t) => `
    <div class="row">
      <div class="row-main clickable" data-apply-tpl="${t.id}" style="cursor:pointer">
        <div class="row-title">${escapeHtml(t.name)}</div>
        <div class="row-sub">${t.meals.length} блюд · ${Math.round(t.meals.reduce((a, m) => a + m.kcal, 0))} ккал</div>
      </div>
      <button class="icon-btn" data-del-tpl="${t.id}" title="Удалить">✕</button>
    </div>`).join("") || `<div class="empty">Шаблонов пока нет</div>`;
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>Шаблоны дня</h3>
    <p class="hint">Сохраните типичный день и применяйте одним тапом.</p>
    <button class="btn primary" id="tplSave">💾 Сохранить текущий день как шаблон</button>
    <div class="list" style="margin-top:12px">${list}</div>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("tplSave").onclick = () => {
    const d = day(viewDate);
    if (!d.meals.length) { toast("В этом дне нет блюд"); return; }
    const name = prompt("Название шаблона:", dayLabel(viewDate));
    if (!name || !name.trim()) return;
    state.templates.push({ id: uid(), name: name.trim(), meals: d.meals.map((m) => ({ meal: m.meal, name: m.name, grams: m.grams, perUnit: m.perUnit, kcal: m.kcal, p: m.p, f: m.f, c: m.c })) });
    save(); openTemplatesModal(); toast("Шаблон сохранён");
  };
  document.querySelectorAll("[data-apply-tpl]").forEach((el) => el.onclick = () => applyTemplate(el.dataset.applyTpl));
  document.querySelectorAll("[data-del-tpl]").forEach((el) => el.onclick = () => { state.templates = state.templates.filter((t) => t.id !== el.dataset.delTpl); save(); openTemplatesModal(); });
}
function applyTemplate(id) {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return;
  const d = day(viewDate);
  for (const m of t.meals) d.meals.push({ ...m, id: uid() });
  save(); closeModal(); renderAll(); toast("Добавлено из шаблона: " + t.meals.length);
}

/* ---------- План питания на день (ИИ через прокси) ---------- */
const DIETS = [["any", "Обычное"], ["veg", "Вегетарианское"], ["vegan", "Веганское"], ["keto", "Кето"], ["lowcarb", "Низкоуглеводное"], ["highprot", "Высокобелковое"]];
const CUISINES = [["any", "Любая"], ["ru", "Русская"], ["it", "Итальянская"], ["asia", "Азиатская"], ["med", "Средиземноморская"]];
const TIMES = [["any", "Не важно"], ["fast", "Быстро (до 15 мин)"], ["mid", "Среднее"]];
let lastPlan = null;

function openMealPlanModal() {
  const p = state.settings.mealPrefs || defaultMealPrefs();
  const g = goalMacros();
  const sel = (arr, cur, id) => `<select id="${id}">${arr.map((o) => `<option value="${o[0]}" ${o[0] === cur ? "selected" : ""}>${o[1]}</option>`).join("")}</select>`;
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>План питания на день</h3>
    <p class="hint">Цель: ${g.kcal} ккал · Б ${g.p} · Ж ${g.f} · У ${g.c} г</p>
    <div class="field"><label>Тип питания</label>${sel(DIETS, p.diet, "mpDiet")}</div>
    <div class="field"><label>Кухня</label>${sel(CUISINES, p.cuisine, "mpCuisine")}</div>
    <div class="field"><label>Время на готовку</label>${sel(TIMES, p.time, "mpTime")}</div>
    <div class="field"><label>Приёмов пищи</label><select id="mpMeals"><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>
    <div class="field"><label>Исключить продукты / аллергии</label><input type="text" id="mpExclude" value="${escapeHtml(p.exclude || "")}" placeholder="напр. грибы, орехи" maxlength="100" /></div>
    <button class="btn primary" id="mpGen">✨ Составить</button>`);
  document.getElementById("mpMeals").value = String(p.meals || 4);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mpGen").onclick = () => {
    state.settings.mealPrefs = {
      diet: document.getElementById("mpDiet").value,
      cuisine: document.getElementById("mpCuisine").value,
      time: document.getElementById("mpTime").value,
      meals: parseInt(document.getElementById("mpMeals").value) || 4,
      exclude: document.getElementById("mpExclude").value.trim(),
    };
    save();
    generatePlan();
  };
}
async function generatePlan() {
  const url = (state.settings.aiProxyUrl || "").trim();
  if (!url) { closeModal(); toast("Укажите URL прокси в разделе «Ещё»"); switchTab("more"); return; }
  const prefs = state.settings.mealPrefs || defaultMealPrefs();
  const targets = goalMacros();
  openModal(`<h3>Составляю план…</h3><div class="ai-loading"><div class="spinner"></div><div class="scan-status">Подбираю рецепты под ваши КБЖУ…</div></div>`);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "mealplan", targets, prefs }) });
    if (!r.ok) throw new Error("http " + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.meals) || !d.meals.length) throw new Error("empty");
    renderMealPlanResult(d.meals);
  } catch (e) { closeModal(); toast("Не удалось составить план. Проверьте прокси."); }
}
function renderMealPlanResult(meals) {
  lastPlan = meals;
  const tot = meals.reduce((a, m) => ({ k: a.k + (+m.kcal || 0), p: a.p + (+m.p || 0), f: a.f + (+m.f || 0), c: a.c + (+m.c || 0) }), { k: 0, p: 0, f: 0, c: 0 });
  const mealName = (id) => { const m = MEALS.find((x) => x.id === id); return m ? m.icon + " " + m.name : "🍽️ Приём"; };
  const cards = meals.map((m) => `
    <div class="plan-card">
      <div class="plan-head"><span class="plan-meal">${mealName(m.meal)}</span><span class="plan-kcal">${Math.round(+m.kcal || 0)} ккал</span></div>
      <div class="plan-title">${escapeHtml(m.title || "Блюдо")}</div>
      <div class="mi-sub">Б ${r1(+m.p || 0)} · Ж ${r1(+m.f || 0)} · У ${r1(+m.c || 0)}</div>
      ${Array.isArray(m.ingredients) && m.ingredients.length ? `<div class="plan-ing">${m.ingredients.map((i) => escapeHtml((i.name || "") + " — " + Math.round(+i.grams || 0) + " г")).join("<br>")}</div>` : ""}
      ${m.recipe ? `<div class="plan-recipe">${escapeHtml(m.recipe)}</div>` : ""}
    </div>`).join("");
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>План на день</h3>
    <div class="picked-macros"><span class="pm-pill kcal">${Math.round(tot.k)} ккал</span><span class="pm-pill">Б ${r1(tot.p)}</span><span class="pm-pill">Ж ${r1(tot.f)}</span><span class="pm-pill">У ${r1(tot.c)}</span></div>
    <div class="plan-list">${cards}</div>
    <div class="modal-actions">
      <button class="btn ghost" id="mpShop">🛒 Покупки</button>
      <button class="btn primary" id="mpAdd">Добавить в дневник</button>
    </div>
    <button class="btn ghost" id="mpAgain">↻ Другой вариант</button>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mpAdd").onclick = () => addPlanToDiary(meals);
  document.getElementById("mpAgain").onclick = generatePlan;
  document.getElementById("mpShop").onclick = () => showShopping(meals);
}
function addPlanToDiary(meals) {
  const d = day(viewDate);
  let n = 0;
  for (const m of meals) {
    const meal = MEALS.some((x) => x.id === m.meal) ? m.meal : "snack";
    const grams = Array.isArray(m.ingredients) ? m.ingredients.reduce((a, i) => a + (+i.grams || 0), 0) : 0;
    d.meals.push({ id: uid(), meal, name: (m.title || "Блюдо из плана"), grams: grams > 0 ? grams : 100, perUnit: "g", kcal: +m.kcal || 0, p: +m.p || 0, f: +m.f || 0, c: +m.c || 0 });
    n++;
  }
  save(); closeModal(); switchTab("diary"); renderAll(); toast("Добавлено блюд: " + n);
}
function showShopping(meals) {
  const map = {};
  for (const m of meals) if (Array.isArray(m.ingredients)) for (const i of m.ingredients) {
    const name = (i.name || "").trim(); if (!name) continue;
    map[name] = (map[name] || 0) + (+i.grams || 0);
  }
  const items = Object.keys(map).sort((a, b) => a.localeCompare(b, "ru"));
  const txt = items.map((n) => n + " — " + Math.round(map[n]) + " г").join("\n");
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>🛒 Список покупок</h3>
    <textarea class="backup-area" id="shopTxt" readonly>${escapeHtml(txt || "—")}</textarea>
    <div class="modal-actions"><button class="btn ghost" id="shopBack">← К плану</button><button class="btn primary" id="shopCopy">Скопировать</button></div>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("shopBack").onclick = () => renderMealPlanResult(meals);
  document.getElementById("shopCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(txt); toast("Скопировано"); }
    catch (e) { const t = document.getElementById("shopTxt"); t.focus(); t.select(); toast("Выделено — скопируйте вручную"); }
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
document.getElementById("scanBtn").onclick = openScanner;
document.getElementById("photoBtn").onclick = startPhoto;
document.getElementById("photoInput").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) handlePhoto(f); e.target.value = ""; });
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

// Действия дня: план, повтор вчера, шаблоны
document.getElementById("planBtn").onclick = openMealPlanModal;
document.getElementById("copyYesterday").onclick = copyYesterday;
document.getElementById("templatesBtn").onclick = openTemplatesModal;

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
    targetWeight: parseFloat(document.getElementById("pTarget").value) || 0,
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
document.getElementById("aiProxyUrl").addEventListener("change", (e) => { state.settings.aiProxyUrl = e.target.value.trim(); save(); });

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
if (!state.settings.onboarded) openOnboarding();
