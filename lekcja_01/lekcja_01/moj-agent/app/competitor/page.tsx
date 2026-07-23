'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

const examples = [
  {
    companies: ['Shopify', 'WooCommerce', 'PrestaShop'],
    context: 'Szukam platformy e-commerce dla małego sklepu.',
  },
  {
    companies: ['Notion', 'Obsidian', 'Evernote'],
    context: 'Wybór narzędzia do firmowej bazy wiedzy i notatek.',
  },
  {
    companies: ['Vercel', 'Netlify', 'Railway'],
    context: 'Hosting aplikacji Next.js dla małego zespołu produktowego.',
  },
  {
    companies: ['ChatGPT', 'Claude', 'Gemini'],
    context: 'Porównanie asystentów AI do pracy biurowej i analizy dokumentów.',
  },
];

type MessagePart = {
  sourceId?: string;
  text?: string;
  title?: string;
  type: string;
  url?: string;
};

type SavedAnalysis = {
  companies: string[];
  content: string;
  context: string;
  created_at: string;
  id: string;
  sources: Array<{ title?: string; url: string }>;
  title: string;
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
          <div className="competitor-table-wrap" key={`table-${index}`}>
            <table className="competitor-table">
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
    } else if (line.startsWith('- ')) {
      output.push(
        <p className="competitor-list-item" key={index}>
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

export default function CompetitorPage() {
  const { session } = useAuth();
  const [companies, setCompanies] = useState(['', '', '']);
  const [context, setContext] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastCompanies, setLastCompanies] = useState<string[]>([]);
  const [lastContext, setLastContext] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [savedAnalysesError, setSavedAnalysesError] = useState('');
  const [savedAnalysesLoading, setSavedAnalysesLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/competitor' }),
    [],
  );
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });
  const isLoading = status === 'submitted' || status === 'streaming';
  const lastAssistant = messages.findLast((message) => message.role === 'assistant');
  const analysisText = lastAssistant
    ? messageText(lastAssistant.parts as MessagePart[])
    : '';
  const analysisSources = lastAssistant
    ? sourceLinks(lastAssistant.parts as MessagePart[])
    : [];
  const activeAnalysisText = selectedAnalysis?.content ?? analysisText;
  const activeAnalysisSources = selectedAnalysis?.sources ?? analysisSources;
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 260)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!session?.access_token) {
      setSavedAnalyses([]);
      return;
    }

    void loadSavedAnalyses();
  }, [session?.access_token]);

  async function loadSavedAnalyses() {
    if (!session?.access_token) {
      setSavedAnalysesError('Musisz się zalogować, żeby zobaczyć zapisane analizy.');
      return;
    }

    setSavedAnalysesLoading(true);
    setSavedAnalysesError('');

    try {
      const response = await fetch('/api/competitor-analyses', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data: { analyses?: SavedAnalysis[]; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się wczytać analiz.');
      }

      setSavedAnalyses(data.analyses ?? []);
    } catch (loadError) {
      setSavedAnalysesError(
        loadError instanceof Error
          ? loadError.message
          : 'Nie udało się wczytać analiz.',
      );
    } finally {
      setSavedAnalysesLoading(false);
    }
  }

  function updateCompany(index: number, value: string) {
    setCompanies((currentCompanies) =>
      currentCompanies.map((company, companyIndex) =>
        companyIndex === index ? value : company,
      ),
    );
  }

  async function compareCompanies(nextCompanies = companies, nextContext = context) {
    const trimmedCompanies = nextCompanies.map((company) => company.trim()).filter(Boolean);

    if (trimmedCompanies.length !== 3 || isLoading) {
      return;
    }

    setCopied(false);
    setLastCompanies(trimmedCompanies);
    setLastContext(nextContext.trim());
    setSaveError('');
    setSaveNotice('');
    setSelectedAnalysis(null);
    clearError();
    await sendMessage({
      text: [
        `Porównaj firmy: ${trimmedCompanies.join(' vs ')}.`,
        nextContext.trim() ? `Kontekst użytkownika: ${nextContext.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void compareCompanies();
  }

  function applyExample(example: (typeof examples)[number]) {
    setCompanies(example.companies);
    setContext(example.context);
  }

  async function copyAnalysis() {
    if (!activeAnalysisText) {
      return;
    }

    await navigator.clipboard.writeText(activeAnalysisText);
    setCopied(true);
  }

  async function saveAnalysis() {
    if (!analysisText || isSaving) {
      return;
    }

    if (!session?.access_token) {
      setSaveError('Musisz się zalogować, żeby zapisać analizę.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveNotice('');

    try {
      const response = await fetch('/api/competitor-analyses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companies: lastCompanies.length === 3 ? lastCompanies : companies,
          content: analysisText,
          context: lastContext || context,
          sources: analysisSources.map((source) => ({
            title: sourceLabel(source),
            url: source.url,
          })),
        }),
      });
      const data: { error?: string; saved?: boolean } = await response.json();

      if (!response.ok || !data.saved) {
        throw new Error(data.error || 'Nie udało się zapisać analizy.');
      }

      setSaveNotice('Analiza zapisana w bazie wiedzy.');
      await loadSavedAnalyses();
    } catch (saveAnalysisError) {
      setSaveError(
        saveAnalysisError instanceof Error
          ? saveAnalysisError.message
          : 'Nie udało się zapisać analizy.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="chat-shell competitor-shell">
      <section className="chat-panel agent-panel competitor-panel" aria-label="Analiza konkurencji">
        <header className="chat-header competitor-header">
          <div className="bot-mark" aria-hidden="true">
            🏢
          </div>
          <div>
            <h1>🏢 Analiza konkurencji</h1>
            <p className="agent-description">
              Podaj firmy — agent porówna je za Ciebie
            </p>
            <div className="example-questions competitor-examples" aria-label="Przykłady analiz">
              {examples.map((example) => (
                <button
                  disabled={isLoading}
                  key={example.companies.join('-')}
                  onClick={() => applyExample(example)}
                  type="button"
                >
                  {example.companies.join(' vs ')}
                </button>
              ))}
            </div>
          </div>
        </header>

        <form className="competitor-form" onSubmit={handleSubmit}>
          <div className="competitor-company-grid">
            {companies.map((company, index) => (
              <label key={index}>
                Firma {index + 1}
                <input
                  disabled={isLoading}
                  onChange={(event) => updateCompany(index, event.target.value)}
                  placeholder={['Np. Shopify', 'Np. WooCommerce', 'Np. PrestaShop'][index]}
                  value={company}
                />
              </label>
            ))}
          </div>
          <label>
            Kontekst
            <textarea
              disabled={isLoading}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Np. Szukam platformy e-commerce dla małego sklepu"
              value={context}
            />
          </label>
          <button disabled={isLoading || companies.some((company) => !company.trim())} type="submit">
            {isLoading ? 'Porównuję...' : '🔍 Porównaj'}
          </button>
        </form>

        <section className="competitor-results" aria-live="polite">
          <section className="saved-analyses-panel" aria-label="Zapisane analizy konkurencji">
            <div className="saved-analyses-head">
              <div>
                <h2>Zapisane analizy</h2>
                <p>
                  {savedAnalyses.length > 0
                    ? `${savedAnalyses.length} zapisanych analiz konkurencji`
                    : 'Brak zapisanych analiz'}
                </p>
              </div>
              <button
                disabled={savedAnalysesLoading}
                onClick={loadSavedAnalyses}
                type="button"
              >
                {savedAnalysesLoading ? 'Odświeżam...' : 'Odśwież'}
              </button>
            </div>

            {savedAnalysesError ? (
              <div className="error-message competitor-save-message">{savedAnalysesError}</div>
            ) : null}

            {savedAnalyses.length > 0 ? (
              <div className="saved-analyses-list">
                {savedAnalyses.map((analysis) => (
                  <button
                    className={selectedAnalysis?.id === analysis.id ? 'active' : undefined}
                    key={analysis.id}
                    onClick={() => {
                      setCopied(false);
                      setSelectedAnalysis(analysis);
                    }}
                    type="button"
                  >
                    <strong>{analysis.title}</strong>
                    <span>
                      {new Intl.DateTimeFormat('pl-PL', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(analysis.created_at))}
                      {analysis.companies.length > 0
                        ? ` · ${analysis.companies.join(' vs ')}`
                        : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {!activeAnalysisText && !isLoading ? (
            <div className="empty-state competitor-empty-state">
              <p>Wpisz trzy firmy, dodaj kontekst i uruchom analizę konkurencji.</p>
            </div>
          ) : null}

          {activeAnalysisText ? (
            <>
              <div className="competitor-toolbar">
                <span>{selectedAnalysis ? 'Zapisana analiza' : 'Wynik analizy'}</span>
                <div>
                  <button onClick={copyAnalysis} type="button">
                    {copied ? 'Skopiowano' : '📋 Kopiuj analizę'}
                  </button>
                  {selectedAnalysis ? (
                    <button onClick={() => setSelectedAnalysis(null)} type="button">
                      Pokaż bieżącą analizę
                    </button>
                  ) : (
                    <button disabled={isSaving} onClick={saveAnalysis} type="button">
                      {isSaving ? 'Zapisuję...' : '💾 Zapisz analizę'}
                    </button>
                  )}
                </div>
              </div>

              {saveNotice ? <div className="success-message competitor-save-message">{saveNotice}</div> : null}
              {saveError ? <div className="error-message competitor-save-message">{saveError}</div> : null}

              <article className="competitor-document">
                {renderMarkdown(activeAnalysisText)}
                <div ref={bottomRef} />
              </article>

              {activeAnalysisSources.length > 0 ? (
                <div className="source-links competitor-source-links" aria-label="Źródła">
                  {activeAnalysisSources.map((source) => (
                    <a
                      href={source.url}
                      key={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {sourceLabel(source)}
                    </a>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {isLoading && !analysisText ? (
            <div className="message-bubble thinking competitor-thinking">
              Agent zbiera informacje o firmach...
            </div>
          ) : null}

          {error ? (
            <div className="error-message">
              Nie udało się przygotować analizy.
              {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
