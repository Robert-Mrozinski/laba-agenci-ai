'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type SavedDocument = {
  title: string;
  chunks: number;
  created_at: string | null;
};

type ProgressMessage =
  | {
      type: 'start';
      total: number;
      message: string;
    }
  | {
      type: 'progress';
      current: number;
      total: number;
      message: string;
    }
  | {
      type: 'done';
      chunks_saved: number;
      message: string;
    }
  | {
      type: 'error';
      message: string;
    };

type KnowledgeSearchResult = {
  added_at: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  title: string;
};

type KnowledgeChunk = {
  content: string;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  title: string;
};

const examples = [
  {
    label: 'Cennik',
    title: 'Cennik 2026',
    content: `CENNIK USŁUG 2026

Pakiet Basic: 99 zł/miesiąc
- 5 użytkowników
- 10 GB miejsca
- Wsparcie email

Pakiet Premium: 299 zł/miesiąc
- 25 użytkowników
- 100 GB miejsca
- Wsparcie email + telefon
- Priorytetowa obsługa

Pakiet VIP: 599 zł/miesiąc
- Nielimitowani użytkownicy
- 1 TB miejsca
- Wsparcie 24/7
- Dedykowany opiekun
- Szkolenie wdrożeniowe

Wszystkie pakiety z 14-dniowym okresem próbnym.
Faktura VAT wystawiana automatycznie.
Rezygnacja możliwa w dowolnym momencie.`,
  },
  {
    label: 'FAQ',
    title: 'FAQ subskrypcji',
    content:
      'Q: Jak mogę anulować subskrypcję? A: Wyślij email na support@example.com. Q: Czy wystawiacie faktury? A: Tak, faktura VAT jest generowana automatycznie.',
  },
  {
    label: 'Regulamin',
    title: 'Regulamin firmy',
    content:
      '§1. Postanowienia ogólne. 1.1 Niniejszy regulamin określa zasady korzystania z usług. 1.2 Użytkownik akceptuje regulamin przed rozpoczęciem współpracy.',
  },
];

export default function UploadPage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingTitle, setIsDeletingTitle] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSearchResult[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewChunks, setPreviewChunks] = useState<KnowledgeChunk[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const progressPercent = useMemo(() => {
    if (!progress.total) {
      return 0;
    }

    return Math.round((progress.current / progress.total) * 100);
  }, [progress]);

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function loadDocuments() {
    setIsLoadingDocuments(true);
    setError('');

    try {
      const response = await fetch('/api/upload-knowledge');
      const data = (await response.json()) as {
        documents?: SavedDocument[];
        error?: string;
      };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Nie udało się pobrać listy dokumentów.');
      }

      setDocuments(data.documents ?? []);
    } catch (documentsError) {
      setError(
        documentsError instanceof Error
          ? documentsError.message
          : 'Nie udało się pobrać listy dokumentów.',
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !content.trim() || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');
    setNotice('');
    setProgress({ current: 0, total: 0, message: 'Przygotowuję dokument...' });

    try {
      const response = await fetch('/api/upload-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!response.body) {
        throw new Error('Serwer nie zwrócił strumienia postępu.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          handleProgressMessage(JSON.parse(line) as ProgressMessage);
        }
      }

      if (buffer.trim()) {
        handleProgressMessage(JSON.parse(buffer) as ProgressMessage);
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Nie udało się zapisać dokumentu.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleProgressMessage(message: ProgressMessage) {
    if (message.type === 'start') {
      setProgress({ current: 0, total: message.total, message: message.message });
      return;
    }

    if (message.type === 'progress') {
      setProgress({
        current: message.current,
        total: message.total,
        message: message.message,
      });
      return;
    }

    if (message.type === 'done') {
      setProgress({
        current: message.chunks_saved,
        total: message.chunks_saved,
        message: message.message,
      });
      setNotice(`Zapisano ${message.chunks_saved} fragmentów w bazie wiedzy.`);
      setTitle('');
      setContent('');
      void loadDocuments();
      return;
    }

    setError(message.message);
  }

  async function deleteDocument(documentTitle: string) {
    if (isDeletingTitle) {
      return;
    }

    setIsDeletingTitle(documentTitle);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/upload-knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: documentTitle }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Nie udało się usunąć dokumentu.');
      }

      setNotice(`Usunięto dokument „${documentTitle}”.`);
      if (previewTitle === documentTitle) {
        setPreviewTitle('');
        setPreviewChunks([]);
      }
      await loadDocuments();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Nie udało się usunąć dokumentu.',
      );
    } finally {
      setIsDeletingTitle('');
    }
  }

  async function searchKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = knowledgeQuery.trim();
    if (!query || isSearching) {
      return;
    }

    setIsSearching(true);
    setError('');
    setKnowledgeResults([]);

    try {
      const response = await fetch('/api/search-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = (await response.json()) as {
        error?: string;
        results?: KnowledgeSearchResult[];
      };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Nie udało się przeszukać bazy wiedzy.');
      }

      setKnowledgeResults(data.results ?? []);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Nie udało się przeszukać bazy wiedzy.',
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function previewDocument(documentTitle: string) {
    if (isLoadingPreview) {
      return;
    }

    if (previewTitle === documentTitle && previewChunks.length > 0) {
      setPreviewTitle('');
      setPreviewChunks([]);
      return;
    }

    setIsLoadingPreview(true);
    setError('');

    try {
      const response = await fetch(
        `/api/upload-knowledge?title=${encodeURIComponent(documentTitle)}`,
      );
      const data = (await response.json()) as {
        chunks?: KnowledgeChunk[];
        error?: string;
      };

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Nie udało się pobrać fragmentów dokumentu.');
      }

      setPreviewTitle(documentTitle);
      setPreviewChunks(data.chunks ?? []);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Nie udało się pobrać fragmentów dokumentu.',
      );
    } finally {
      setIsLoadingPreview(false);
    }
  }

  function useExample(example: (typeof examples)[number]) {
    if (isSaving) {
      return;
    }

    setTitle(example.title);
    setContent(example.content);
  }

  return (
    <main className="upload-shell">
      <section className="upload-panel" aria-label="Baza wiedzy">
        <header className="upload-header">
          <div className="bot-mark" aria-hidden="true">
            📚
          </div>
          <div>
            <h1>📚 Baza wiedzy</h1>
            <p className="agent-description">
              Wklej tekst — agent będzie z niego korzystał.
            </p>
          </div>
        </header>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label>
            <span>Tytuł dokumentu</span>
            <input
              disabled={isSaving}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Np. Cennik 2026, FAQ, Regulamin firmy"
              value={title}
            />
          </label>

          <label>
            <span>Treść dokumentu</span>
            <textarea
              disabled={isSaving}
              minLength={20}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Wklej tutaj treść dokumentu..."
              value={content}
            />
          </label>

          <div className="upload-examples" aria-label="Przykładowe dokumenty">
            {examples.map((example) => (
              <button
                disabled={isSaving}
                key={example.label}
                onClick={() => useExample(example)}
                type="button"
              >
                {example.label}
              </button>
            ))}
          </div>

          <button
            className="upload-submit"
            disabled={isSaving || !title.trim() || !content.trim()}
            type="submit"
          >
            📤 Zapisz w bazie wiedzy
          </button>
        </form>

        {isSaving || progress.message ? (
          <div className="upload-progress" aria-live="polite">
            <div>
              <strong>{progress.message || 'Przetwarzam dokument...'}</strong>
              <span>{progressPercent}%</span>
            </div>
            <span>
              <i style={{ width: `${progressPercent}%` }} />
            </span>
          </div>
        ) : null}

        {notice ? <div className="success-message">{notice}</div> : null}
        {error ? <div className="error-message">{error}</div> : null}

        <section className="upload-documents" aria-label="Zapisane dokumenty">
          <div className="upload-documents-header">
            <div>
              <h2>Twoja baza wiedzy</h2>
              <p>
                {documents.reduce((sum, document) => sum + document.chunks, 0)} fragmentów z{' '}
                {documents.length} dokumentów
              </p>
            </div>
            <button disabled={isLoadingDocuments || isSaving} onClick={loadDocuments} type="button">
              Odśwież
            </button>
          </div>

          <form className="knowledge-search" onSubmit={searchKnowledge}>
            <label>
              <span>Szukaj w bazie wiedzy</span>
              <div>
                <input
                  disabled={isSearching}
                  onChange={(event) => setKnowledgeQuery(event.target.value)}
                  placeholder="Np. Co zawiera pakiet VIP?"
                  value={knowledgeQuery}
                />
                <button disabled={isSearching || !knowledgeQuery.trim()} type="submit">
                  {isSearching ? 'Szukam...' : 'Szukaj'}
                </button>
              </div>
            </label>
          </form>

          {knowledgeResults.length > 0 ? (
            <div className="knowledge-results" aria-label="Wyniki wyszukiwania">
              {knowledgeResults.map((result, index) => (
                <article className="knowledge-result" key={`${result.title}-${index}`}>
                  <div>
                    <strong>{result.title}</strong>
                    <span>similarity {result.similarity}</span>
                  </div>
                  <p>{result.content}</p>
                  <small>
                    📎 Źródło: {result.title}
                    {result.added_at ? ` · dodano ${formatDate(result.added_at)}` : ''}
                  </small>
                </article>
              ))}
            </div>
          ) : knowledgeQuery.trim() && !isSearching ? (
            <p className="upload-muted">Brak wyników dla ostatniego wyszukiwania.</p>
          ) : null}

          {isLoadingDocuments ? (
            <p className="upload-muted">Wczytuję dokumenty...</p>
          ) : documents.length === 0 ? (
            <p className="upload-muted">Nie ma jeszcze zapisanych dokumentów.</p>
          ) : (
            <div className="upload-document-list">
              {documents.map((document) => (
                <article className="upload-document" key={document.title}>
                  <div>
                    <h3>{document.title}</h3>
                    <p>
                      {document.chunks} fragmentów
                      {document.created_at ? ` · ${formatDate(document.created_at)}` : ''}
                    </p>
                  </div>
                  <div className="upload-document-actions">
                    <button
                      disabled={isLoadingPreview}
                      onClick={() => previewDocument(document.title)}
                      type="button"
                    >
                      {previewTitle === document.title ? 'Ukryj podgląd' : '👁️ Podgląd wiedzy'}
                    </button>
                    <button
                      disabled={Boolean(isDeletingTitle) || isSaving}
                      onClick={() => deleteDocument(document.title)}
                      type="button"
                    >
                      {isDeletingTitle === document.title ? 'Usuwam...' : '🗑️ Usuń'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {previewTitle ? (
            <section className="knowledge-preview" aria-label="Podgląd wiedzy">
              <div className="knowledge-preview-header">
                <h3>Podgląd wiedzy: {previewTitle}</h3>
                <span>{previewChunks.length} fragmentów</span>
              </div>
              {previewChunks.length === 0 ? (
                <p className="upload-muted">Ten dokument nie ma zapisanych fragmentów.</p>
              ) : (
                <div className="knowledge-preview-list">
                  {previewChunks.map((chunk, index) => (
                    <article className="knowledge-preview-chunk" key={`${chunk.title}-${index}`}>
                      <strong>Fragment {chunkIndex(chunk.metadata, index) + 1}</strong>
                      <p>{chunk.content}</p>
                      <small>
                        {chunk.created_at ? `Dodano ${formatDate(chunk.created_at)}` : 'Brak daty'}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function chunkIndex(metadata: Record<string, unknown> | null, fallback: number) {
  const value = metadata?.chunk_index;
  return typeof value === 'number' ? value : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
