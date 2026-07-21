'use client';

import { useChat } from '@ai-sdk/react';
import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AttachedImage,
  imageFromClipboard,
  imageFromDrop,
  readImageFile,
} from './imageAttachment';

type AiModel = 'flash' | 'pro';

const models: Array<{ id: AiModel; label: string; badge: string }> = [
  { id: 'flash', label: '⚡ Flash', badge: '⚡ flash' },
  { id: 'pro', label: '🧠 Pro', badge: '🧠 pro' },
];

const exampleQuestions = [
  'Jak wygląda proces zakupu mieszkania w Hiszpanii krok po kroku?',
  'Jaki budżet przygotować poza ceną nieruchomości?',
  'Costa Blanca czy Costa del Sol: co wybrać pod wynajem?',
  'Jakie dokumenty są potrzebne kupującemu z Polski?',
];

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

type SourcePart = {
  sourceId?: string;
  title?: string;
  type: string;
  url?: string;
};

function sourceLinks(parts: SourcePart[]) {
  return parts.filter(
    (part): part is SourcePart & { url: string } =>
      part.type === 'source-url' && typeof part.url === 'string',
  );
}

function sourceLabel(source: SourcePart & { url: string }) {
  if (source.title) {
    return source.title;
  }

  try {
    return new URL(source.url).hostname;
  } catch {
    return source.url;
  }
}

export function CostaChat() {
  const [input, setInput] = useState('');
  const [activeModel, setActiveModel] = useState<AiModel>('flash');
  const [messageModels, setMessageModels] = useState<Record<string, AiModel>>(
    {},
  );
  const [contextOpen, setContextOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(
    null,
  );
  const [imageError, setImageError] = useState('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingModelRef = useRef<AiModel>('flash');
  const { messages, sendMessage, setMessages, status, error, clearError } =
    useChat();
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

  useEffect(() => {
    setMessageModels((currentModels) => {
      let changed = false;
      const nextModels = { ...currentModels };

      messages.forEach((message) => {
        if (message.role === 'assistant' && !nextModels[message.id]) {
          nextModels[message.id] = pendingModelRef.current;
          changed = true;
        }
      });

      return changed ? nextModels : currentModels;
    });
  }, [messages]);

  async function attachImage(file?: File | null) {
    if (!file) {
      return;
    }

    try {
      const image = await readImageFile(file);
      setAttachedImage(image);
      setImageError('');
    } catch (attachmentError) {
      setImageError(
        attachmentError instanceof Error
          ? attachmentError.message
          : 'Nie udało się wczytać obrazu.',
      );
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const file = imageFromClipboard(event.clipboardData.items);

    if (file) {
      event.preventDefault();
      void attachImage(file);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void attachImage(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingImage(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (event.currentTarget === event.target) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    void attachImage(imageFromDrop(event.dataTransfer.files));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if ((!text && !attachedImage) || isLoading) {
      return;
    }

    setInput('');
    const image = attachedImage?.dataUrl;
    setAttachedImage(null);
    clearError();
    pendingModelRef.current = activeModel;
    await sendMessage(
      { text: text || 'Co widzisz na tym obrazie?' },
      { body: { image, model: activeModel } },
    );
  }

  async function handleExampleQuestion(question: string) {
    if (isLoading) {
      return;
    }

    clearError();
    setInput('');
    pendingModelRef.current = activeModel;
    await sendMessage({ text: question }, { body: { model: activeModel } });
  }

  function handleNewConversation() {
    clearError();
    setMessages([]);
    setMessageModels({});
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
    <main
      className="chat-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingImage ? <div className="drop-overlay">Upuść obraz</div> : null}
      <section className="chat-panel" aria-label="Czat z agentem AI">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🏠
          </div>
          <div>
            <h1>Costa Broker</h1>
            <p className="agent-description">
              Karolina — ekspert od nieruchomości w Hiszpanii. Zapytaj mnie o zakup, lokalizacje, koszty i proces transakcji.
            </p>
            <div className="example-questions" aria-label="Przykładowe pytania">
              {exampleQuestions.map((question) => (
                <button
                  disabled={isLoading}
                  key={question}
                  onClick={() => handleExampleQuestion(question)}
                  type="button"
                >
                  {question}
                </button>
              ))}
            </div>
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
              <p>Zadaj pierwsze pytanie i rozpocznij rozmowę.</p>
            </div>
          ) : (
            messages.map((message) => {
              const sources = sourceLinks(message.parts);

              return (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble">
                    {message.role === 'assistant' ? (
                      <span
                        className={`model-badge ${
                          messageModels[message.id] ?? activeModel
                        }`}
                      >
                        {
                          models.find(
                            (model) =>
                              model.id ===
                              (messageModels[message.id] ?? activeModel),
                          )?.badge
                        }
                      </span>
                    ) : null}
                    {messageText(message.parts) ||
                      (message.role === 'assistant' ? 'Myślę...' : '')}

                    {sources.length > 0 ? (
                      <div className="source-links" aria-label="Źródła">
                        {sources.map((source) => (
                          <a
                            href={source.url}
                            key={source.sourceId ?? source.url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {sourceLabel(source)}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
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

        <div className="model-switcher" aria-label="Model AI">
          {models.map((model) => (
            <button
              className={activeModel === model.id ? 'active' : ''}
              disabled={isLoading}
              key={model.id}
              onClick={() => setActiveModel(model.id)}
              type="button"
            >
              {model.label}
            </button>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          {attachedImage ? (
            <div className="attachment-preview">
              <img alt={attachedImage.name} src={attachedImage.dataUrl} />
              <span>📎 Screenshot - zadaj pytanie o ten obraz</span>
              <button onClick={() => setAttachedImage(null)} type="button">
                ×
              </button>
            </div>
          ) : null}
          {imageError ? <div className="attachment-error">{imageError}</div> : null}
          <input
            accept="image/*"
            hidden
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <button
            aria-label="Dodaj obraz"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            📎
          </button>
          <input
            aria-label="Wiadomość"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder="Napisz wiadomość..."
            value={input}
          />
          <button disabled={isLoading || (!input.trim() && !attachedImage)} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
