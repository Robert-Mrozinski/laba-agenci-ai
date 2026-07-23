'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

const examples = [
  'Rynek AI w Polsce — trendy, firmy, prognozy na 2026',
  'Porównanie platform e-commerce: Shopify vs WooCommerce vs PrestaShop',
  'Wpływ pracy zdalnej na produktywność — badania i statystyki',
  'Rynek nieruchomości w Krakowie — ceny, trendy, prognozy',
];

type MessagePart = {
  sourceId?: string;
  text?: string;
  title?: string;
  type: string;
  url?: string;
};

type SavedReport = {
  content: string;
  created_at: string;
  id: string;
  sources: Array<{ title?: string; url: string }>;
  storage: 'documents' | 'reports';
  title: string;
  topic: string;
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

function sourceLabel(source: { title?: string; url: string }) {
  if (source.title) {
    return source.title;
  }

  try {
    return new URL(source.url).hostname;
  } catch {
    return source.url;
  }
}

function renderInline(text: string) {
  const chunks = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);

  return chunks.map((chunk, index) => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={index}>{chunk.slice(2, -2)}</strong>;
    }

    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      return <code key={index}>{chunk.slice(1, -1)}</code>;
    }

    const link = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a href={link[2]} key={index} rel="noreferrer" target="_blank">
          {link[1]}
        </a>
      );
    }

    return <span key={index}>{chunk}</span>;
  });
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  const output: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.includes('|')) {
      const tableLines: string[] = [];

      while (index < lines.length && lines[index].includes('|')) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      const rows = tableLines
        .filter((row) => !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(row))
        .map((row) =>
          row
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim()),
        );

      if (rows.length > 0) {
        const [head, ...body] = rows;

        output.push(
          <div className="report-table-wrap" key={`table-${index}`}>
            <table className="report-table">
              <thead>
                <tr>
                  {head.map((cell, cellIndex) => (
                    <th key={cellIndex}>{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }

      continue;
    }

    if (line.startsWith('# ')) {
      output.push(<h1 key={index}>{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      output.push(<h2 key={index}>{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      output.push(<h3 key={index}>{renderInline(line.slice(4))}</h3>);
    } else if (line.startsWith('> ')) {
      output.push(<blockquote key={index}>{renderInline(line.slice(2))}</blockquote>);
    } else if (/^\d+\.\s+/.test(line)) {
      output.push(
        <p className="report-list-item" key={index}>
          {renderInline(line)}
        </p>,
      );
    } else if (line.startsWith('- ')) {
      output.push(
        <p className="report-list-item" key={index}>
          {renderInline(`• ${line.slice(2)}`)}
        </p>,
      );
    } else {
      output.push(<p key={index}>{renderInline(line)}</p>);
    }

    index += 1;
  }

  return output;
}

export default function ReportPage() {
  const { session } = useAuth();
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastTopic, setLastTopic] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [savedReportsError, setSavedReportsError] = useState('');
  const [savedReportsLoading, setSavedReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/report' }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === 'submitted' || status === 'streaming';
  const lastAssistant = messages.findLast((message) => message.role === 'assistant');
  const reportText = lastAssistant ? messageText(lastAssistant.parts as MessagePart[]) : '';
  const reportSources = lastAssistant
    ? sourceLinks(lastAssistant.parts as MessagePart[])
    : [];
  const activeReportText = selectedReport?.content ?? reportText;
  const activeReportSources = selectedReport?.sources ?? reportSources;
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 260)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!session?.access_token) {
      setSavedReports([]);
      return;
    }

    void loadSavedReports();
  }, [session?.access_token]);

  async function loadSavedReports() {
    if (!session?.access_token) {
      setSavedReportsError('Musisz się zalogować, żeby zobaczyć zapisane raporty.');
      return;
    }

    setSavedReportsLoading(true);
    setSavedReportsError('');

    try {
      const response = await fetch('/api/reports', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data: { error?: string; reports?: SavedReport[] } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się wczytać raportów.');
      }

      setSavedReports(data.reports ?? []);
    } catch (loadError) {
      setSavedReportsError(
        loadError instanceof Error
          ? loadError.message
          : 'Nie udało się wczytać raportów.',
      );
    } finally {
      setSavedReportsLoading(false);
    }
  }

  async function generateReport(topic: string) {
    const trimmedTopic = topic.trim();

    if (!trimmedTopic || isLoading) {
      return;
    }

    setInput('');
    setCopied(false);
    setLastTopic(trimmedTopic);
    setSelectedReport(null);
    setSaveError('');
    setSaveNotice('');
    clearError();
    await sendMessage({ text: trimmedTopic });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateReport(input);
  }

  async function copyReport() {
    if (!activeReportText) {
      return;
    }

    await navigator.clipboard.writeText(activeReportText);
    setCopied(true);
  }

  async function saveReport() {
    if (!reportText || isSaving) {
      return;
    }

    if (!session?.access_token) {
      setSaveError('Musisz się zalogować, żeby zapisać raport w bazie.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveNotice('');

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: reportText,
          sources: reportSources.map((source) => ({
            title: sourceLabel(source),
            url: source.url,
          })),
          topic: lastTopic || 'Raport',
        }),
      });

      const data: {
        error?: string;
        fallback?: string;
        saved?: boolean;
        storage?: string;
      } = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.error || 'Nie udało się zapisać raportu.');
      }

      setSaveNotice(
        data.fallback === 'documents'
          ? 'Raport zapisany w bazie wiedzy.'
          : 'Raport zapisany w bazie.',
      );
      await loadSavedReports();
    } catch (saveReportError) {
      setSaveError(
        saveReportError instanceof Error
          ? saveReportError.message
          : 'Nie udało się zapisać raportu.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="chat-shell report-shell">
      <section className="chat-panel agent-panel report-panel" aria-label="Generator raportów">
        <header className="chat-header report-header">
          <div className="bot-mark" aria-hidden="true">
            📊
          </div>
          <div>
            <h1>📊 Generator raportów</h1>
            <p className="agent-description">
              Opisz temat — agent napisze raport biznesowy
            </p>
            <div className="example-questions report-examples" aria-label="Przykłady raportów">
              {examples.map((example) => (
                <button
                  disabled={isLoading}
                  key={example}
                  onClick={() => generateReport(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </header>

        <form className="report-form" onSubmit={handleSubmit}>
          <input
            aria-label="Temat raportu"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Np. Rynek AI w Polsce w 2026 roku..."
            value={input}
          />
          <button disabled={isLoading || !input.trim()} type="submit">
            {isLoading ? 'Generuję...' : '📊 Generuj raport'}
          </button>
        </form>

        <section className="report-results" aria-live="polite">
          <section className="saved-reports-panel" aria-label="Zapisane raporty">
            <div className="saved-reports-head">
              <div>
                <h2>Zapisane raporty</h2>
                <p>
                  {savedReports.length > 0
                    ? `${savedReports.length} zapisanych raportów`
                    : 'Brak zapisanych raportów'}
                </p>
              </div>
              <button
                disabled={savedReportsLoading}
                onClick={loadSavedReports}
                type="button"
              >
                {savedReportsLoading ? 'Odświeżam...' : 'Odśwież'}
              </button>
            </div>

            {savedReportsError ? (
              <div className="error-message report-save-message">{savedReportsError}</div>
            ) : null}

            {savedReports.length > 0 ? (
              <div className="saved-reports-list">
                {savedReports.map((report) => (
                  <button
                    className={selectedReport?.id === report.id ? 'active' : undefined}
                    key={report.id}
                    onClick={() => {
                      setCopied(false);
                      setSelectedReport(report);
                    }}
                    type="button"
                  >
                    <strong>{report.title}</strong>
                    <span>
                      {new Intl.DateTimeFormat('pl-PL', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(report.created_at))}
                      {' · '}
                      {report.storage === 'documents' ? 'baza wiedzy' : 'raporty'}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {!activeReportText && !isLoading ? (
            <div className="empty-state report-empty-state">
              <p>Podaj temat, a agent zbierze dane i ułoży raport z wnioskami.</p>
            </div>
          ) : null}

          {activeReportText ? (
            <>
              <div className="report-toolbar">
                <span>{selectedReport ? 'Zapisany raport' : 'Gotowy raport'}</span>
                <div>
                  <button onClick={copyReport} type="button">
                    {copied ? 'Skopiowano' : '📋 Kopiuj do schowka'}
                  </button>
                  {selectedReport ? (
                    <button onClick={() => setSelectedReport(null)} type="button">
                      Pokaż bieżący raport
                    </button>
                  ) : (
                    <button
                      disabled={isSaving}
                      onClick={saveReport}
                      type="button"
                    >
                      {isSaving ? 'Zapisuję...' : '💾 Zapisz w bazie'}
                    </button>
                  )}
                </div>
              </div>

              {saveNotice ? <div className="success-message report-save-message">{saveNotice}</div> : null}
              {saveError ? <div className="error-message report-save-message">{saveError}</div> : null}

              <article className="report-document">
                {renderMarkdown(activeReportText)}
                <div ref={bottomRef} />
              </article>

              {activeReportSources.length > 0 ? (
                <div className="source-links report-source-links" aria-label="Źródła">
                  {activeReportSources.map((source) => (
                    <a
                      href={source.url}
                      key={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.title ?? sourceLabel(source)}
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {isLoading && !reportText ? (
            <div className="message-bubble thinking report-thinking">
              Agent szuka źródeł i układa raport...
            </div>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się wygenerować raportu.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
