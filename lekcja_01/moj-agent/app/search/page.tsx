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
} from '../components/imageAttachment';

const exampleQuestions = [
  'Jakie są najnowsze wiadomości o sztucznej inteligencji?',
  'Ile kosztuje iPhone 16 Pro w Polsce?',
  'Kto wygrał ostatni mecz reprezentacji Polski?',
  'Jakie filmy są teraz w kinach?',
];

type MessagePart = {
  type: string;
  text?: string;
  url?: string;
  title?: string;
  sourceId?: string;
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

function sourceLabel(source: MessagePart & { url: string }) {
  if (source.title) {
    return source.title;
  }

  try {
    return new URL(source.url).hostname;
  } catch {
    return source.url;
  }
}

export default function SearchPage() {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(
    null,
  );
  const [imageError, setImageError] = useState('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status, error, clearError } = useChat();
  const isLoading = status === 'submitted' || status === 'streaming';
  const errorMessage = error?.message
    ? error.message.replace(/<[^>]*>/g, '').slice(0, 240)
    : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

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
    await sendMessage(
      { text: text || 'Co widzisz na tym obrazie?' },
      { body: { image, model: 'flash' } },
    );
  }

  async function handleExampleQuestion(question: string) {
    if (isLoading) {
      return;
    }

    clearError();
    setInput('');
    await sendMessage({ text: question }, { body: { model: 'flash' } });
  }

  return (
    <main
      className="chat-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingImage ? <div className="drop-overlay">Upuść obraz</div> : null}
      <section className="chat-panel" aria-label="Agent z wyszukiwarką">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🌐
          </div>
          <div>
            <h1>🌐 Agent z wyszukiwarką</h1>
            <p className="agent-description">
              Przeszukuję prawdziwy internet i czytam strony
            </p>
            <div className="example-questions" aria-label="Pytania startowe">
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

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>Zapytaj o coś aktualnego albo podaj adres strony do przeczytania.</p>
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
                    {messageText(message.parts) ||
                      (message.role === 'assistant' ? 'Szukam...' : '')}

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
              <div className="message-bubble thinking">Szukam...</div>
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
            placeholder="Zapytaj o cokolwiek aktualnego..."
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
