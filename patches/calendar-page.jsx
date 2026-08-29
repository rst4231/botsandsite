import React from 'react';
import { getCache } from '@vercel/functions';
import LegacyPage from './legacy-page.jsx';
import {
  buildPublicationCalendar,
  nextPublication,
} from '../lib/publication-calendar.mjs';
import './publication-calendar.css';

export const dynamic = 'force-dynamic';

const cache = getCache({ namespace: 'traffic-news-v4' });
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function mondayIndex(weekday) {
  return weekday === 0 ? 6 : weekday - 1;
}

function displayDate(item) {
  return `${item.day} ${MONTHS[item.month - 1]}`;
}

async function addPreparedTitles(items) {
  const scheduled = items.filter((item) => item.scheduled);
  const pairs = await Promise.all(scheduled.map(async (item) => {
    try {
      const prepared = await cache.get(`prepared-content:${item.dateKey}`);
      return [item.dateKey, prepared?.title ? String(prepared.title) : null];
    } catch (error) {
      console.error('PUBLICATION_CALENDAR_PREPARED_READ_ERROR', item.dateKey, error);
      return [item.dateKey, null];
    }
  }));
  const titles = new Map(pairs);
  return items.map((item) => ({
    ...item,
    preparedTitle: titles.get(item.dateKey) || null,
  }));
}

function CalendarDay({ item }) {
  const title = item.preparedTitle || item.label;
  return (
    <article
      className={`publication-calendar__day ${item.scheduled ? 'publication-calendar__day--scheduled' : ''}`}
      data-date={item.dateKey}
    >
      <div className="publication-calendar__date-line">
        <span className="publication-calendar__date">{displayDate(item)}</span>
        <span className="publication-calendar__mobile-weekday">{WEEKDAYS[mondayIndex(item.weekday)]}</span>
      </div>
      {item.scheduled ? (
        <div className="publication-calendar__event">
          <span className={`publication-calendar__kind publication-calendar__kind--${item.kind}`}>
            {item.preparedTitle ? 'Подготовлено' : 'Запланировано'}
          </span>
          <strong>{title}</strong>
          <span className="publication-calendar__time">{item.time}</span>
        </div>
      ) : (
        <span className="publication-calendar__empty">Без публикации</span>
      )}
    </article>
  );
}

function PublicationCalendar({ items, next }) {
  const leadingBlanks = items.length ? mondayIndex(items[0].weekday) : 0;
  return (
    <section className="publication-calendar" aria-labelledby="publication-calendar-title">
      <div className="publication-calendar__inner">
        <div className="publication-calendar__intro">
          <div>
            <span className="publication-calendar__eyebrow">Контент-план</span>
            <h2 id="publication-calendar-title">Календарь публикаций на 30 дней</h2>
            <p>Показывает, что и когда выйдет в Telegram и VK. Время публикации указано по Москве.</p>
          </div>
          {next ? (
            <div className="publication-calendar__next">
              <span>Следующая публикация</span>
              <strong>{displayDate(next)} · {next.time}</strong>
              <p>{next.preparedTitle || next.label}</p>
            </div>
          ) : null}
        </div>

        <div className="publication-calendar__weekday-row" aria-hidden="true">
          {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="publication-calendar__grid">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div className="publication-calendar__blank" key={`blank-${index}`} aria-hidden="true" />
          ))}
          {items.map((item) => <CalendarDay key={item.dateKey} item={item} />)}
        </div>

        <div className="publication-calendar__legend">
          <span><i className="publication-calendar__dot publication-calendar__dot--practical" />Среда · Прикладной пост</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--team" />Пятница · Работа команды</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--beginner" />Воскресенье · Для новичков</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--events" />Вторая суббота · События</span>
        </div>
      </div>
    </section>
  );
}

export default async function Page() {
  const now = new Date();
  const items = await addPreparedTitles(buildPublicationCalendar(now, 30));
  const next = nextPublication(items, now);
  return (
    <>
      <LegacyPage />
      <PublicationCalendar items={items} next={next} />
    </>
  );
}
