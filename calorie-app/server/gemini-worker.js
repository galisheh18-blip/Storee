/*
 * БЕСПЛАТНЫЙ прокси для распознавания еды по фото через Google Gemini.
 * Разворачивается как Cloudflare Worker. Ключ хранится секретом GEMINI_API_KEY
 * (бесплатный ключ: https://aistudio.google.com/apikey) и в клиент не попадает.
 *
 * Приложение шлёт: POST { image: "<base64 jpeg>", mediaType: "image/jpeg" }
 * Прокси отвечает:  { name, grams, kcal, p, f, c }
 *
 * Интерфейс совпадает с cloudflare-worker.js (Claude) — в приложении просто
 * ставится этот URL, менять код не нужно.
 */

const MODEL = "gemini-2.0-flash"; // бесплатный тариф; можно "gemini-2.5-flash"

const SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    grams: { type: "NUMBER" },
    kcal: { type: "NUMBER" },
    p: { type: "NUMBER" },
    f: { type: "NUMBER" },
    c: { type: "NUMBER" },
  },
  required: ["name", "grams", "kcal", "p", "f", "c"],
};

const PROMPT = "Определи блюдо на фото и оцени его пищевую ценность. " +
  "Оцени реалистичный размер порции по фото. Значения kcal/p/f/c указывай для всей порции целиком. " +
  "name — короткое название блюда по-русски, grams — вес порции в граммах.";

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

// Крошечное изображение 1x1 для самопроверки
const TEST_IMG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });

    // GET = самодиагностика: откройте адрес воркера в браузере
    if (request.method === "GET") {
      const key = env.GEMINI_API_KEY || "";
      const diag = { selftest: true, keyPresent: !!key, keyPrefix: key.slice(0, 4), keyLength: key.length, model: MODEL };
      if (!key) { diag.hint = "Секрет GEMINI_API_KEY не задан. Settings → Variables and Secrets → Add (Secret)."; return json(diag, 200); }
      try {
        const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL +
          ":generateContent?key=" + encodeURIComponent(key);
        const r = await fetch(url, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [
            { inline_data: { mime_type: "image/png", data: TEST_IMG } },
            { text: "Ответь одним словом: ок" },
          ] }] }),
        });
        diag.geminiStatus = r.status;
        diag.geminiBody = (await r.text()).slice(0, 800);
      } catch (e) { diag.fetchError = String(e); }
      return json(diag, 200);
    }

    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors() });

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400); }
    const { image, mediaType } = body || {};
    if (!image) return json({ error: "no image" }, 400);

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL +
      ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY);

    const apiRes = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mediaType || "image/jpeg", data: image } },
            { text: PROMPT },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return json({ error: "gemini error", detail: text }, 502);
    }
    const data = await apiRes.json();
    const part = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0];
    if (!part || !part.text) return json({ error: "no content", raw: JSON.stringify(data).slice(0, 500) }, 502);
    let parsed;
    try { parsed = JSON.parse(part.text); } catch (e) { return json({ error: "parse", raw: part.text }, 502); }
    return json(parsed, 200);
  },
};
