'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Briefing = {
  id: string;
  content: string;
  created_at: string;
  date: string;
};

function formatBriefingDate(date: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'full',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(`${date}T00:00:00`));
}

function formatSavedAt(date: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(date));
}

function previewText(content: string) {
  const text = content
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

function renderMarkdown(content: string) {
  const lines = content.split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    nodes.push(
      <ul key={`list-${nodes.length}`}>
        {listItems.map((item) => (
          <li key={item}>{item.replace(/^[-*]\s*/, '')}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed);
      return;
    }

    flushList();

    if (trimmed.startsWith('## ')) {
      nodes.push(<h2 key={index}>{trimmed.replace(/^##\s*/, '')}</h2>);
      return;
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(<h1 key={index}>{trimmed.replace(/^#\s*/, '')}</h1>);
      return;
    }

    nodes.push(<p key={index}>{trimmed.replace(/\*\*/g, '')}</p>);
  });

  flushList();
  return nodes;
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const selectedBriefing = useMemo(
    () => briefings.find((briefing) => briefing.id === selectedId) ?? null,
    [briefings, selectedId],
  );

  async function loadBriefings() {
    if (!isSupabaseConfigured || !supabase) {
      setError('Brakuje konfiguracji Supabase w zmiennych środowiskowych.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');

    const { data, error: selectError } = await supabase
      .from('briefings')
      .select('id, created_at, content, date')
      .order('created_at', { ascending: false })
      .limit(30);

    if (selectError) {
      setError(selectError.message);
      setBriefings([]);
    } else {
      setBriefings(data ?? []);
      setSelectedId((currentId) => {
        if (!currentId) {
          return null;
        }

        return data?.some((briefing) => briefing.id === currentId) ? currentId : null;
      });
    }

    setIsLoading(false);
  }

  async function generateNow() {
    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/cron/morning', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'Cron jest zabezpieczony CRON_SECRET. Uruchom go ręcznie w Vercel: Settings → Cron Jobs → Run.',
          );
        }

        throw new Error(payload.error ?? `Endpoint zwrócił status ${response.status}.`);
      }

      await loadBriefings();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Nie udało się wygenerować briefingu.',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyBriefing() {
    if (!selectedBriefing) {
      return;
    }

    await navigator.clipboard.writeText(selectedBriefing.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  useEffect(() => {
    void loadBriefings();
  }, []);

  return (
    <main className="briefings-shell">
      <section className="briefings-panel">
        <header className="briefings-header">
          <div>
            <h1>📰 Briefingi</h1>
            <p>Automatyczne podsumowania dnia od Twojego agenta</p>
          </div>
          <button disabled={isGenerating} onClick={() => void generateNow()} type="button">
            {isGenerating ? 'Generuję...' : '🔄 Wygeneruj teraz'}
          </button>
        </header>

        {error ? <p className="briefings-error">{error}</p> : null}

        {selectedBriefing ? (
          <article className="briefing-detail">
            <div className="briefing-detail-head">
              <div>
                <button onClick={() => setSelectedId(null)} type="button">
                  ← Wróć do listy
                </button>
                <p>{formatBriefingDate(selectedBriefing.date)}</p>
              </div>
              <button onClick={() => void copyBriefing()} type="button">
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </button>
            </div>
            <div className="briefing-markdown">{renderMarkdown(selectedBriefing.content)}</div>
          </article>
        ) : (
          <>
            {isLoading ? (
              <div className="briefings-list">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="briefing-card briefing-card-loading" key={index}>
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoading && briefings.length === 0 ? (
              <div className="briefings-empty">
                <h2>Brak briefingów</h2>
                <p>Cron job wygeneruje pierwszy jutro rano!</p>
                <button disabled={isGenerating} onClick={() => void generateNow()} type="button">
                  🔄 Wygeneruj teraz
                </button>
              </div>
            ) : null}

            {!isLoading && briefings.length > 0 ? (
              <div className="briefings-list">
                {briefings.map((briefing) => (
                  <button
                    className="briefing-card"
                    key={briefing.id}
                    onClick={() => setSelectedId(briefing.id)}
                    type="button"
                  >
                    <div>
                      <time>{formatBriefingDate(briefing.date)}</time>
                      <small>Zapisany: {formatSavedAt(briefing.created_at)}</small>
                    </div>
                    <p>{previewText(briefing.content)}</p>
                    <span>✅ wygenerowany automatycznie (z cron)</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
