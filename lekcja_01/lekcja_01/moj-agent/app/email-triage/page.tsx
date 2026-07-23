'use client';

import { FormEvent, useMemo, useState } from 'react';

const exampleEmails = `Mail 1 - PILNY:
Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Dzień dobry, mam problem z fakturą FV/2026/001. Kwota jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o PILNĄ korektę. Termin płatności mija jutro.

Mail 2 - SPAM:
Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Mail 3 - OFERTA:
Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Dzień dobry, reprezentuję firmę ABC Solutions. Chcielibyśmy omówić możliwość współpracy w zakresie dostarczania usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Mail 4 - REKLAMACJA:
Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Witam, od poniedziałku nie mogę się zalogować do panelu klienta. Próbowałem resetować hasło ale nie dostaje maila. To już trzeci dzień! Jeśli nie rozwiążecie tego dziś, zrezygnuję z usługi.

Mail 5 - INFO:
Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury naszego najnowszego raportu o zastosowaniach AI w polskich firmach. Pobierz za darmo na naszej stronie.`;

type Priority = 'high' | 'medium' | 'low' | 'spam' | 'unknown';

type EmailCard = {
  category: string;
  draft: string;
  justification: string;
  priority: Priority;
  priorityLabel: string;
  title: string;
};

function splitEmails(input: string) {
  return input
    .split(/\n\s*\n(?=Mail\s+\d+|Od:|Temat:)/i)
    .map((email) => email.trim())
    .filter(Boolean);
}

function getTableValue(block: string, label: string) {
  const row = block.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*([^|]+)\\|`, 'i'));
  return row?.[1]?.trim() ?? '';
}

function priorityFrom(text: string, category: string): Priority {
  const normalized = `${text} ${category}`.toLowerCase();

  if (normalized.includes('spam')) {
    return 'spam';
  }

  if (normalized.includes('wysoki')) {
    return 'high';
  }

  if (normalized.includes('średni') || normalized.includes('sredni')) {
    return 'medium';
  }

  if (normalized.includes('niski')) {
    return 'low';
  }

  return 'unknown';
}

function parseDraft(block: string) {
  const draftMatch = block.match(/\*\*Proponowana odpowiedź:\*\*\s*([\s\S]*)/i);

  if (!draftMatch) {
    return '';
  }

  return draftMatch[1]
    .split('\n')
    .map((line) => line.replace(/^>\s?/, '').trimEnd())
    .join('\n')
    .replace(/---[\s\S]*$/g, '')
    .trim();
}

function parseCards(text: string): EmailCard[] {
  const sections = text
    .split(/(?=^###\s+Mail\s+\d+)/gim)
    .filter((section) => /^###\s+Mail\s+\d+/im.test(section));

  return sections.map((section, index) => {
    const title =
      section.match(/^###\s+(.+)$/im)?.[1]?.trim() ?? `Mail ${index + 1}`;
    const category = getTableValue(section, 'Kategoria');
    const priorityLabel = getTableValue(section, 'Priorytet');
    const priority = priorityFrom(priorityLabel, category);

    return {
      category,
      draft: parseDraft(section),
      justification: getTableValue(section, 'Uzasadnienie'),
      priority,
      priorityLabel,
      title,
    };
  });
}

function parseRecommendation(text: string) {
  return text.match(/✅\s*Rekomendacja:\s*(.+)/i)?.[1]?.trim() ?? '';
}

function priorityName(priority: Priority) {
  const labels: Record<Priority, string> = {
    high: 'Pilne',
    low: 'Niskie',
    medium: 'Średnie',
    spam: 'Spam',
    unknown: 'W toku',
  };

  return labels[priority];
}

export default function EmailTriagePage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copiedDraft, setCopiedDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const cards = useMemo(() => parseCards(output), [output]);
  const recommendation = useMemo(() => parseRecommendation(output), [output]);
  const counts = useMemo(
    () => ({
      high: cards.filter((card) => card.priority === 'high').length,
      low: cards.filter((card) => card.priority === 'low').length,
      medium: cards.filter((card) => card.priority === 'medium').length,
      spam: cards.filter((card) => card.priority === 'spam').length,
    }),
    [cards],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emails = splitEmails(input);

    if (emails.length === 0 || isLoading) {
      return;
    }

    setError('');
    setOutput('');
    setCopiedDraft('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/email-triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || 'Nie udało się przeanalizować maili.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        setOutput((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Nie udało się przeanalizować maili.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyDraft(card: EmailCard) {
    if (!card.draft) {
      return;
    }

    await navigator.clipboard.writeText(card.draft);
    setCopiedDraft(card.title);
  }

  return (
    <main className="chat-shell email-triage-shell">
      <section className="chat-panel agent-panel email-triage-panel" aria-label="E-mail Triage">
        <header className="chat-header email-triage-header">
          <div className="bot-mark" aria-hidden="true">
            📧
          </div>
          <div>
            <h1>📧 E-mail Triage</h1>
            <p className="agent-description">
              Wklej maile — agent posortuje i napisze odpowiedzi
            </p>
          </div>
        </header>

        <form className="email-triage-form" onSubmit={handleSubmit}>
          <textarea
            aria-label="Maile do analizy"
            disabled={isLoading}
            minLength={5}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wklej maile tutaj — oddziel je pustą linią..."
            value={input}
          />
          <div className="email-triage-actions">
            <button disabled={isLoading || !input.trim()} type="submit">
              {isLoading ? 'Analizuję...' : '📧 Analizuj maile'}
            </button>
            <button
              disabled={isLoading}
              onClick={() => setInput(exampleEmails)}
              type="button"
            >
              📋 Wklej przykład
            </button>
          </div>
        </form>

        <section className="email-triage-results" aria-live="polite">
          {output ? (
            <div className="email-triage-summary">
              <div className="email-triage-summary-head">
                <span>Podsumowanie maili</span>
                <strong>{cards.length || '...'} przeanalizowanych</strong>
              </div>
              <div className="email-triage-summary-grid" aria-label="Liczba maili według priorytetu">
                <div>
                  <b>🔴 {counts.high}</b>
                  <span>Pilne</span>
                </div>
                <div>
                  <b>🟡 {counts.medium}</b>
                  <span>Średnie</span>
                </div>
                <div>
                  <b>🟢 {counts.low}</b>
                  <span>Niskie</span>
                </div>
                <div>
                  <b>🗑️ {counts.spam}</b>
                  <span>Spam</span>
                </div>
              </div>
              {recommendation ? (
                <p>
                  <b>Rekomendacja:</b> {recommendation}
                </p>
              ) : null}
            </div>
          ) : null}

          {cards.length > 0 ? (
            <div className="email-triage-cards">
              {cards.map((card) => (
                <article
                  className={`email-card priority-${card.priority}`}
                  key={card.title}
                >
                  <header>
                    <div>
                      <span>{priorityName(card.priority)}</span>
                      <h2>{card.title}</h2>
                    </div>
                    <strong>{card.priorityLabel || 'Analizuję...'}</strong>
                  </header>
                  <dl>
                    <div>
                      <dt>Kategoria</dt>
                      <dd>{card.category || 'Analizuję...'}</dd>
                    </div>
                    <div>
                      <dt>Uzasadnienie</dt>
                      <dd>{card.justification || 'Analizuję...'}</dd>
                    </div>
                  </dl>
                  <div className="email-draft">
                    <div>
                      <h3>Proponowana odpowiedź</h3>
                      <button
                        disabled={!card.draft}
                        onClick={() => copyDraft(card)}
                        type="button"
                      >
                        {copiedDraft === card.title ? 'Skopiowano' : 'Kopiuj draft'}
                      </button>
                    </div>
                    <blockquote>
                      {card.draft || 'Agent pisze szkic odpowiedzi...'}
                    </blockquote>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state email-empty-state">
              <p>
                Wklej do 5 maili, kliknij analizę i zobacz priorytety oraz gotowe
                szkice odpowiedzi.
              </p>
            </div>
          )}

          {isLoading && cards.length === 0 ? (
            <div className="message-bubble thinking">Agent sortuje pocztę...</div>
          ) : null}

          {error ? <div className="error-message">{error}</div> : null}
        </section>
      </section>
    </main>
  );
}
