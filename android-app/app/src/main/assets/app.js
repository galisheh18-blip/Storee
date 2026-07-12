/* Мои траты — оффлайн PWA для учёта расходов и доходов.
   Данные хранятся локально в браузере (localStorage). */

const STORE_KEY = "expense-app-v1";
const PALETTE = ["#4f46e5", "#16a34a", "#dc2626", "#d97706", "#0891b2", "#7c3aed", "#db2777", "#65a30d"];

/* ---------- Состояние ---------- */
function defaultState() {
  const c = (name, limit, icon, color) => ({ id: uid(), name, limit, icon, color });
  return {
    settings: { currency: "₽" },
    categories: [
      c("Продукты", 20000, "🛒", PALETTE[0]),
      c("Транспорт", 5000, "🚌", PALETTE[1]),
      c("Кафе и рестораны", 8000, "🍽️", PALETTE[2]),
      c("Развлечения", 5000, "🎬", PALETTE[3]),
      c("Здоровье", 4000, "💊", PALETTE[4]),
      c("Прочее", 5000, "📦", PALETTE[5]),
    ],
    expenses: [],
    incomes: [],
    planned: [
      { id: uid(), title: "ЖКХ", amount: 6000, paidMonths: [] },
      { id: uid(), title: "Интернет", amount: 700, paidMonths: [] },
      { id: uid(), title: "Подписки", amount: 900, paidMonths: [] },
    ],
  };
}

let state = load();
let viewMonth = monthKey(new Date());
let formType = "expense"; // расход/доход в форме добавления

function uid() { return Math.random().toString(36).slice(2, 10); }
function CURRENCY() { return (state.settings && state.settings.currency) || "₽"; }

function migrate(s) {
  if (!s.settings) s.settings = { currency: "₽" };
  if (!s.incomes) s.incomes = [];
  if (!s.expenses) s.expenses = [];
  if (!s.planned) s.planned = [];
  if (!s.categories) s.categories = [];
  s.categories.forEach((c, i) => { if (!c.color) c.color = PALETTE[i % PALETTE.length]; if (!c.icon) c.icon = "•"; });
  s.planned.forEach((p) => { if (!Array.isArray(p.paidMonths)) p.paidMonths = []; });
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

/* ---------- Утилиты ---------- */
function monthKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function fmt(n) { return Math.round(n).toLocaleString("ru-RU") + " " + CURRENCY(); }
function fmtSign(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("ru-RU") + " " + CURRENCY(); }
const MONTHS = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const MONTHS_SHORT = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
function monthLabel(key) { const [y, m] = key.split("-").map(Number); return MONTHS[m - 1] + " " + y; }
function expensesForMonth(key) { return state.expenses.filter((e) => e.date.slice(0, 7) === key); }
function incomesForMonth(key) { return state.incomes.filter((e) => e.date.slice(0, 7) === key); }
function spentByCategory(key) {
  const map = {};
  for (const e of expensesForMonth(key)) map[e.catId] = (map[e.catId] || 0) + e.amount;
  return map;
}
function plannedStats(key) {
  let total = 0, paid = 0, unpaidCount = 0;
  for (const p of state.planned) {
    const amt = Number(p.amount) || 0;
    total += amt;
    if (p.paidMonths.includes(key)) paid += amt; else unpaidCount++;
  }
  return { total, paid, due: total - paid, unpaidCount, count: state.planned.length };
}
function catColor(cat, i) { return (cat && cat.color) || PALETTE[i % PALETTE.length]; }

/* ---------- Рендер: Обзор ---------- */
function renderOverview() {
  const spent = spentByCategory(viewMonth);
  const expensesTotal = Object.values(spent).reduce((a, b) => a + b, 0);
  const limitsTotal = state.categories.reduce((a, c) => a + (Number(c.limit) || 0), 0);
  const pl = plannedStats(viewMonth);
  const totalSpent = expensesTotal + pl.paid;
  const totalBudget = limitsTotal + pl.total;
  const left = totalBudget - totalSpent;

  document.getElementById("sumSpent").textContent = fmt(totalSpent);
  document.getElementById("sumBudget").textContent = fmt(totalBudget);
  document.getElementById("sumLeft").textContent = fmt(left);

  const pct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
  const bar = document.getElementById("totalBar");
  bar.style.width = pct + "%";
  bar.className = "progress-fill" + (totalSpent > totalBudget ? " over" : pct > 80 ? " warn" : "");
  document.getElementById("totalPct").textContent = Math.round(pct) + "% бюджета";
  document.getElementById("totalHint").textContent = left >= 0 ? "осталось " + fmt(left) : "перерасход " + fmt(-left);

  // Доходы / расходы / баланс
  const incomeTotal = incomesForMonth(viewMonth).reduce((a, e) => a + e.amount, 0);
  const balance = incomeTotal - totalSpent;
  const br = document.getElementById("balanceRow");
  br.innerHTML = `
    <span class="bl in">Доходы ${fmt(incomeTotal)}</span>
    <span class="bl out">Расходы ${fmt(totalSpent)}</span>
    <span class="bl bal ${balance < 0 ? "neg" : "pos"}">Баланс ${fmtSign(balance)}</span>`;

  // Таблица по категориям
  const body = document.getElementById("catTableBody");
  body.innerHTML = "";
  state.categories.forEach((cat, i) => {
    const s = spent[cat.id] || 0;
    const lim = Number(cat.limit) || 0;
    const rest = lim - s;
    const p = lim > 0 ? Math.min(100, (s / lim) * 100) : (s > 0 ? 100 : 0);
    const cls = s > lim && lim > 0 ? "over" : p > 80 ? "warn" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cat-cell">
          <span class="cat-name"><span class="cat-ico" style="background:${catColor(cat, i)}"></span>${cat.icon || "•"} ${escapeHtml(cat.name)}</span>
          <div class="mini-bar"><div class="mini-fill ${cls}" style="width:${p}%"></div></div>
        </div>
      </td>
      <td class="num">${fmt(s)}</td>
      <td class="num">${lim > 0 ? fmt(lim) : "—"}</td>
      <td class="num ${lim > 0 ? (rest < 0 ? "left-neg" : "left-pos") : ""}">${lim > 0 ? fmt(rest) : "—"}</td>`;
    body.appendChild(tr);
  });
  if (pl.total > 0) {
    const rest = pl.total - pl.paid;
    const p = Math.min(100, (pl.paid / pl.total) * 100);
    const tr = document.createElement("tr");
    tr.className = "planned-row";
    tr.innerHTML = `
      <td><div class="cat-cell"><span class="cat-name">📆 Плановые платежи</span>
        <div class="mini-bar"><div class="mini-fill" style="width:${p}%"></div></div></div></td>
      <td class="num">${fmt(pl.paid)}</td>
      <td class="num">${fmt(pl.total)}</td>
      <td class="num ${rest < 0 ? "left-neg" : "left-pos"}">${fmt(rest)}</td>`;
    body.appendChild(tr);
  }
  document.getElementById("tfSpent").textContent = fmt(totalSpent);
  document.getElementById("tfLimit").textContent = fmt(totalBudget);
  document.getElementById("tfLeft").textContent = fmt(left);

  // Итог по плановым
  const note = document.getElementById("plannedNote");
  if (pl.count && pl.due > 0) {
    note.textContent = `Осталось оплатить ${fmt(pl.due)} · ${pl.unpaidCount} из ${pl.count}`;
    note.className = "planned-note due";
  } else if (pl.count) {
    note.textContent = "Все плановые платежи оплачены ✓";
    note.className = "planned-note done";
  } else { note.textContent = ""; }

  // Мини-список плановых
  const mini = document.getElementById("plannedMini");
  mini.innerHTML = "";
  if (!state.planned.length) mini.innerHTML = `<div class="empty">Плановых платежей нет</div>`;
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

/* ---------- Рендер: Траты и доходы ---------- */
function renderExpenses() {
  const sel = document.getElementById("expCategory");
  sel.innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${c.icon || ""} ${escapeHtml(c.name)}</option>`)
    .join("");

  const q = (document.getElementById("searchBox").value || "").trim().toLowerCase();
  const list = document.getElementById("expenseList");

  // объединяем траты и доходы месяца
  let items = [];
  for (const e of expensesForMonth(viewMonth)) items.push({ ...e, kind: "expense" });
  for (const e of incomesForMonth(viewMonth)) items.push({ ...e, kind: "income" });
  items.sort((a, b) => b.date.localeCompare(a.date));

  if (q) {
    items = items.filter((e) => {
      const cat = state.categories.find((c) => c.id === e.catId);
      return (e.note || "").toLowerCase().includes(q) || (cat && cat.name.toLowerCase().includes(q));
    });
  }

  list.innerHTML = "";
  if (!items.length) { list.innerHTML = `<div class="empty">Ничего нет за ${monthLabel(viewMonth)}</div>`; return; }
  for (const e of items) {
    const income = e.kind === "income";
    const cat = income ? null : state.categories.find((c) => c.id === e.catId);
    const title = income ? "💰 Доход" : (cat ? (cat.icon || "") + " " + escapeHtml(cat.name) : "Без категории");
    const row = document.createElement("div");
    row.className = "row clickable";
    row.dataset.edit = e.kind + ":" + e.id;
    row.innerHTML = `
      <div class="row-main">
        <div class="row-title">${title}</div>
        <div class="row-sub">${formatDate(e.date)}${e.note ? " · " + escapeHtml(e.note) : ""}</div>
      </div>
      <div class="row-amount ${income ? "amt-in" : ""}">${income ? "+" : ""}${fmt(e.amount)}</div>`;
    list.appendChild(row);
  }
}

/* ---------- Рендер: Планы ---------- */
function renderPlanned() {
  const pl = plannedStats(viewMonth);
  const summary = document.getElementById("plannedSummary");
  if (pl.count) {
    const p = pl.total > 0 ? Math.min(100, (pl.paid / pl.total) * 100) : 0;
    summary.style.display = "";
    summary.innerHTML = `
      <div class="ps-top">
        <div>
          <div class="ps-label">Осталось оплатить</div>
          <div class="ps-value ${pl.due > 0 ? "due" : "done"}">${pl.due > 0 ? fmt(pl.due) : "0 " + CURRENCY() + " ✓"}</div>
        </div>
        <div class="ps-right">
          <div class="ps-sub">${pl.unpaidCount} из ${pl.count} платежей</div>
          <div class="ps-sub">оплачено ${fmt(pl.paid)} из ${fmt(pl.total)}</div>
        </div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>`;
  } else { summary.style.display = "none"; }

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

/* ---------- Рендер: Графики ---------- */
function renderCharts() {
  // Столбцы: расходы за последние 6 месяцев
  const months = [];
  const base = new Date(viewMonth + "-01T00:00:00");
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = monthKey(d);
    const exp = state.expenses.filter((e) => e.date.slice(0, 7) === key).reduce((a, e) => a + e.amount, 0);
    const pl = state.planned.reduce((a, p) => a + (p.paidMonths.includes(key) ? (Number(p.amount) || 0) : 0), 0);
    months.push({ key, label: MONTHS_SHORT[d.getMonth()], value: exp + pl });
  }
  const max = Math.max(1, ...months.map((m) => m.value));
  const barsW = 300, barsH = 150, gap = 12, bw = (barsW - gap * 5) / 6;
  let bars = "";
  months.forEach((m, i) => {
    const h = Math.round((m.value / max) * barsH);
    const x = i * (bw + gap);
    const y = barsH - h;
    const cur = m.key === viewMonth;
    bars += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="4" fill="${cur ? "#4f46e5" : "#a5b4fc"}"></rect>`;
    bars += `<text x="${x + bw / 2}" y="${barsH + 16}" text-anchor="middle" class="cx-lbl">${m.label}</text>`;
    if (m.value > 0) bars += `<text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" class="cx-val">${Math.round(m.value / 1000)}к</text>`;
  });
  document.getElementById("barChart").innerHTML =
    months.every((m) => m.value === 0)
      ? `<div class="empty">Пока нет данных о расходах</div>`
      : `<svg viewBox="0 -14 ${barsW} ${barsH + 24}" width="100%" class="svg-chart">${bars}</svg>`;

  // Круговая: расходы по категориям текущего месяца
  const spent = spentByCategory(viewMonth);
  const slices = state.categories
    .map((c, i) => ({ name: c.name, icon: c.icon, value: spent[c.id] || 0, color: catColor(c, i) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const totalCat = slices.reduce((a, s) => a + s.value, 0);
  const donut = document.getElementById("donutChart");
  if (!totalCat) { donut.innerHTML = `<div class="empty">Нет трат за этот месяц</div>`; return; }

  const R = 60, C = 2 * Math.PI * R;
  let off = 0, ring = "";
  for (const s of slices) {
    const frac = s.value / totalCat;
    const len = frac * C;
    ring += `<circle r="${R}" cx="80" cy="80" fill="none" stroke="${s.color}" stroke-width="26"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"></circle>`;
    off += len;
  }
  const legend = slices.map((s) =>
    `<div class="lg-row"><span class="lg-dot" style="background:${s.color}"></span>
      <span class="lg-name">${s.icon || ""} ${escapeHtml(s.name)}</span>
      <span class="lg-val">${fmt(s.value)} · ${Math.round((s.value / totalCat) * 100)}%</span></div>`).join("");
  donut.innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 160 160" width="160" height="160" class="svg-chart">
        ${ring}
        <text x="80" y="76" text-anchor="middle" class="cx-mid">${fmt(totalCat)}</text>
        <text x="80" y="94" text-anchor="middle" class="cx-sub">за месяц</text>
      </svg>
      <div class="legend">${legend}</div>
    </div>`;
}

/* ---------- Рендер: Ещё (категории/настройки) ---------- */
function renderMore() {
  const list = document.getElementById("categoryList");
  list.innerHTML = "";
  state.categories.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <span class="cat-ico" style="background:${catColor(c, i)}"></span>
      <div class="row-main">
        <div class="row-title">${c.icon || "•"} ${escapeHtml(c.name)}</div>
        <div class="row-sub">Лимит на месяц</div>
      </div>
      <input type="number" inputmode="decimal" class="cat-limit-input" data-cat-limit="${c.id}"
             value="${Number(c.limit) || 0}" style="width:100px" />
      <button class="icon-btn" data-del-cat="${c.id}" title="Удалить">✕</button>`;
    list.appendChild(row);
  });
  document.getElementById("currencySelect").value = CURRENCY();
}

function renderAll() {
  document.getElementById("monthTitle").textContent = monthLabel(viewMonth);
  renderOverview();
  renderExpenses();
  renderPlanned();
  renderCharts();
  renderMore();
}

/* ---------- Хелперы ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function toISO(dateStr) {
  // dateStr = YYYY-MM-DD; сохраняем с текущим временем для сортировки
  const now = new Date();
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
}
function todayInMonth() {
  const now = new Date();
  if (monthKey(now) === viewMonth) return now.toISOString().slice(0, 10);
  return viewMonth + "-15";
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 1800);
}

/* ---------- Модальное окно ---------- */
function openModal(html) {
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modal").classList.remove("hidden");
}
function closeModal() { document.getElementById("modal").classList.add("hidden"); }
document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function openEditModal(kind, id) {
  const arr = kind === "income" ? state.incomes : state.expenses;
  const item = arr.find((x) => x.id === id);
  if (!item) return;
  const catOptions = state.categories
    .map((c) => `<option value="${c.id}" ${c.id === item.catId ? "selected" : ""}>${c.icon || ""} ${escapeHtml(c.name)}</option>`).join("");
  openModal(`
    <button class="modal-close" id="mClose">✕</button>
    <h3>${kind === "income" ? "Изменить доход" : "Изменить трату"}</h3>
    <div class="field"><label>Сумма</label>
      <input type="number" id="mAmount" inputmode="decimal" step="0.01" min="0" value="${item.amount}" /></div>
    ${kind === "expense" ? `<div class="field"><label>Категория</label><select id="mCat">${catOptions}</select></div>` : ""}
    <div class="field"><label>Дата</label><input type="date" id="mDate" value="${item.date.slice(0, 10)}" /></div>
    <div class="field"><label>Комментарий</label><input type="text" id="mNote" maxlength="60" value="${escapeHtml(item.note || "")}" /></div>
    <div class="modal-actions">
      <button class="btn ghost danger" id="mDelete">Удалить</button>
      <button class="btn primary" id="mSave">Сохранить</button>
    </div>`);
  document.getElementById("mClose").onclick = closeModal;
  document.getElementById("mDelete").onclick = () => {
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
    save(); closeModal(); renderAll(); toast("Удалено");
  };
  document.getElementById("mSave").onclick = () => {
    const amt = parseFloat(document.getElementById("mAmount").value);
    if (!(amt > 0)) return;
    item.amount = amt;
    item.note = document.getElementById("mNote").value.trim();
    item.date = toISO(document.getElementById("mDate").value || item.date.slice(0, 10));
    if (kind === "expense") item.catId = document.getElementById("mCat").value;
    save(); closeModal(); renderAll(); toast("Сохранено");
  };
}

/* ---------- Экспорт / импорт ---------- */
function openExportModal() {
  const json = JSON.stringify(state, null, 2);
  const dataUrl = "data:application/json;charset=utf-8," + encodeURIComponent(json);
  const fname = "traty-backup-" + monthKey(new Date()) + ".json";
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
    <input type="file" id="mFile" accept="application/json,.json" class="card-select" />
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
      if (!Array.isArray(parsed.categories)) throw new Error("bad");
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

document.getElementById("monthPicker").addEventListener("click", () => {
  const val = prompt("Месяц в формате ГГГГ-ММ (например 2026-07):", viewMonth);
  if (val && /^\d{4}-\d{2}$/.test(val)) { viewMonth = val; renderAll(); }
});

// Переключатель Расход/Доход
document.querySelectorAll(".seg").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    formType = btn.dataset.type;
    document.getElementById("catField").style.display = formType === "income" ? "none" : "";
    document.getElementById("expSubmit").textContent = formType === "income" ? "Добавить доход" : "Добавить трату";
  });
});

// Добавление траты/дохода
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("expAmount").value);
  if (!(amount > 0)) return;
  const note = document.getElementById("expNote").value.trim();
  const dateStr = document.getElementById("expDate").value || todayInMonth();
  const date = toISO(dateStr);
  if (formType === "income") {
    state.incomes.push({ id: uid(), amount, note, date });
    toast("Доход добавлен");
  } else {
    const catId = document.getElementById("expCategory").value;
    if (!catId) return;
    state.expenses.push({ id: uid(), catId, amount, note, date });
    toast("Трата добавлена");
  }
  save();
  e.target.reset();
  document.getElementById("expDate").value = todayInMonth();
  renderAll();
});

// Плановый платёж
document.getElementById("plannedForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("plTitle").value.trim();
  const amount = parseFloat(document.getElementById("plAmount").value);
  if (!title || !(amount >= 0)) return;
  state.planned.push({ id: uid(), title, amount, paidMonths: [] });
  save(); e.target.reset(); renderAll(); toast("Платёж добавлен");
});

// Категория
document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("catName").value.trim();
  const limit = parseFloat(document.getElementById("catLimit").value) || 0;
  const icon = document.getElementById("catIcon").value.trim() || "•";
  if (!name) return;
  state.categories.push({ id: uid(), name, limit, icon, color: PALETTE[state.categories.length % PALETTE.length] });
  save(); e.target.reset(); renderAll(); toast("Категория добавлена");
});

// Поиск
document.getElementById("searchBox").addEventListener("input", renderExpenses);

// Валюта
document.getElementById("currencySelect").addEventListener("change", (e) => {
  state.settings.currency = e.target.value; save(); renderAll(); toast("Валюта изменена");
});

// Экспорт / импорт / сброс
document.getElementById("exportBtn").addEventListener("click", openExportModal);
document.getElementById("importBtn").addEventListener("click", openImportModal);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Удалить ВСЕ данные и вернуть настройки по умолчанию?")) {
    localStorage.removeItem(STORE_KEY); state = load(); renderAll(); toast("Данные сброшены");
  }
});

// Делегирование кликов по спискам
document.getElementById("app").addEventListener("click", (e) => {
  const t = e.target;
  const row = t.closest("[data-edit]");
  if (row && !t.dataset.togglePlan) {
    const [kind, id] = row.dataset.edit.split(":");
    openEditModal(kind, id); return;
  }
  if (t.dataset.togglePlan) {
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

document.getElementById("categoryList").addEventListener("change", (e) => {
  const id = e.target.dataset.catLimit;
  if (!id) return;
  const cat = state.categories.find((c) => c.id === id);
  if (cat) { cat.limit = parseFloat(e.target.value) || 0; save(); renderOverview(); renderCharts(); toast("Лимит обновлён"); }
});

/* ---------- Service Worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

document.getElementById("expDate").value = todayInMonth();
renderAll();
