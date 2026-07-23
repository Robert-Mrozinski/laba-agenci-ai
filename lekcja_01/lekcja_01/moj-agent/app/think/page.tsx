'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export default function ThinkPage() {
  const [input, setInput] = useState('');
  const [contextOpen, setContextOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/think' }),
    [],
  );
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat({ transport });
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;
  const totalCharacters = messages.reduce(
    (sum, message) => sum + messageText(message.parts).length,
    0,
  );
  const estimatedTokens = Math.ceil(totalCharacters / 4);

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

  function handleNewConversation() {
    clearError();
    setMessages([]);
    setInput('');
    setCopied(false);
  }

  async function handleExport() {
    const transcript = messages
      .map((message) => {
        const speaker = message.role === 'user' ? 'User' : 'Agent';
        return `${speaker}: ${messageText(message.parts)}`;
      })
      .join('\n');

    await navigator.clipboard.writeText(transcript || 'Brak wiadomości.');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Tryb głębokiego myślenia">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🧠
          </div>
          <div>
            <h1>Tryb głębokiego myślenia</h1>
            <p className="agent-description">
              Agent pokazuje tok rozumowania krok po kroku.
            </p>
          </div>
        </header>

        <section className="context-panel" aria-label="Kontekst rozmowy">
          <button
            className="context-toggle"
            onClick={() => setContextOpen((open) => !open)}
            type="button"
          >
            <span>Kontekst rozmowy</span>
            <span>{contextOpen ? 'Ukryj' : 'Pokaż'}</span>
          </button>

          {contextOpen ? (
            <div className="context-content">
              <span>
                Wiadomości: {messages.length} | ~Tokeny: {estimatedTokens}
              </span>
              <div className="context-actions">
                <button onClick={handleNewConversation} type="button">
                  🗑 Nowa rozmowa
                </button>
                <button onClick={handleExport} type="button">
                  📋 Eksportuj rozmowę
                </button>
                {copied ? <span className="copied">Skopiowano!</span> : null}
              </div>
            </div>
          ) : null}
        </section>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Zadaj trudne pytanie i zobacz analizę krok po kroku.</p>
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
            aria-label="Pytanie"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Zadaj trudne pytanie..."
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
