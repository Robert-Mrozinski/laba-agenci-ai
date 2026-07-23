'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ReactElement } from 'react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

const scenarios = [
  'Planuję weekend w Berlinie. Budżet: 2000 PLN',
  'Lecę do Paryża na tydzień w sierpniu',
  'Wycieczka do Pragi z rodziną na 3 dni',
  'Podróż służbowa do Londynu w przyszłym tygodniu',
  'Porównaj Barcelonę i Lizbonę na wakacje',
];

const tools = [
  ['🌤️', 'Pogoda'],
  ['💶', 'Waluty'],
  ['📅', 'Święta'],
  ['🌐', 'Google Search'],
  ['✈️', 'Loty'],
  ['🥗', 'Jedzenie'],
  ['☕', 'Kawa'],
  ['📄', 'Czytanie stron'],
  ['🧮', 'Kalkulator'],
  ['💾', 'Notatki'],
];

type MessagePart = {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  sourceId?: string;
  state?: string;
  text?: string;
  title?: string;
  toolCallId?: string;
  type: string;
  url?: string;
};

type TravelCard = {
  detail: string;
  emoji: string;
  kind: string;
  label: string;
  value: string;
};

function messageText(parts: MessagePart[]) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function sourceLinks(parts: MessagePart[]) {
  return parts.filter(
    (part): part is MessagePart & { url: string } =>
      part.type === 'source-url' && typeof part.url === 'string',
  );
}

function sourceLabel(source: MessagePart & { url: string }) {
  if (source.title) {
    return source.title;
  }

  try {
    return new URL(source.url).hostname;
  } catch {
    return source.url;
  }
}

function toolParts(parts: MessagePart[]) {
  return parts.filter((part) => part.type.startsWith('tool-'));
}

function getToolName(type: string) {
  return type.replace(/^tool-/, '');
}

function toolEmoji(toolName: string) {
  const emoji: Record<string, string> = {
    calculator: '🧮',
    currentDateTime: '🕐',
    getWeather: '🌤️',
    getExchangeRate: '💶',
    getHolidays: '📅',
    searchWikipedia: '📖',
    readWebPage: '📄',
    saveNote: '💾',
    getNotes: '🗒️',
    google_search: '🌐',
  };

  return emoji[toolName] ?? '⚡';
}

function formatValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.length > 150 ? `${value.slice(0, 150)}...` : value;
  }

  const json = JSON.stringify(value);
  return json.length > 150 ? `${json.slice(0, 150)}...` : json;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function travelCards(parts: MessagePart[]): TravelCard[] {
  return toolParts(parts)
    .filter((part) => part.state === 'output-available')
    .flatMap((part): TravelCard[] => {
      const name = getToolName(part.type);
      const output = asRecord(part.output);

      if (!output) {
        return [];
      }

      if (name === 'getWeather') {
        const current = asRecord(output.current);
        const temperature = current?.temperature_2m;
        const wind = current?.wind_speed_10m;
        const city = String(output.city ?? 'Destynacja');
        const country = String(output.country ?? '');

        return [
          {
            kind: 'weather',
            emoji: '🌤️',
            label: `${city}${country ? `, ${country}` : ''}`,
            value:
              typeof temperature === 'number'
                ? `${Math.round(temperature)}°C`
                : 'Pogoda',
            detail:
              typeof wind === 'number'
                ? `Wiatr ${Math.round(wind)} km/h • Open-Meteo`
                : 'Dane z Open-Meteo',
          },
        ];
      }

      if (name === 'getExchangeRate') {
        const rate = output.rate;
        const base = String(output.base ?? '');

        return [
          {
            kind: 'currency',
            emoji: '💶',
            label: base ? `Waluta ${base}` : 'Waluta',
            value:
              typeof rate === 'number'
                ? `1 ${base} = ${rate.toFixed(2)} PLN`
                : 'Kurs waluty',
            detail: `Frankfurter${output.date ? ` • ${output.date}` : ''}`,
          },
        ];
      }

      if (name === 'getHolidays') {
        const holidays = Array.isArray(output.holidays) ? output.holidays : [];
        const firstHoliday = asRecord(holidays[0]);

        return [
          {
            kind: 'holidays',
            emoji: '📅',
            label: `Święta ${String(output.countryCode ?? '')}`,
            value: `${holidays.length} w roku ${String(output.year ?? '')}`,
            detail: firstHoliday
              ? `${String(firstHoliday.date)} • ${String(firstHoliday.localName)}`
              : 'Brak danych o najbliższym święcie',
          },
        ];
      }

      if (name === 'searchWikipedia') {
        return [
          {
            kind: 'attractions',
            emoji: '🏛️',
            label: String(output.title ?? output.query ?? 'Atrakcje'),
            value: 'Wikipedia',
            detail:
              typeof output.extract === 'string'
                ? output.extract.slice(0, 130)
                : 'Informacje o miejscu',
          },
        ];
      }

      if (name === 'google_search') {
        const input = asRecord(part.input);
        const query = String(input?.query ?? input?.searchQuery ?? '').toLowerCase();

        if (
          query.includes('flight') ||
          query.includes('flights') ||
          query.includes('loty') ||
          query.includes('bilety lotnicze')
        ) {
          return [
            {
              kind: 'flights',
              emoji: '✈️',
              label: 'Loty',
              value: 'Zestawienie połączeń',
              detail: 'Wyniki wyszukiwania z Google',
            },
          ];
        }

        if (query.includes('speciality coffee') || query.includes('specialty coffee')) {
          return [
            {
              kind: 'coffee',
              emoji: '☕',
              label: 'Kawa',
              value: 'Top 5 speciality coffee',
              detail: 'Najlepiej oceniane miejsca z Google',
            },
          ];
        }

        if (
          query.includes('healthy food') ||
          query.includes('healthy restaurant') ||
          query.includes('zdrowe')
        ) {
          return [
            {
              kind: 'food',
              emoji: '🥗',
              label: 'Jedzenie',
              value: 'Top 5 healthy food',
              detail: 'Najlepiej oceniane restauracje z Google',
            },
          ];
        }
      }

      return [];
    });
}

function fallbackTravelCards(text: string): TravelCard[] {
  if (!text.trim()) {
    return [];
  }

  const cards: TravelCard[] = [];
  const destinationMatch =
    text.match(/Plan podróży:\s*([^\n]+)/i) ??
    text.match(/Porównanie:\s*([^\n]+)/i);
  const temperatureMatch = text.match(/(-?\d{1,2})\s*°C/);
  const currencyMatch = text.match(/1\s+([A-Z]{3})\s*=\s*([\d.,]+)\s*PLN/i);
  const holidayMatch = text.match(
    /(\d{1,2}\s+[a-ząćęłńóśźż]+\s*(?:\d{4})?)\s*[–-]\s*([^.\n|]+)/i,
  );
  const attractionMatch = text.match(
    /(Sagrada Familia|Alfama|Zamek São Jorge|Prado|Luwr|Brama Brandenburska|Most Karola|Wawel|Koloseum|Gaud[ií]|Sintra)/i,
  );

  cards.push({
    kind: 'summary',
    emoji: '🗺️',
    label: 'Plan podróży',
    value: destinationMatch?.[1]?.trim() ?? 'Gotowy plan',
    detail: 'Podsumowanie z odpowiedzi asystenta',
  });

  if (temperatureMatch) {
    cards.push({
      kind: 'weather',
      emoji: '🌤️',
      label: 'Pogoda',
      value: `${temperatureMatch[1]}°C`,
      detail: 'Temperatura wykryta w planie podróży',
    });
  }

  if (currencyMatch) {
    cards.push({
      kind: 'currency',
      emoji: '💶',
      label: `Waluta ${currencyMatch[1].toUpperCase()}`,
      value: `1 ${currencyMatch[1].toUpperCase()} = ${currencyMatch[2]} PLN`,
      detail: 'Kurs wykryty w odpowiedzi asystenta',
    });
  }

  if (holidayMatch) {
    cards.push({
      kind: 'holidays',
      emoji: '📅',
      label: 'Ważna data',
      value: holidayMatch[1].trim(),
      detail: holidayMatch[2].trim(),
    });
  }

  cards.push({
    kind: 'attractions',
    emoji: '🏛️',
    label: 'Atrakcje',
    value: attractionMatch?.[1] ?? 'Miejsca do zobaczenia',
    detail: 'Najważniejsze punkty z planu podróży',
  });

  if (/###\s*🥗?\s*Jedzenie|healthy food|zdrowe restauracje/i.test(text)) {
    cards.push({
      kind: 'food',
      emoji: '🥗',
      label: 'Jedzenie',
      value: 'Top 5 healthy food',
      detail: 'Restauracje z planu podróży',
    });
  }

  if (/###\s*☕?\s*Kawa|speciality coffee|specialty coffee/i.test(text)) {
    cards.push({
      kind: 'coffee',
      emoji: '☕',
      label: 'Kawa',
      value: 'Top 5 speciality coffee',
      detail: 'Kawiarnie z planu podróży',
    });
  }

  if (/###\s*✈️?\s*Loty|bilety lotnicze|połączenia lotnicze|flights/i.test(text)) {
    cards.push({
      kind: 'flights',
      emoji: '✈️',
      label: 'Loty',
      value: 'Zestawienie połączeń',
      detail: 'Loty z planu podróży',
    });
  }

  return cards.slice(0, 6);
}

function renderInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function PlanMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const rows: ReactElement[] = [];
  let tableLines: string[] = [];

  function flushTable(key: string) {
    if (tableLines.length === 0) {
      return;
    }

    const parsedRows = tableLines
      .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim()))
      .map((line) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim()),
      )
      .filter((cells) => cells.some(Boolean));

    if (parsedRows.length > 0) {
      const [head, ...body] = parsedRows;
      rows.push(
        <div className="travel-table-wrap" key={key}>
          <table className="markdown-table travel-comparison-table">
            <thead>
              <tr>
                {head.map((cell, index) => (
                  <th
                    dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cell) }}
                    key={`${key}-head-${index}`}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((bodyRow, rowIndex) => (
                <tr key={`${key}-row-${rowIndex}`}>
                  {bodyRow.map((cell, cellIndex) => (
                    <td
                      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cell) }}
                      key={`${key}-cell-${rowIndex}-${cellIndex}`}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }

    tableLines = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushTable(`table-${index}`);
      return;
    }

    if (trimmed.startsWith('|')) {
      tableLines.push(trimmed);
      return;
    }

    flushTable(`table-${index}`);

    if (trimmed.startsWith('## ')) {
      rows.push(<h2 key={index}>{trimmed.replace(/^##\s+/, '')}</h2>);
      return;
    }

    if (trimmed.startsWith('### ')) {
      rows.push(<h3 key={index}>{trimmed.replace(/^###\s+/, '')}</h3>);
      return;
    }

    const cleanLine = trimmed.replace(/^[-*]\s+/, '');
    rows.push(
      <p
        dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(cleanLine) }}
        key={index}
      />,
    );
  });

  flushTable('table-final');

  return <div className="travel-plan">{rows}</div>;
}

export default function TravelPage() {
  const [input, setInput] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/travel' }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!startedAt || isLoading) {
      return;
    }

    const lastAssistant = messages.findLast(
      (message) => message.role === 'assistant',
    );

    if (lastAssistant && !durations[lastAssistant.id]) {
      setDurations((currentDurations) => ({
        ...currentDurations,
        [lastAssistant.id]: (Date.now() - startedAt) / 1000,
      }));
      setStartedAt(null);
    }
  }, [durations, isLoading, messages, startedAt]);

  async function send(text: string) {
    const trimmedText = text.trim();

    if (!trimmedText || isLoading) {
      return;
    }

    setInput('');
    setStartedAt(Date.now());
    clearError();
    await sendMessage({ text: trimmedText });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  return (
    <main className="chat-shell travel-shell">
      <section className="chat-panel agent-panel travel-panel" aria-label="Asystent podróży">
        <header className="chat-header travel-header">
          <div className="bot-mark" aria-hidden="true">
            ✈️
          </div>
          <div>
            <h1>✈️ Asystent podróży AI</h1>
            <p className="agent-description">
              {tools.length} narzędzi • powiedz dokąd jedziesz — agent zaplanuje wszystko
            </p>
            <div className="agent-tools travel-agent-tools" aria-label="Narzędzia podróży">
              {tools.map(([emoji, label]) => (
                <span key={label}>
                  {emoji} {label} <strong>✅ aktywny</strong>
                </span>
              ))}
            </div>
            <div className="example-questions" aria-label="Scenariusze podróży">
              {scenarios.map((scenario) => (
                <button
                  disabled={isLoading}
                  key={scenario}
                  onClick={() => send(scenario)}
                  type="button"
                >
                  {scenario}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Podaj cel podróży, daty albo budżet. Agent zbierze dane i ułoży plan.</p>
            </div>
          ) : (
            messages.map((message) => {
              const parts = message.parts as MessagePart[];
              const cards = travelCards(parts);
              const tools = toolParts(parts);
              const sources = sourceLinks(parts);
              const text = messageText(parts);
              const displayCards =
                message.role === 'assistant' && cards.length === 0
                  ? fallbackTravelCards(text)
                  : cards;

              return (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble travel-message">
                    {message.role === 'assistant' && displayCards.length > 0 ? (
                      <div className="travel-cards" aria-label="Dane podróży">
                        {displayCards.map((card, index) => (
                          <section className={`travel-card ${card.kind}`} key={`${card.kind}-${index}`}>
                            <span>{card.emoji}</span>
                            <div>
                              <h2>{card.label}</h2>
                              <strong>{card.value}</strong>
                              <p>{card.detail}</p>
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' && tools.length > 0 ? (
                      <div className="tool-timeline travel-tools" aria-label="Użyte narzędzia">
                        <strong>✈️ Asystent zbiera dane...</strong>
                        {tools.map((part, index) => {
                          const name = getToolName(part.type);

                          return (
                            <div className="tool-step" key={part.toolCallId ?? index}>
                              <span>{index + 1}</span>
                              <div>
                                <b>
                                  {toolEmoji(name)} {name}
                                </b>
                                <small>{formatValue(part.input)}</small>
                                {part.state === 'output-available' ? (
                                  <small>→ {formatValue(part.output)}</small>
                                ) : part.state === 'output-error' ? (
                                  <small>→ {part.errorText}</small>
                                ) : (
                                  <small>→ sprawdzam...</small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {message.role === 'assistant' ? (
                      text ? <PlanMarkdown text={text} /> : 'Planowanie podróży...'
                    ) : (
                      text
                    )}

                    {sources.length > 0 ? (
                      <div className="source-links" aria-label="Źródła">
                        {sources.map((source) => (
                          <a
                            href={source.url}
                            key={source.sourceId ?? source.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {sourceLabel(source)}
                          </a>
                        ))}
                      </div>
                    ) : null}

                    {message.role === 'assistant' ? (
                      <div className="tool-summary">
                        Użyto {tools.length} narzędzi |{' '}
                        {(durations[message.id] ?? 0).toFixed(1)}s | Model:
                        gemini-3.1-flash-lite
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}

          {isLoading && messages.at(-1)?.role !== 'assistant' ? (
            <article className="message-row assistant">
              <div className="message-bubble thinking">Asystent sprawdza dane podróży...</div>
            </article>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się zaplanować podróży.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <DiagnosticsPanel
          durations={durations}
          isLoading={isLoading}
          maxSteps={7}
          messages={messages}
        />

        <form className="composer composer-separated" onSubmit={handleSubmit}>
          <input
            aria-label="Opis podróży"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Np. Lecę do Barcelony na weekend..."
            value={input}
          />
          <button disabled={isLoading || !input.trim()} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
