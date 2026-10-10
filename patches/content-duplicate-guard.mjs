const STOP_WORDS = new Set([
  'без','более','быть','был','была','были','было','вам','ваш','весь','вот','все','всего','где','для','его','если','есть','еще',
  'как','какой','когда','который','между','можно','над','надо','наш','нет','один','она','они','оно','после','перед','при','про',
  'сам','свой','так','такой','там','тем','того','тоже','только','уже','чем','что','чтобы','этот','эта','эти','это','или','из',
  'под','надо','нужно','нужен','нужна','сразу','через','каждый','первый','первые','первого','новый','новая','новые'
]);

const RU_SUFFIXES = [
  'иями','ями','ами','его','ого','ему','ому','ими','ыми','иях','ах','ях','ией','ей','ий','ый','ой','ая','яя','ое','ее','ие','ые',
  'ую','юю','ов','ев','ам','ям','ом','ем','ать','ять','ить','еть','уть','ться','ся','ы','и','а','я','у','ю','е','о','ь'
];

function normalizeText(value = '') {
  return String(value)
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[–—]/g, '-')
    .replace(/[^a-zа-я0-9\s-]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemToken(value) {
  let token = normalizeText(value);
  if (token.length < 5 || /[a-z]/i.test(token)) return token;
  for (const suffix of RU_SUFFIXES) {
    if (token.length - suffix.length >= 4 && token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }
  return token;
}

function tokenSet(value) {
  const tokens = normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    .map(stemToken)
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

function itemText(item = {}) {
  const slides = Array.isArray(item?.slides)
    ? item.slides.flatMap((slide) => [slide?.title, slide?.body])
    : [];
  return [item?.title, item?.description, item?.body, ...slides].filter(Boolean).join(' ');
}

function intersectionSize(a, b) {
  let count = 0;
  for (const value of a) if (b.has(value)) count += 1;
  return count;
}

function similarity(a, b) {
  if (!a.size || !b.size) return { shared: 0, containment: 0, jaccard: 0 };
  const shared = intersectionSize(a, b);
  const containment = shared / Math.min(a.size, b.size);
  const union = a.size + b.size - shared;
  return { shared, containment, jaccard: union ? shared / union : 0 };
}

function historyEntries(history = {}) {
  const entries = [];
  for (const item of Array.isArray(history.generatedHistory) ? history.generatedHistory : []) {
    if (!item) continue;
    entries.push({
      dateKey: item.dateKey || null,
      kind: item.kind || null,
      title: String(item.title || '').trim(),
      text: itemText(item),
      source: 'generatedHistory',
    });
  }
  for (const entry of Array.isArray(history.recentTelegram) ? history.recentTelegram : []) {
    const text = String(entry?.text || '').trim();
    if (!text) continue;
    entries.push({
      dateKey: entry?.datetime || null,
      kind: null,
      title: text.split(/\n+/)[0].slice(0, 180),
      text,
      source: 'recentTelegram',
    });
  }
  for (const entry of Array.isArray(history.legacyPublicationIndex) ? history.legacyPublicationIndex : []) {
    const text = typeof entry === 'string'
      ? entry
      : [entry?.title, entry?.description, entry?.body, entry?.text].filter(Boolean).join(' ');
    if (!String(text || '').trim()) continue;
    entries.push({
      dateKey: entry?.dateKey || entry?.date || null,
      kind: entry?.kind || null,
      title: String(entry?.title || text).split(/\n+/)[0].slice(0, 180),
      text: String(text),
      source: 'legacyPublicationIndex',
    });
  }
  return entries;
}

export function findContentDuplicate(candidate, history = {}) {
  const candidateTitle = normalizeText(candidate?.title);
  if (!candidateTitle) return null;

  const candidateTitleTokens = tokenSet(candidateTitle);
  const candidateFullTokens = tokenSet(itemText(candidate));
  const events = candidate?.kind === 'events';

  for (const entry of historyEntries(history)) {
    const entryTitle = normalizeText(entry.title);
    if (!entryTitle) continue;

    if (entryTitle === candidateTitle) {
      return { reason: 'same-title', matched: entry };
    }

    const titleScore = similarity(candidateTitleTokens, tokenSet(entryTitle));
    if (titleScore.shared >= 2 && titleScore.containment >= (events ? 0.78 : 0.60)) {
      return { reason: 'similar-title', matched: entry, score: titleScore };
    }

    if (events) continue;

    const entryFullTokens = tokenSet(entry.text);
    const titleInOld = similarity(candidateTitleTokens, entryFullTokens);
    if (candidateTitleTokens.size >= 3 && titleInOld.shared >= 3 && titleInOld.shared / candidateTitleTokens.size >= 0.72) {
      return { reason: 'title-repeats-old-topic', matched: entry, score: titleInOld };
    }

    const fullScore = similarity(candidateFullTokens, entryFullTokens);
    if (
      (fullScore.shared >= 6 && fullScore.containment >= 0.48)
      || (fullScore.shared >= 8 && fullScore.jaccard >= 0.28)
    ) {
      return { reason: 'similar-content', matched: entry, score: fullScore };
    }
  }

  return null;
}

export function assertContentNotDuplicate(candidate, history = {}) {
  const duplicate = findContentDuplicate(candidate, history);
  if (!duplicate) return candidate;
  const matchedTitle = duplicate.matched?.title || 'previous material';
  const matchedDate = duplicate.matched?.dateKey ? ` (${duplicate.matched.dateKey})` : '';
  throw new Error(`Generated topic duplicates earlier content: ${matchedTitle}${matchedDate}; reason=${duplicate.reason}`);
}
