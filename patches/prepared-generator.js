import { getPreparedHistory, getPreparedStatus, kindForDate, stagePreparedContent } from './prepared-content.js';

const AI_GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';
const MODEL = process.env.CONTENT_GENERATION_MODEL || 'openai/gpt-5.6-sol';

function gatewayToken() {
  return String(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || '').trim();
}

function compact(value, max = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function historyForPrompt(history = {}) {
  return {
    generatedHistory: (Array.isArray(history.generatedHistory) ? history.generatedHistory : []).slice(0, 20).map((item) => ({
      dateKey: item?.dateKey || null,
      kind: item?.kind || null,
      title: compact(item?.title, 140),
      description: compact(item?.description || item?.body, 260),
      slides: Array.isArray(item?.slides) ? item.slides.slice(0, 5).map((slide) => ({
        title: compact(slide?.title, 100),
        body: compact(slide?.body, 180),
      })) : [],
    })),
    legacyPublicationIndex: (Array.isArray(history.legacyPublicationIndex) ? history.legacyPublicationIndex : []).slice(0, 20),
    recentTelegram: (Array.isArray(history.recentTelegram) ? history.recentTelegram : []).slice(0, 20).map((entry) => ({
      datetime: entry?.datetime || null,
      text: compact(entry?.text, 360),
    })),
  };
}

function slidesSchema(kind) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      dateKey: { type: 'string' },
      kind: { type: 'string', enum: [kind] },
      title: { type: 'string' },
      description: { type: 'string' },
      format: { type: 'string', enum: ['slides'] },
      slides: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['title', 'body'],
        },
      },
    },
    required: ['dateKey', 'kind', 'title', 'description', 'format', 'slides'],
  };
}

function eventsSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      dateKey: { type: 'string' },
      kind: { type: 'string', enum: ['events'] },
      title: { type: 'string' },
      body: { type: 'string' },
      format: { type: 'string', enum: ['text'] },
      slides: {
        type: 'array',
        maxItems: 0,
      },
    },
    required: ['dateKey', 'kind', 'title', 'body', 'format', 'slides'],
  };
}

function baseInstructions(dateKey, kind, history) {
  const shared = [
    'Ты готовишь один материал для публичного канала по арбитражу трафика.',
    `Дата по Москве: ${dateKey}. Рубрика: ${kind}.`,
    'Не повторяй темы, идеи, заголовки, формулировки, структуру слайдов, советы, примеры и практические выводы из истории ниже.',
    'Не пиши LH и не используй emoji.',
    'Не добавляй футеры и ссылку на VK.',
    'Не используй в публичном тексте названия Meta, Facebook или Instagram; используй естественные формулировки «рекламный кабинет», «реклама в соцсетях», «источник трафика».',
    'Пиши по-русски, конкретно и без воды.',
    'История для антидубля:',
    JSON.stringify(history),
  ];

  if (kind === 'team') {
    shared.push('Для team: тема должна быть про реальную организацию работы команды, процессы, коммуникацию, контроль или качество исполнения. Не придумывай цифры, результаты, кейсы или события.');
  } else if (kind === 'practical') {
    shared.push('Для practical: только прикладной материал с конкретными действиями, проверками или рабочими приёмами. Без абстрактной теории.');
  } else if (kind === 'beginner') {
    shared.push('Для beginner: ТОЛЬКО арбитраж трафика на товарные офферы или нутру через рекламный кабинет. Материал должен быть понятен человеку без опыта: конкретные действия, базовые термины, логика запуска, выбор оффера и GEO, креативы, структура кампаний, метрики, анализ результатов, типичные ошибки, оптимизация или следующие шаги. Не уходи в общий маркетинг.');
  }

  if (kind !== 'events') {
    shared.push('Сделай ровно 5 связанных слайдов. Слайд 1 — сильный заголовок и заход; 2–4 — полезные тезисы, шаги, наблюдения или конкретные примеры; 5 — главный практический вывод. Не перегружай текстом. После слайдов нужен title поста и description на 2–3 предложения.');
  }

  return shared.join('\n\n');
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('AI Gateway returned empty content');
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i);
  return JSON.parse(fenced ? fenced[1].trim() : text);
}

async function generateStructured(dateKey, kind, history) {
  const token = gatewayToken();
  if (!token) throw new Error('AI Gateway authentication is unavailable');

  const response = await fetch(`${AI_GATEWAY_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      temperature: 0.6,
      messages: [
        { role: 'system', content: 'Return only the requested JSON object. Follow the schema exactly.' },
        { role: 'user', content: baseInstructions(dateKey, kind, history) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'traffic_news_prepared_content',
          strict: true,
          schema: slidesSchema(kind),
        },
      },
    }),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`AI Gateway generation failed: ${response.status} ${compact(data?.error?.message || data?.error || '', 300)}`);
  }
  return parseJsonText(data?.choices?.[0]?.message?.content);
}

function responseOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const parts = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type !== 'message') continue;
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function generateEvents(dateKey, history) {
  const token = gatewayToken();
  if (!token) throw new Error('AI Gateway authentication is unavailable');
  const prompt = [
    baseInstructions(dateKey, 'events', history),
    'Через web search найди только БУДУЩИЕ относительно указанной даты подтверждённые конференции, митапы, вебинары и другие полезные события по арбитражу трафика, affiliate marketing и CPA.',
    'Перепроверь даты по доступным источникам. Не включай прошедшие или неподтверждённые события.',
    'Верни только JSON в формате: {"dateKey":"' + dateKey + '","kind":"events","title":"...","body":"...","format":"text","slides":[]}.',
    'body должен быть полноценным готовым постом с названиями событий, датами и полезным пояснением. Ссылки на официальные страницы событий разрешены.',
  ].join('\n\n');

  let lastError = null;
  for (const toolType of ['web_search', 'web_search_preview']) {
    const response = await fetch(`${AI_GATEWAY_URL}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input: prompt,
        tools: [{ type: toolType }],
        tool_choice: 'auto',
      }),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (response.ok) return parseJsonText(responseOutputText(data));
    lastError = `${response.status} ${compact(data?.error?.message || data?.error || '', 300)}`;
    if (![400, 404, 422].includes(response.status)) break;
  }
  throw new Error(`AI Gateway event search failed: ${lastError || 'unknown error'}`);
}

export async function prepareContentForToday(now = new Date()) {
  const schedule = kindForDate(now);
  if (!schedule.kind) return { ok: true, skipped: 'No publication scheduled for today', dateKey: schedule.dateKey };

  const existing = await getPreparedStatus(now);
  if (existing.prepared && existing.dateKey === schedule.dateKey && existing.scheduledKind === schedule.kind) {
    return { ok: true, skipped: 'Content is already prepared', dateKey: schedule.dateKey, kind: schedule.kind, title: existing.title };
  }

  const history = historyForPrompt(await getPreparedHistory(60));
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const item = schedule.kind === 'events'
        ? await generateEvents(schedule.dateKey, history)
        : await generateStructured(schedule.dateKey, schedule.kind, history);
      const result = await stagePreparedContent(item, now);
      return { ...result, generated: true, attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error('MORNING_CONTENT_GENERATION_ATTEMPT_FAILED', { attempt, dateKey: schedule.dateKey, kind: schedule.kind, error: lastError });
    }
  }
  return { ok: false, dateKey: schedule.dateKey, kind: schedule.kind, error: lastError || 'Content generation failed' };
}
