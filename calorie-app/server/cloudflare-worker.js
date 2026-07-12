/*
 * Прокси для распознавания еды по фото через Claude (vision + строгий JSON).
 * Разворачивается как Cloudflare Worker. Ключ API хранится как секрет ANTHROPIC_API_KEY
 * и НИКОГДА не попадает в клиент.
 *
 * Приложение шлёт: POST { image: "<base64 jpeg>", mediaType: "image/jpeg" }
 * Прокси отвечает:  { name, grams, kcal, p, f, c }
 *
 * Деплой — см. README.md в этой папке.
 */

const MODEL = "claude-opus-4-8"; // для экономии на объёме можно "claude-haiku-4-5" или "claude-sonnet-5"

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Название блюда по-русски" },
    grams: { type: "number", description: "Оценка веса порции на фото в граммах" },
    kcal: { type: "number", description: "Калории всей порции" },
    p: { type: "number", description: "Белки, г" },
    f: { type: "number", description: "Жиры, г" },
    c: { type: "number", description: "Углеводы, г" },
  },
  required: ["name", "grams", "kcal", "p", "f", "c"],
  additionalProperties: false,
};

function cors(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }, extra || {});
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors() });
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors() });

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400); }
    const { image, mediaType } = body || {};
    if (!image) return json({ error: "no image" }, 400);

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: "Ты нутрициолог. По фото еды оцени блюдо и его пищевую ценность. " +
          "Оценивай реалистичный размер порции по фото. Возвращай значения для всей порции целиком.",
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
            { type: "text", text: "Что это за блюдо и сколько в нём калорий и БЖУ? Оцени вес порции по фото." },
          ],
        }],
      }),
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return json({ error: "anthropic error", detail: text }, 502);
    }
    const data = await apiRes.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) return json({ error: "no content" }, 502);
    let parsed;
    try { parsed = JSON.parse(textBlock.text); } catch (e) { return json({ error: "parse", raw: textBlock.text }, 502); }
    return json(parsed, 200);
  },
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: cors({ "content-type": "application/json" }) });
}
