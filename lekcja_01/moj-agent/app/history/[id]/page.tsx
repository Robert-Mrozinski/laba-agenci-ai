'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';

type Conversation = {
  created_at?: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

type StoredMessage = {
  content: string;
  created_at: string | null;
  id: string;
  role: 'user' | 'assistant';
};

function formatDate(value?: string | null) {
  if (!value) {
    return 'brak daty';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatTime(value?: string | null) {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      if (!supabase) {
        setError(
          isSupabaseConfigured
            ? 'Nie udało się połączyć z Supabase.'
            : 'Brakuje zmiennych Supabase w .env.local.',
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const { data: conversationRow, error: conversationError } =
        await supabase
          .from('conversations')
          .select('id, title, created_at, updated_at')
          .eq('id', conversationId)
          .maybeSingle();

      if (cancelled) {
        return;
      }

      if (conversationError) {
        setError(conversationError.message);
        setLoading(false);
        return;
      }

      if (!conversationRow) {
        setError('Nie znaleziono tej rozmowy.');
        setLoading(false);
        return;
      }

      const { data: messageRows, error: messagesError } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (cancelled) {
        return;
      }

      if (messagesError) {
        setError(messagesError.message);
        setLoading(false);
        return;
      }

      setConversation(conversationRow as Conversation);
      setMessages(
        (messageRows ?? []).filter(
          (message): message is StoredMessage =>
            (message.role === 'user' || message.role === 'assistant') &&
            typeof message.content === 'string',
        ),
      );
      setLoading(false);
    }

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <main className="history-shell">
      <section className="history-panel" aria-label="Podgląd rozmowy">
        <header className="history-detail-header">
          <div>
            <Link className="history-back-link" href="/history">
              ← Wróć do listy
            </Link>
            <h1>{conversation?.title || 'Rozmowa'}</h1>
            <p>
              Ostatnia aktywność:{' '}
              {formatDate(conversation?.updated_at ?? conversation?.created_at)}
            </p>
          </div>
          <Link
            className="history-primary-link"
            href={`/agent?conversationId=${conversationId}`}
          >
            🔄 Kontynuuj rozmowę
          </Link>
        </header>

        {error ? <div className="error-message">{error}</div> : null}

        {loading ? (
          <div className="history-empty">Wczytuję rozmowę...</div>
        ) : messages.length === 0 ? (
          <div className="history-empty">Ta rozmowa nie ma wiadomości.</div>
        ) : (
          <div className="history-thread">
            {messages.map((message) => (
              <article
                className={`message-row ${message.role}`}
                key={message.id}
              >
                <div className="message-bubble">
                  <div className="history-message-meta">
                    <span>
                      {message.role === 'user' ? 'Ty' : 'Agent'}
                    </span>
                    <span>{formatTime(message.created_at)}</span>
                  </div>
                  {message.content}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
