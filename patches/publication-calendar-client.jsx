'use client';

import React, { useEffect, useState } from 'react';

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

function configureTelegramWebApp() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return false;

  webApp.ready();
  webApp.expand();
  if (typeof webApp.disableVerticalSwipes === 'function') {
    webApp.disableVerticalSwipes();
  }
  return true;
}

function CalendarDay({ item, onOpen, isToday }) {
  const title = item.preparedTitle || item.label;
  const className = [
    'publication-calendar__day',
    item.scheduled ? 'publication-calendar__day--scheduled publication-calendar__day-button' : '',
    isToday ? 'publication-calendar__day--today' : '',
  ].filter(Boolean).join(' ');

  const content = (
    <>
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
          <span className="publication-calendar__open-hint">Открыть пост</span>
        </div>
      ) : (
        <span className="publication-calendar__empty">Без публикации</span>
      )}
    </>
  );

  if (!item.scheduled) {
    return (
      <article className={className} data-date={item.dateKey} aria-current={isToday ? 'date' : undefined}>
        {content}
      </article>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-date={item.dateKey}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => onOpen(item)}
      aria-label={`Открыть пост на ${displayDate(item)}`}
    >
      {content}
    </button>
  );
}

function PostPreviewDialog({ item, onClose }) {
  const preparedContent = item.preparedContent;
  const dialogTitleId = `publication-preview-title-${item.dateKey}`;

  return (
    <div className="publication-calendar__modal" onMouseDown={onClose}>
      <div
        className="publication-calendar__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="publication-calendar__dialog-handle" aria-hidden="true" />
        <div className="publication-calendar__dialog-header">
          <div>
            <span className={`publication-calendar__kind publication-calendar__kind--${item.kind}`}>
              {item.label}
            </span>
            <p>{displayDate(item)} · {item.time}</p>
          </div>
          <button
            type="button"
            className="publication-calendar__close"
            onClick={onClose}
            aria-label="Закрыть пост"
            autoFocus
          >
            ×
          </button>
        </div>

        {preparedContent ? (
          <div className="publication-calendar__preview">
            <h3 id={dialogTitleId}>{preparedContent.title}</h3>
            {preparedContent.format === 'text' ? (
              <div className="publication-calendar__post-body">{preparedContent.body}</div>
            ) : (
              <>
                {preparedContent.description ? (
                  <p className="publication-calendar__description">{preparedContent.description}</p>
                ) : null}
                <div className="publication-calendar__slides">
                  {preparedContent.slides.map((slide, index) => (
                    <section className="publication-calendar__slide" key={`${item.dateKey}-${index}`}>
                      <span>Слайд {index + 1}</span>
                      <h4>{slide.title}</h4>
                      <p>{slide.body}</p>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="publication-calendar__not-ready">
            <h3 id={dialogTitleId}>Пост ещё не подготовлен</h3>
            <p>
              На эту дату публикация запланирована, но готового текста пока нет.
              Он появится здесь после утренней подготовки поста в день публикации.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicationCalendarClient({ items, next }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const leadingBlanks = items.length ? mondayIndex(items[0].weekday) : 0;
  const todayKey = items[0]?.dateKey;

  useEffect(() => {
    if (configureTelegramWebApp()) return undefined;

    const existingScript = document.querySelector('script[data-telegram-web-app]');
    const script = existingScript || document.createElement('script');
    const onLoad = () => configureTelegramWebApp();

    script.addEventListener('load', onLoad);
    if (!existingScript) {
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      script.dataset.telegramWebApp = 'true';
      document.head.appendChild(script);
    }

    return () => script.removeEventListener('load', onLoad);
  }, []);

  useEffect(() => {
    if (!selectedItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedItem]);

  return (
    <section className="publication-calendar" aria-labelledby="publication-calendar-title">
      <div className="publication-calendar__inner">
        <div className="publication-calendar__intro">
          <div>
            <span className="publication-calendar__eyebrow">Контент-план</span>
            <h2 id="publication-calendar-title">Календарь публикаций</h2>
            <p>План на 30 дней. Нажмите на публикацию, чтобы открыть готовый пост.</p>
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
          {items.map((item) => (
            <CalendarDay
              key={item.dateKey}
              item={item}
              isToday={item.dateKey === todayKey}
              onOpen={() => setSelectedItem(item)}
            />
          ))}
        </div>

        <div className="publication-calendar__legend">
          <span><i className="publication-calendar__dot publication-calendar__dot--practical" />Среда · Прикладной пост</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--team" />Пятница · Работа команды</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--beginner" />Воскресенье · Для новичков</span>
          <span><i className="publication-calendar__dot publication-calendar__dot--events" />Вторая суббота · События</span>
        </div>
      </div>

      {selectedItem ? (
        <PostPreviewDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </section>
  );
}
