'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getAuthHeaders } from '../../lib/authHeaders';

type SavedDocument = {
  title: string;
  chunks: number;
  created_at: string | null;
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

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSearchResult[]>([]);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewChunks, setPreviewChunks] = useState<KnowledgeChunk[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadDocuments();
  }, []);

  async function loadDocuments() {
    setIsLoadingDocuments(true);
    setError('');

    try {
      const response = await fetch('/api/upload-knowledge', {
        headers: await getAuthHeaders(),
      });
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
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
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
        { headers: await getAuthHeaders() },
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

  return (
    <main className="upload-shell">
      <section className="upload-panel" aria-label="Podgląd wiedzy">
        <header className="upload-header">
          <div className="bot-mark" aria-hidden="true">
            👁️
          </div>
          <div>
            <h1>👁️ Podgląd wiedzy</h1>
            <p className="agent-description">
              Sprawdź dokumenty, fragmenty i wyszukiwanie zanim zapytasz agenta.
            </p>
          </div>
        </header>

        {error ? <div className="error-message">{error}</div> : null}

        <section className="upload-documents" aria-label="Twoja baza wiedzy">
          <div className="upload-documents-header">
            <div>
              <h2>Twoja baza wiedzy</h2>
              <p>
                {documents.reduce((sum, document) => sum + document.chunks, 0)} fragmentów z{' '}
                {documents.length} dokumentów
              </p>
            </div>
            <button disabled={isLoadingDocuments} onClick={loadDocuments} type="button">
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
                  </div>
                </article>
              ))}
            </div>
          )}

          {previewTitle ? (
            <section className="knowledge-preview" aria-label="Podgląd fragmentów">
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
