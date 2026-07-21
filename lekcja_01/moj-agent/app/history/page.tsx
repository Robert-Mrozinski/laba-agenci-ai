'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Conversation = {
  created_at?: string | null;
  id: string;
  title: string | null;
  updated_at: string | null;
};

type StoredMessage = {
  content: string;
  conversation_id: string;
  created_at: string | null;
  role: 'user' | 'assistant';
};

type ConversationCard = Conversation & {
  lastMessage: string;
  messageCount: number;
};

function formatRelativeDate(value?: string | null) {
  if (!value) {
    return 'brak daty';
  }

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'przed chwilą';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min temu`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} godz. temu`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays === 1) {
    return 'wczoraj';
  }

  if (diffDays < 7) {
    return `${diffDays} dni temu`;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function preview(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, ' ');

  if (!normalizedText) {
    return 'Brak treści wiadomości.';
  }

  return normalizedText.length > 100
    ? `${normalizedText.slice(0, 97)}...`
    : normalizedText;
}

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');

  async function loadConversations() {
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

    const { data: conversationRows, error: conversationsError } =
      await supabase
        .from('conversations')
        .select('id, title, created_at, updated_at')
        .order('updated_at', { ascending: false });

    if (conversationsError) {
      setError(conversationsError.message);
      setLoading(false);
      return;
    }

    const ids = (conversationRows ?? []).map((conversation) => conversation.id);

    if (ids.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: messageRows, error: messagesError } = await supabase
      .from('messages')
      .select('conversation_id, role, content, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: true });

    if (messagesError) {
      setError(messagesError.message);
      setLoading(false);
      return;
    }

    const messagesByConversation = new Map<string, StoredMessage[]>();

    (messageRows ?? []).forEach((message) => {
      const currentMessages =
        messagesByConversation.get(message.conversation_id) ?? [];
      currentMessages.push(message as StoredMessage);
      messagesByConversation.set(message.conversation_id, currentMessages);
    });

    setConversations(
      (conversationRows as Conversation[]).map((conversation) => {
        const messages = messagesByConversation.get(conversation.id) ?? [];
        const lastMessage = messages.at(-1);

        return {
          ...conversation,
          lastMessage: preview(lastMessage?.content ?? ''),
          messageCount: messages.length,
        };
      }),
    );
    setLoading(false);
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = conversation.title ?? 'Nowa rozmowa';
      return `${title} ${conversation.lastMessage}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [conversations, query]);

  async function deleteConversation(id: string) {
    if (!supabase) {
      return;
    }

    const confirmed = window.confirm(
      'Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.',
    );

    if (!confirmed) {
      return;
    }

    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    if (messagesError) {
      setError(messagesError.message);
      return;
    }

    const { error: conversationError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (conversationError) {
      setError(conversationError.message);
      return;
    }

    setConversations((currentConversations) =>
      currentConversations.filter((conversation) => conversation.id !== id),
    );
    setNotice('Rozmowa usunięta');
    window.setTimeout(() => setNotice(''), 2000);
  }

  return (
    <main className="history-shell">
      <section className="history-panel" aria-label="Historia rozmów">
        <header className="history-header">
          <div>
            <h1>📜 Historia rozmów</h1>
            <p>Wszystkie Twoje rozmowy z agentem</p>
          </div>
          <Link className="history-primary-link" href="/agent">
            Rozpocznij rozmowę
          </Link>
        </header>

        <div className="history-toolbar">
          <input
            aria-label="Szukaj w rozmowach"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj w rozmowach..."
            value={query}
          />
        </div>

        {notice ? <div className="history-notice">{notice}</div> : null}
        {error ? <div className="error-message">{error}</div> : null}

        {loading ? (
          <div className="history-empty">Wczytuję rozmowy...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="history-empty">
            <p>Nie masz jeszcze żadnych rozmów. Zacznij nową!</p>
            <Link className="history-primary-link" href="/agent">
              Rozpocznij rozmowę
            </Link>
          </div>
        ) : (
          <div className="history-list">
            {filteredConversations.map((conversation) => (
              <article
                className="history-card"
                key={conversation.id}
                onClick={() => router.push(`/history/${conversation.id}`)}
              >
                <div className="history-card-content">
                  <h2>{conversation.title || 'Nowa rozmowa'}</h2>
                  <div className="history-meta">
                    <span>{formatRelativeDate(conversation.updated_at)}</span>
                    <span>{conversation.messageCount} wiadomości</span>
                  </div>
                  <p>{conversation.lastMessage}</p>
                </div>
                <button
                  aria-label="Usuń rozmowę"
                  className="history-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteConversation(conversation.id);
                  }}
                  type="button"
                >
                  🗑️ Usuń
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
