const MOSCOW_TIME_ZONE = 'Europe/Moscow';
const PUBLICATION_MINUTES = 18 * 60 + 40;

const RUBRICS = {
  practical: 'Прикладной пост',
  team: 'Работа команды',
  beginner: 'Пост для новичков',
  events: 'Отраслевые события',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateKeyFromParts(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function moscowParts(date = new Date(), includeTime = false) {
  const options = {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hourCycle = 'h23';
  }
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: includeTime ? Number(values.hour) : 0,
    minute: includeTime ? Number(values.minute) : 0,
    dateKey: `${values.year}-${values.month}-${values.day}`,
  };
}

export function publicationForDateKey(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  const weekday = date.getUTCDay();
  let kind = null;
  if (weekday === 3) kind = 'practical';
  else if (weekday === 5) kind = 'team';
  else if (weekday === 0) kind = 'beginner';
  else if (weekday === 6 && day >= 8 && day <= 14) kind = 'events';

  if (!kind) return null;
  return {
    kind,
    label: RUBRICS[kind],
    time: '18:40 МСК',
  };
}

export function buildPublicationCalendar(start = new Date(), days = 30) {
  const count = Math.max(1, Math.min(Number(days) || 30, 365));
  const startParts = moscowParts(start);
  const anchor = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() + index);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dateKey = dateKeyFromParts(year, month, day);
    const publication = publicationForDateKey(dateKey);
    return {
      dateKey,
      year,
      month,
      day,
      weekday: date.getUTCDay(),
      scheduled: Boolean(publication),
      kind: publication?.kind || null,
      label: publication?.label || null,
      time: publication?.time || null,
    };
  });
}

export function nextPublication(items, now = new Date()) {
  const current = moscowParts(now, true);
  const currentMinutes = current.hour * 60 + current.minute;
  return (Array.isArray(items) ? items : []).find((item) => {
    if (!item?.scheduled) return false;
    if (item.dateKey > current.dateKey) return true;
    if (item.dateKey < current.dateKey) return false;
    return currentMinutes < PUBLICATION_MINUTES;
  }) || null;
}

export const PUBLICATION_RUBRICS = RUBRICS;
