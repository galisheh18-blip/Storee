/*
 * БЕСПЛАТНЫЙ прокси для распознавания еды по фото через Groq (vision-модель Llama 4).
 * Cloudflare Worker. Ключ — секрет GROQ_API_KEY (бесплатно: https://console.groq.com/keys).
 * Часто доступен там, где бесплатный тариф Gemini даёт нулевую квоту.
 *
 * Приложение шлёт: POST { image: "<base64 jpeg>", mediaType: "image/jpeg" }
 * Прокси отвечает:  { name, grams, kcal, p, f, c }  — тот же контракт, что у других воркеров.
 */

const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // vision; при недоступности: "meta-llama/llama-4-maverick-17b-128e-instruct"

const PROMPT = "Определи блюдо на фото и оцени его пищевую ценность по реалистичному размеру порции. " +
  "Ответь СТРОГО одним JSON-объектом без пояснений в формате: " +
  '{"name": строка (название блюда по-русски), "grams": число (вес порции в граммах), ' +
  '"kcal": число, "p": число (белки, г), "f": число (жиры, г), "c": число (углеводы, г)}. ' +
  "Все значения kcal/p/f/c — для всей порции целиком.";

const TEST_IMG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function cors(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }, extra || {});
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: cors({ "content-type": "application/json" }) });
}
function callGroq(key, dataUrl, jsonMode) {
  const msg = {
    model: MODEL,
    temperature: 0.2,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
  };
  if (jsonMode) msg.response_format = { type: "json_object" };
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { "authorization": "Bearer " + key, "content-type": "application/json" },
    body: JSON.stringify(msg),
  });
}

/* ---- План питания на день ---- */
const DIET = { any: "обычное", veg: "вегетарианское", vegan: "веганское", keto: "кето", lowcarb: "низкоуглеводное", highprot: "высокобелковое" };
const CUIS = { any: "любая", ru: "русская", it: "итальянская", asia: "азиатская", med: "средиземноморская" };
const TIME = { any: "не важно", fast: "быстро, до 15 минут", mid: "среднее" };
function mealPlanPrompt(t, p) {
  t = t || {}; p = p || {};
  return "Составь план питания на день под цель: " + (t.kcal || 0) + " ккал, белки " + (t.p || 0) +
    " г, жиры " + (t.f || 0) + " г, углеводы " + (t.c || 0) + " г. " +
    "Количество приёмов пищи: " + (p.meals || 4) + ". Тип питания: " + (DIET[p.diet] || "обычное") +
    ". Кухня: " + (CUIS[p.cuisine] || "любая") + ". Время на готовку: " + (TIME[p.time] || "не важно") + ". " +
    (p.exclude ? ("Полностью исключить: " + p.exclude + ". ") : "") +
    "Сумма калорий и БЖУ по всем приёмам должна быть близка к цели. " +
    "Ответь СТРОГО одним JSON-объектом без пояснений: " +
    '{"meals":[{"meal":"breakfast|lunch|dinner|snack","title":строка,"kcal":число,"p":число,"f":число,"c":число,' +
    '"ingredients":[{"name":строка,"grams":число}],"recipe":строка(2-4 коротких шага)}]}. ' +
    "Названия и рецепты — по-русски.";
}
async function handleMealPlan(body, env) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "authorization": "Bearer " + env.GROQ_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL, temperature: 0.6, response_format: { type: "json_object" },
      messages: [{ role: "user", content: mealPlanPrompt(body.targets, body.prefs) }],
    }),
  });
  if (!res.ok) { const t = await res.text(); return json({ error: "groq error", detail: t }, 502); }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) return json({ error: "no content" }, 502);
  try { return json(JSON.parse(content), 200); } catch (e) { return json({ error: "parse", raw: content.slice(0, 400) }, 502); }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    // GET = самодиагностика: откройте адрес воркера в браузере
    if (request.method === "GET") {
      const key = env.GROQ_API_KEY || "";
      const diag = { selftest: true, keyPresent: !!key, keyPrefix: key.slice(0, 4), keyLength: key.length, model: MODEL };
      if (!key) { diag.hint = "Секрет GROQ_API_KEY не задан."; return json(diag, 200); }
      try {
        const r = await callGroq(key, "data:image/png;base64," + TEST_IMG, false);
        diag.groqStatus = r.status;
        diag.groqBody = (await r.text()).slice(0, 800);
      } catch (e) { diag.fetchError = String(e); }
      return json(diag, 200);
    }

    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors() });
    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400); }
    if (body && body.task === "mealplan") return handleMealPlan(body, env);
    const { image, mediaType } = body || {};
    if (!image) return json({ error: "no image" }, 400);

    const dataUrl = "data:" + (mediaType || "image/jpeg") + ";base64," + image;
    const apiRes = await callGroq(env.GROQ_API_KEY, dataUrl, true);
    if (!apiRes.ok) { const text = await apiRes.text(); return json({ error: "groq error", detail: text }, 502); }
    const data = await apiRes.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) return json({ error: "no content" }, 502);
    let parsed;
    try { parsed = JSON.parse(content); } catch (e) { return json({ error: "parse", raw: content.slice(0, 400) }, 502); }
    return json(parsed, 200);
  },
};
