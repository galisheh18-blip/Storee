/* Мои траты — оффлайн PWA для учёта расходов.
   Данные хранятся локально в браузере (localStorage). */

const STORE_KEY = "expense-app-v1";
const CURRENCY = "₽";

/* ---------- Состояние ---------- */
function defaultState() {
  const c = (name, limit, icon) => ({ id: uid(), name, limit, icon });
  return {
    categories: [
      c("Продукты", 20000, "🛒"),
      c("Транспорт", 5000, "🚌"),
      c("Кафе и рестораны", 8000, "🍽️"),
      c("Развлечения", 5000, "🎬"),
      c("Здоровье", 4000, "💊"),
      c("Прочее", 5000, "📦"),
    ],
    expenses: [],
    planned: [
      { id: uid(), title: "ЖКХ", amount: 6000, paidMonths: [] },
      { id: uid(), title: "Интернет", amount: 700, paidMonths: [] },
      { id: uid(), title: "Подписки", amount: 900, paidMonths: [] },
    ],
  };
}

let state = load();
let viewMonth = monthKey(new Date());

function uid() { return Math.random().toString(36).slice(2, 10); }
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const s = defaultState();
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  return s;
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

/* ---------- Утилиты ---------- */
function monthKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function fmt(n) {
  const v = Math.round(n);
  return v.toLocaleString("ru-RU") + " " + CURRENCY;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  const names = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  return names[m - 1] + " " + y;
}
function expensesForMonth(key) {
  return state.expenses.filter((e) => e.date.slice(0, 7) === key);
}
function spentByCategory(key) {
  const map = {};
  for (const e of expensesForMonth(key)) map[e.catId] = (map[e.catId] || 0) + e.amount;
  return map;
}

/* ---------- Рендер: Обзор ---------- */
function renderOverview() {
  const spent = spentByCategory(viewMonth);
  const expensesTotal = Object.values(spent).reduce((a, b) => a + b, 0);
  const limitsTotal = state.categories.reduce((a, c) => a + (Number(c.limit) || 0), 0);
  // Плановые платежи тоже входят в бюджет; оплаченные считаются потраченными.
  const plannedTotal = state.planned.reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const plannedPaid = state.planned.reduce(
    (a, p) => a + (p.paidMonths.includes(viewMonth) ? (Number(p.amount) || 0) : 0), 0);
  const totalSpent = expensesTotal + plannedPaid;
  const totalBudget = limitsTotal + plannedTotal;
  const left = totalBudget - totalSpent;

  document.getElementById("sumSpent").textContent = fmt(totalSpent);
  document.getElementById("sumBudget").textContent = fmt(totalBudget);
  document.getElementById("sumLeft").textContent = fmt(left);

  const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const bar = document.getElementById("totalBar");
  bar.style.width = pct + "%";
  bar.className = "progress-fill" + (totalSpent > totalBudget ? " over" : pct > 80 ? " warn" : "");
  document.getElementById("totalPct").textContent = Math.round(pct) + "% бюджета";
  document.getElementById("totalHint").textContent =
    left >= 0 ? "осталось " + fmt(left) : "перерасход " + fmt(-left);

  // Таблица по категориям
  const body = document.getElementById("catTableBody");
  body.innerHTML = "";
  for (const cat of state.categories) {
    const s = spent[cat.id] || 0;
    const lim = Number(cat.limit) || 0;
    const rest = lim - s;
    const p = lim > 0 ? Math.min(100, (s / lim) * 100) : (s > 0 ? 100 : 0);
    const cls = s > lim && lim > 0 ? "over" : p > 80 ? "warn" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cat-cell">
          <span class="cat-name">${cat.icon || "•"} ${escapeHtml(cat.name)}</span>
          <div class="mini-bar"><div class="mini-fill ${cls}" style="width:${p}%"></div></div>
        </div>
      </td>
      <td class="num">${fmt(s)}</td>
      <td class="num">${lim > 0 ? fmt(lim) : "—"}</td>
      <td class="num ${lim > 0 ? (rest < 0 ? "left-neg" : "left-pos") : ""}">${lim > 0 ? fmt(rest) : "—"}</td>`;
    body.appendChild(tr);
  }
  // Строка плановых платежей — оплаченная часть считается потраченной.
  if (plannedTotal > 0) {
    const rest = plannedTotal - plannedPaid;
    const p = Math.min(100, (plannedPaid / plannedTotal) * 100);
    const tr = document.createElement("tr");
    tr.className = "planned-row";
    tr.innerHTML = `
      <td>
        <div class="cat-cell">
          <span class="cat-name">📆 Плановые платежи</span>
          <div class="mini-bar"><div class="mini-fill" style="width:${p}%"></div></div>
        </div>
      </td>
      <td class="num">${fmt(plannedPaid)}</td>
      <td class="num">${fmt(plannedTotal)}</td>
      <td class="num ${rest < 0 ? "left-neg" : "left-pos"}">${fmt(rest)}</td>`;
    body.appendChild(tr);
  }
  document.getElementById("tfSpent").textContent = fmt(totalSpent);
  document.getElementById("tfLimit").textContent = fmt(totalBudget);
  document.getElementById("tfLeft").textContent = fmt(left);

  // Мини-список плановых
  const mini = document.getElementById("plannedMini");
  mini.innerHTML = "";
  if (!state.planned.length) {
    mini.innerHTML = `<div class="empty">Плановых платежей нет</div>`;
  }
  for (const p of state.planned) {
    const paid = p.paidMonths.includes(viewMonth);
    const row = document.createElement("div");
    row.className = "pm-row";
    row.innerHTML = `
      <span class="dot ${paid ? "paid" : "unpaid"}"></span>
      <span class="pm-title">${escapeHtml(p.title)}</span>
      <span class="pm-amount">${fmt(p.amount)}</span>
      <span class="badge ${paid ? "paid" : "unpaid"}">${paid ? "Оплачено" : "Не оплачено"}</span>`;
    mini.appendChild(row);
  }
}

/* ---------- Рендер: Траты ---------- */
function renderExpenses() {
  const sel = document.getElementById("expCategory");
  sel.innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${c.icon || ""} ${escapeHtml(c.name)}</option>`)
    .join("");

  const list = document.getElementById("expenseList");
  const items = expensesForMonth(viewMonth).slice().sort((a, b) => b.date.localeCompare(a.date));
  list.innerHTML = "";
  if (!items.length) { list.innerHTML = `<div class="empty">Пока нет трат за ${monthLabel(viewMonth)}</div>`; return; }
  for (const e of items) {
    const cat = state.categories.find((c) => c.id === e.catId);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${cat ? (cat.icon || "") + " " + escapeHtml(cat.name) : "Без категории"}</div>
        <div class="row-sub">${formatDate(e.date)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
      </div>
      <div class="row-amount">${fmt(e.amount)}</div>
      <button class="icon-btn" data-del-exp="${e.id}" title="Удалить">✕</button>`;
    list.appendChild(row);
  }
}

/* ---------- Рендер: Планы ---------- */
function renderPlanned() {
  const list = document.getElementById("plannedList");
  list.innerHTML = "";
  if (!state.planned.length) list.innerHTML = `<div class="empty">Добавьте первый платёж</div>`;
  for (const p of state.planned) {
    const paid = p.paidMonths.includes(viewMonth);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${escapeHtml(p.title)}</div>
        <div class="row-sub">${fmt(p.amount)} / мес · ${paid ? "оплачено" : "не оплачено"}</div>
      </div>
      <button class="toggle ${paid ? "on" : ""}" data-toggle-plan="${p.id}" title="Отметить оплату"></button>
      <button class="icon-btn" data-del-plan="${p.id}" title="Удалить">✕</button>`;
    list.appendChild(row);
  }
}

/* ---------- Рендер: Категории ---------- */
function renderCategories() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";
  for (const c of state.categories) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${c.icon || "•"} ${escapeHtml(c.name)}</div>
        <div class="row-sub">Лимит на месяц</div>
      </div>
      <input type="number" inputmode="decimal" class="cat-limit-input" data-cat-limit="${c.id}"
             value="${Number(c.limit) || 0}" style="width:110px" />
      <button class="icon-btn" data-del-cat="${c.id}" title="Удалить">✕</button>`;
    list.appendChild(row);
  }
}

function renderAll() {
  document.getElementById("monthTitle").textContent = monthLabel(viewMonth);
  renderOverview();
  renderExpenses();
  renderPlanned();
  renderCategories();
}

/* ---------- Хелперы ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 1800);
}

/* ---------- События ---------- */
// Вкладки
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const page = btn.dataset.tab;
    document.querySelectorAll(".tab-page").forEach((p) => p.classList.toggle("hidden", p.dataset.page !== page));
    window.scrollTo(0, 0);
  });
});

// Выбор месяца
document.getElementById("monthPicker").addEventListener("click", () => {
  const val = prompt("Месяц в формате ГГГГ-ММ (например 2026-07):", viewMonth);
  if (val && /^\d{4}-\d{2}$/.test(val)) { viewMonth = val; renderAll(); }
});

// Добавить трату
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("expAmount").value);
  const catId = document.getElementById("expCategory").value;
  const note = document.getElementById("expNote").value.trim();
  if (!(amount > 0) || !catId) return;
  const now = new Date();
  // Дата привязывается к просматриваемому месяцу, но с текущим днём если возможно.
  const day = viewMonth === monthKey(now) ? now.getDate() : 15;
  const [y, m] = viewMonth.split("-").map(Number);
  const date = new Date(y, m - 1, day, now.getHours(), now.getMinutes()).toISOString();
  state.expenses.push({ id: uid(), catId, amount, note, date });
  save();
  e.target.reset();
  renderAll();
  toast("Трата добавлена");
});

// Добавить плановый платёж
document.getElementById("plannedForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("plTitle").value.trim();
  const amount = parseFloat(document.getElementById("plAmount").value);
  if (!title || !(amount >= 0)) return;
  state.planned.push({ id: uid(), title, amount, paidMonths: [] });
  save();
  e.target.reset();
  renderAll();
  toast("Платёж добавлен");
});

// Добавить категорию
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("catName").value.trim();
  const limit = parseFloat(document.getElementById("catLimit").value) || 0;
  if (!name) return;
  state.categories.push({ id: uid(), name, limit, icon: "•" });
  save();
  e.target.reset();
  renderAll();
  toast("Категория добавлена");
});

// Делегирование кликов
document.getElementById("app").addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.delExp) {
    state.expenses = state.expenses.filter((x) => x.id !== t.dataset.delExp);
    save(); renderAll(); toast("Удалено");
  } else if (t.dataset.togglePlan) {
    const p = state.planned.find((x) => x.id === t.dataset.togglePlan);
    if (p) {
      const i = p.paidMonths.indexOf(viewMonth);
      if (i >= 0) p.paidMonths.splice(i, 1); else p.paidMonths.push(viewMonth);
      save(); renderAll();
    }
  } else if (t.dataset.delPlan) {
    state.planned = state.planned.filter((x) => x.id !== t.dataset.delPlan);
    save(); renderAll(); toast("Платёж удалён");
  } else if (t.dataset.delCat) {
    if (confirm("Удалить категорию? Связанные траты останутся без категории.")) {
      state.categories = state.categories.filter((x) => x.id !== t.dataset.delCat);
      save(); renderAll(); toast("Категория удалена");
    }
  }
});

// Изменение лимита категории на лету
document.getElementById("categoryList").addEventListener("change", (e) => {
  const id = e.target.dataset.catLimit;
  if (!id) return;
  const cat = state.categories.find((c) => c.id === id);
  if (cat) { cat.limit = parseFloat(e.target.value) || 0; save(); renderOverview(); toast("Лимит обновлён"); }
});

// Сброс
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Удалить ВСЕ данные и вернуть настройки по умолчанию?")) {
    localStorage.removeItem(STORE_KEY);
    state = load();
    renderAll();
    toast("Данные сброшены");
  }
});

/* ---------- Service Worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

renderAll();
