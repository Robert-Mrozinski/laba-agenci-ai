'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const terms = [
  'Sztuczna inteligencja',
  'Agent AI',
  'Prompt',
  'Halucynacja AI',
  'RAG',
  'API',
];

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export default function FewShotPage() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/fewshot' }),
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setInput('');
    clearError();
    await sendMessage({ text });
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Słownik AI">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            📚
          </div>
          <div>
            <h1>Słownik AI</h1>
            <p className="agent-description">
              Wyjaśniam trudne pojęcia prostym językiem.
            </p>
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Wpisz pojęcie albo wybierz przykład pod polem wiadomości.</p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`message-row ${message.role}`}
                key={message.id}
              >
                <div className="message-bubble">
                  {messageText(message.parts) ||
                    (message.role === 'assistant' ? 'Myślę...' : '')}
                </div>
              </article>
            ))
          )}

          {isLoading && messages.at(-1)?.role !== 'assistant' ? (
            <article className="message-row assistant">
              <div className="message-bubble thinking">Myślę...</div>
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

        <form className="composer composer-separated" onSubmit={handleSubmit}>
          <input
            aria-label="Pojęcie"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wpisz pojęcie do wyjaśnienia..."
            value={input}
          />
          <button disabled={isLoading || !input.trim()} type="submit">
            Wyślij
          </button>
        </form>

        <div className="term-buttons" aria-label="Przykładowe pojęcia">
          {terms.map((term) => (
            <button
              disabled={isLoading}
              key={term}
              onClick={() => setInput(`Czym jest ${term}?`)}
              type="button"
            >
              {term}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
