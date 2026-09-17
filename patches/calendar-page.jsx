import React from 'react';
import { getCache } from '@vercel/functions';
import { loadRuntimeContentIssue } from '../lib/runtime-content-issue.mjs';
import PublicationCalendarClient from './publication-calendar-client.jsx';
import { BOT_FUNCTIONS, BOT_FUNCTION_GROUPS } from './bot-functions.generated.js';
import {
  buildPublicationCalendar,
  calendarPreparedPreview,
  nextPublication,
} from '../lib/publication-calendar.mjs';
import './publication-calendar.css';

export const dynamic = 'force-dynamic';

const cache = getCache({ namespace: 'traffic-news-v4' });

async function addPreparedContent(items) {
  const scheduled = items.filter((item) => item.scheduled);
  const pairs = await Promise.all(scheduled.map(async (item) => {
    try {
      const cachedPrepared = await cache.get(`prepared-content:${item.dateKey}`);
      const durableFallback = cachedPrepared ? null : await loadRuntimeContentIssue(item.dateKey);
      const prepared = cachedPrepared || durableFallback?.item || null;
      return [item.dateKey, calendarPreparedPreview(prepared)];
    } catch (error) {
      console.error('PUBLICATION_CALENDAR_PREPARED_READ_ERROR', item.dateKey, error);
      return [item.dateKey, null];
    }
  }));
  const preparedByDate = new Map(pairs);
  return items.map((item) => {
    const preparedContent = preparedByDate.get(item.dateKey) || null;
    return {
      ...item,
      preparedTitle: preparedContent?.title || null,
      preparedContent,
    };
  });
}

function BotFunctions() {
  return (
    <details className="bot-functions">
      <summary className="bot-functions__toggle">
        <span>Функции</span>
        <span className="bot-functions__count">{BOT_FUNCTIONS.length}</span>
      </summary>
      <div className="bot-functions__panel">
        <div className="bot-functions__header">
          <strong>Все функции бота</strong>
          <span>Список обновляется автоматически вместе с функциями проекта.</span>
        </div>
        <div className="bot-functions__groups">
          {BOT_FUNCTION_GROUPS.map((group) => (
            <section className={`bot-functions__group bot-functions__group--${group.id}`} key={group.id}>
              <div className="bot-functions__group-header">
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span>{group.items.length}</span>
              </div>
              <div className="bot-functions__group-list">
                {group.items.map((item) => (
                  <div className="bot-functions__item" key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    {item.details?.length ? (
                      <ul className="bot-functions__details">
                        {item.details.map((detail) => <li key={detail}>{detail}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
}

export default async function Page() {
  const now = new Date();
  const items = await addPreparedContent(buildPublicationCalendar(now, 30));
  const next = nextPublication(items, now);
  return (
    <>
      <title>Помощник</title>
      <main className="publication-calendar-page">
        <BotFunctions />
        <PublicationCalendarClient items={items} next={next} />
      </main>
    </>
  );
}
