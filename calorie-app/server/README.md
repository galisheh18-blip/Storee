# Прокси для распознавания еды по фото

Крошечный серверный прокси, который прячет ваш API-ключ Claude и вызывает vision-модель для оценки калорий и БЖУ по фотографии блюда. Приложение общается только с этим прокси — ключ в браузер не попадает.

Поток данных:

```
Приложение  --POST { image, mediaType }-->  Прокси (хранит ключ)  -->  Claude API
Приложение  <--{ name, grams, kcal, p, f, c }--  Прокси
```

## Какой файл выбрать

- `gemini-worker.js` — **бесплатно** (Google Gemini, бесплатный тариф). Рекомендуется, если не хотите платить.
- `cloudflare-worker.js` — Claude (платный API Anthropic, выше точность).

Оба отдают одинаковый ответ `{ name, grams, kcal, p, f, c }` — в приложении просто ставится URL нужного прокси, код менять не надо.

## Бесплатный вариант — Gemini (рекомендуется)

1. Получите **бесплатный** ключ: https://aistudio.google.com/apikey
2. Разверните `gemini-worker.js` на Cloudflare Workers (бесплатный тариф хостинга):
   ```sh
   npm install -g wrangler
   wrangler login
   cd calorie-app/server
   printf 'name="calorie-photo-proxy"\nmain="gemini-worker.js"\ncompatibility_date="2024-11-01"\n' > wrangler.toml
   wrangler secret put GEMINI_API_KEY   # вставить ключ из AI Studio
   wrangler deploy
   ```
3. Скопируйте выданный адрес `https://…workers.dev` → вставьте в приложении: **«Ещё» → URL прокси**.

**Лимиты и приватность:** у бесплатного тарифа Gemini есть ограничения по числу запросов в минуту/сутки (для личного использования обычно с запасом). На бесплатном тарифе Google может использовать переданные данные для улучшения сервиса — не отправляйте то, что считаете чувствительным.

## Платный вариант — Claude (Cloudflare Workers)

1. Установите инструмент и войдите:
   ```sh
   npm install -g wrangler
   wrangler login
   ```
2. Создайте `wrangler.toml` рядом с `cloudflare-worker.js`:
   ```toml
   name = "calorie-photo-proxy"
   main = "cloudflare-worker.js"
   compatibility_date = "2024-11-01"
   ```
3. Добавьте ключ API как секрет (получить: https://console.anthropic.com):
   ```sh
   wrangler secret put ANTHROPIC_API_KEY
   ```
4. Опубликуйте:
   ```sh
   wrangler deploy
   ```
5. Скопируйте выданный адрес (вида `https://calorie-photo-proxy.ВАШ.workers.dev`) и вставьте его в приложении: вкладка **«Ещё» → «Распознавание по фото» → URL прокси**.

## Вариант 2. Vercel / Node (serverless-функция)

Тот же запрос можно обслужить функцией на Vercel. Положите файл `api/recognize.js`:

```js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: "no image" });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system: "Ты нутрициолог. По фото еды оцени блюдо и его пищевую ценность для всей порции целиком.",
      output_config: { format: { type: "json_schema", schema: {
        type: "object",
        properties: {
          name: { type: "string" }, grams: { type: "number" },
          kcal: { type: "number" }, p: { type: "number" }, f: { type: "number" }, c: { type: "number" },
        },
        required: ["name", "grams", "kcal", "p", "f", "c"], additionalProperties: false,
      } } },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
        { type: "text", text: "Что это за блюдо и сколько в нём калорий и БЖУ?" },
      ] }],
    }),
  });
  const data = await r.json();
  const text = (data.content || []).find((b) => b.type === "text");
  res.status(200).json(JSON.parse(text.text));
}
```

Задайте переменную окружения `ANTHROPIC_API_KEY` в настройках проекта Vercel, задеплойте и вставьте адрес функции в приложение.

## Выбор модели

По умолчанию используется `claude-opus-4-8` — самая точная. Для большого объёма фото можно поменять `MODEL` на `claude-haiku-4-5` (дешевле) или `claude-sonnet-5` — строгий JSON поддерживают все три.

## Приватность

Фото уходит на выбранный сервис (Anthropic) для оценки. Если оставить поле URL прокси пустым, кнопка распознавания просто не работает и приложение остаётся полностью офлайн.
