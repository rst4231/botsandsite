import React from 'react';
import { getCache } from '@vercel/functions';
import LegacyPage from './legacy-page.jsx';
import PublicationCalendarClient from './publication-calendar-client.jsx';
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
      const prepared = await cache.get(`prepared-content:${item.dateKey}`);
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

export default async function Page() {
  const now = new Date();
  const items = await addPreparedContent(buildPublicationCalendar(now, 30));
  const next = nextPublication(items, now);
  return (
    <>
      <LegacyPage />
      <PublicationCalendarClient items={items} next={next} />
    </>
  );
}
