'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';

const scenarios = [
  'Planuję weekend w Krakowie. Sprawdź pogodę, znajdź ciekawe miejsca w Wikipedii, i powiedz czy są jakieś święta w ten weekend',
  'Mam 5000 EUR do wydania. Przelicz na PLN, sprawdź ile to w dolarach, i zapisz wszystkie kursy w notatkach',
  'Porównaj pogodę w Warszawie, Berlinie i Paryżu. Który z tych miast ma dziś najlepszą pogodę?',
  'Ile dni do następnego święta w Polsce? Jaka będzie wtedy pogoda?',
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

type ReactSection = {
  body: string;
  kind: 'thought' | 'observation' | 'result' | 'text';
  title: string;
};

function messageText(parts: MessagePart[]) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function splitCitation(text: string) {
  const lines = text.split('\n');
  const citationIndex = lines.findIndex((line) => /^📎\s*Źródł[ao]:/.test(line.trim()));

  if (citationIndex < 0) {
    return { body: text, citation: '' };
  }

  return {
    body: lines.slice(0, citationIndex).join('\n').trim(),
    citation: lines.slice(citationIndex).join(' ').trim(),
  };
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

function getToolName(type: string) {
  return type.replace(/^tool-/, '');
}

function toolEmoji(toolName: string) {
  const emoji: Record<string, string> = {
    calculator: '🧮',
    currentDateTime: '🕐',
    getWeather: '🌦️',
    getExchangeRate: '💱',
    getHolidays: '📅',
    searchKnowledge: '📚',
    searchWikipedia: '📚',
    readWebPage: '📄',
    saveNote: '💾',
    getNotes: '🗒️',
  };

  return emoji[toolName] ?? '⚡';
}

function formatValue(value: unknown) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.length > 180 ? `${value.slice(0, 180)}...` : value;
  }

  const json = JSON.stringify(value);
  return json.length > 180 ? `${json.slice(0, 180)}...` : json;
}

function toolParts(parts: MessagePart[]) {
  return parts.filter((part) => part.type.startsWith('tool-'));
}

function parseReactSections(text: string): ReactSection[] {
  const sections: ReactSection[] = [];
  const headingPattern =
    /###\s*(🧠\s*Myślę\.\.\.|👁️\s*Obserwuję\.\.\.|✅\s*Wynik końcowy)/g;
  const matches = [...text.matchAll(headingPattern)];

  if (matches.length === 0) {
    return text.trim()
      ? [{ title: 'Odpowiedź', kind: 'text', body: text.trim() }]
      : [];
  }

  const intro = text.slice(0, matches[0].index).trim();
  if (intro) {
    sections.push({ title: 'Odpowiedź', kind: 'text', body: intro });
  }

  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const title = match[1];
    const kind = title.includes('Myślę')
      ? 'thought'
      : title.includes('Obserwuję')
        ? 'observation'
        : 'result';

    sections.push({
      title,
      kind,
      body: text.slice(start, end).trim(),
    });
  });

  return sections;
}

function renderInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function SectionBody({ body }: { body: string }) {
  const lines = body.split('\n').filter((line) => line.trim());

  return (
    <div className="react-section-body">
      {lines.map((line, index) => (
        <p
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(line) }}
          key={`${line}-${index}`}
        />
      ))}
    </div>
  );
}

export default function ReactPage() {
  const [input, setInput] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/react' }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;

  const currentStep = useMemo(() => {
    const lastAssistant = messages.findLast(
      (message) => message.role === 'assistant',
    );

    if (!lastAssistant) {
      return 0;
    }

    const textSteps = parseReactSections(messageText(lastAssistant.parts)).filter(
      (section) => section.kind === 'thought',
    ).length;
    const toolsUsed = toolParts(lastAssistant.parts as MessagePart[]).length;

    return Math.min(5, Math.max(textSteps, toolsUsed, isLoading ? 1 : 0));
  }, [isLoading, messages]);

  useEffect(() => {
    const prompt = new URLSearchParams(window.location.search).get('prompt');

    if (prompt) {
      setInput(prompt);
    }
  }, []);

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
    <main className="chat-shell react-shell">
      <section className="chat-panel agent-panel react-panel" aria-label="Agent ReAct">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🔄
          </div>
          <div>
            <h1>🔄 Agent ReAct — Autonomiczne rozumowanie</h1>
            <p className="agent-description">
              Opisz cel → agent sam planuje i realizuje
            </p>
            <div className="example-questions" aria-label="Scenariusze ReAct">
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

        <div className="react-progress" aria-label="Postęp">
          <div>
            Krok {currentStep || (isLoading ? 1 : 0)} z 5
          </div>
          <span>
            <i style={{ width: `${(Math.max(currentStep, isLoading ? 1 : 0) / 5) * 100}%` }} />
          </span>
        </div>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Opisz cel, a agent rozbije go na kroki i użyje narzędzi.</p>
            </div>
          ) : (
            messages.map((message) => {
              const parts = message.parts as MessagePart[];
              const text = messageText(parts);
              const { body, citation } = splitCitation(text);
              const sections = parseReactSections(body);
              const messageToolParts = toolParts(parts);
              const sources = sourceLinks(parts);

              return (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble react-message">
                    {message.role === 'assistant' && messageToolParts.length > 0 ? (
                      <div className="react-tools" aria-label="Narzędzia">
                        <strong>⚡ Narzędzia</strong>
                        {messageToolParts.map((part, index) => {
                          const name = getToolName(part.type);

                          return (
                            <div className="tool-step react-tool-step" key={part.toolCallId ?? index}>
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
                                  <small>→ wykonuję...</small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {message.role === 'assistant' ? (
                      <div className="react-sections">
                        {sections.length > 0
                          ? sections.map((section, index) => (
                              <section
                                className={`react-section ${section.kind}`}
                                key={`${section.title}-${index}`}
                              >
                                <h2>{section.title}</h2>
                                <SectionBody body={section.body} />
                              </section>
                            ))
                          : 'Agent pracuje...'}
                      </div>
                    ) : (
                      body
                    )}

                    {citation ? <div className="source-note">{citation}</div> : null}

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
                  </div>
                </article>
              );
            })
          )}

          {isLoading && messages.at(-1)?.role !== 'assistant' ? (
            <article className="message-row assistant">
              <div className="message-bubble thinking">Agent planuje pierwszy krok...</div>
            </article>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się pobrać odpowiedzi.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <DiagnosticsPanel
          durations={durations}
          isLoading={isLoading}
          maxSteps={8}
          messages={messages}
        />

        <form className="composer composer-separated" onSubmit={handleSubmit}>
          <input
            aria-label="Cel"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Opisz co chcesz osiągnąć..."
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
