import { datePartsInMoscow, getPreparedHistory, getPreparedStatus, kindForDate, stagePreparedContent } from './prepared-content.js';
import { getQueuePost, listQueuePosts, putQueuePost, queueConfigured } from './content-queue-client.mjs';

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

function dateFromDateKey(dateKey) {
  const match = String(dateKey || '').match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!match) throw new Error('Invalid dateKey');
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
}

function dateKeyForDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export async function generateContentForDate(dateKey, kind, historyInput = null) {
  const scheduledKind = kindForDate(dateFromDateKey(dateKey)).kind;
  if (!scheduledKind || scheduledKind !== kind) {
    throw new Error(`Date ${dateKey} is not scheduled for ${kind}`);
  }
  const history = historyForPrompt(historyInput || await getPreparedHistory(60));
  return kind === 'events'
    ? generateEvents(dateKey, history)
    : generateStructured(dateKey, kind, history);
}

export async function replenishContentQueue(now = new Date(), horizonDays = 30, maxGenerate = 1) {
  if (!queueConfigured()) {
    return { ok: true, skipped: 'Content queue API is not configured', added: [] };
  }

  const horizon = Math.max(1, Math.min(Number(horizonDays) || 30, 90));
  const limit = Math.max(1, Math.min(Number(maxGenerate) || 1, 5));
  const current = datePartsInMoscow(now);
  const anchor = new Date(Date.UTC(current.year, current.month - 1, current.day, 12, 0, 0));
  const end = new Date(anchor);
  end.setUTCDate(end.getUTCDate() + horizon);
  const endKey = dateKeyForDate(end);

  const queued = await listQueuePosts({ from: current.dateKey, to: endKey });
  const queuedDates = new Set(queued.map((item) => item?.dateKey).filter(Boolean));
  const missing = [];

  for (let offset = 1; offset <= horizon; offset += 1) {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() + offset);
    const dateKey = dateKeyForDate(date);
    const kind = kindForDate(date).kind;
    if (kind && !queuedDates.has(dateKey)) missing.push({ dateKey, kind });
  }

  if (!missing.length) {
    return { ok: true, added: [], horizonEnd: endKey, queued: queued.length };
  }

  const baseHistory = await getPreparedHistory(60);
  const workingHistory = {
    ...baseHistory,
    generatedHistory: [
      ...queued.map((item) => ({
        dateKey: item.dateKey,
        kind: item.kind,
        title: item.title,
        description: item.description,
        body: item.body,
        slides: item.slides,
      })),
      ...(Array.isArray(baseHistory.generatedHistory) ? baseHistory.generatedHistory : []),
    ],
  };

  const added = [];
  for (const target of missing.slice(0, limit)) {
    const item = await generateContentForDate(target.dateKey, target.kind, workingHistory);
    await putQueuePost(item);
    added.push({ dateKey: item.dateKey, kind: item.kind, title: item.title });
    workingHistory.generatedHistory.unshift(item);
  }

  return { ok: true, added, horizonEnd: endKey, queued: queued.length + added.length };
}

export async function prepareContentForToday(now = new Date()) {
  const schedule = kindForDate(now);
  if (!schedule.kind) return { ok: true, skipped: 'No publication scheduled for today', dateKey: schedule.dateKey };

  if (queueConfigured()) {
    try {
      const queuedItem = await getQueuePost(schedule.dateKey);
      if (queuedItem) {
        const queuedResult = await stagePreparedContent(queuedItem, now);
        return { ...queuedResult, source: 'cloudflare-d1' };
      }
    } catch (error) {
      console.error('CONTENT_QUEUE_TODAY_READ_ERROR', {
        dateKey: schedule.dateKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const existing = await getPreparedStatus(now);
  if (existing.prepared && existing.dateKey === schedule.dateKey && existing.scheduledKind === schedule.kind) {
    return { ok: true, skipped: 'Content is already prepared', dateKey: schedule.dateKey, kind: schedule.kind, title: existing.title };
  }

  const history = historyForPrompt(await getPreparedHistory(60));
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const item = await generateContentForDate(schedule.dateKey, schedule.kind, {
        generatedHistory: history.generatedHistory,
        legacyPublicationIndex: history.legacyPublicationIndex,
        recentTelegram: history.recentTelegram,
      });
      const result = await stagePreparedContent(item, now);
      return { ...result, generated: true, attempt };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.error('MORNING_CONTENT_GENERATION_ATTEMPT_FAILED', { attempt, dateKey: schedule.dateKey, kind: schedule.kind, error: lastError });
    }
  }
  return { ok: false, dateKey: schedule.dateKey, kind: schedule.kind, error: lastError || 'Content generation failed' };
}
