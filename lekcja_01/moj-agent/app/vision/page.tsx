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

const visionQuestions = [
  'Co widzisz na tym obrazie?',
  'Wyciągnij cały tekst z tego screena',
  'Opisz to w 3 zdaniach',
  'Jakie kolory dominują? Podaj kody HEX',
  'Wygeneruj podobny obraz w innym stylu',
];

type RemixResult = {
  image: string;
  prompt: string;
  text: string;
};

function messageText(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export default function VisionPage() {
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(
    null,
  );
  const [input, setInput] = useState('');
  const [imageError, setImageError] = useState('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [remixResult, setRemixResult] = useState<RemixResult | null>(null);
  const [remixError, setRemixError] = useState('');
  const [isRemixing, setIsRemixing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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
      setRemixResult(null);
      setRemixError('');
    } catch (attachmentError) {
      setImageError(
        attachmentError instanceof Error
          ? attachmentError.message
          : 'Nie udało się wczytać obrazu.',
      );
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
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

  async function askAboutImage(question = input) {
    const text = question.trim();

    if (!attachedImage || !text || isLoading) {
      return;
    }

    setInput('');
    clearError();
    await sendMessage(
      { text },
      { body: { image: attachedImage.dataUrl, model: 'flash' } },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await askAboutImage();
  }

  async function generateSimilar(instruction: string) {
    if (!attachedImage || isRemixing) {
      return;
    }

    setIsRemixing(true);
    setRemixError('');
    setRemixResult(null);

    try {
      const response = await fetch('/api/vision-remix', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          image: attachedImage.dataUrl,
          instruction,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Nie udało się wygenerować obrazu.');
      }

      setRemixResult({
        image: data.image,
        prompt: data.prompt,
        text: data.text ?? '',
      });
    } catch (generateError) {
      setRemixError(
        generateError instanceof Error
          ? generateError.message
          : 'Nie udało się wygenerować podobnej wersji.',
      );
    } finally {
      setIsRemixing(false);
    }
  }

  function handleQuestion(question: string) {
    if (question.startsWith('Wygeneruj podobny')) {
      void generateSimilar(question);
      return;
    }

    void askAboutImage(question);
  }

  return (
    <main
      className="chat-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {isDraggingImage ? <div className="drop-overlay">Upuść obraz</div> : null}
      <section className="chat-panel" aria-label="Agent Vision">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            👁️
          </div>
          <div>
            <h1>👁️ Agent Vision</h1>
            <p className="agent-description">
              Wklej screenshot, wrzuć plik lub przeciągnij obraz
            </p>
          </div>
        </header>

        <input
          accept="image/*"
          hidden
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />

        {!attachedImage ? (
          <button
            className="vision-drop-zone"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <span>📸 Ctrl+V - wklej screenshot</span>
            <span>📁 Kliknij - wybierz plik</span>
            <span>🖱️ Przeciągnij - upuść obraz</span>
          </button>
        ) : (
          <section className="vision-workspace">
            <div className="vision-preview">
              <img alt={attachedImage.name} src={attachedImage.dataUrl} />
              <button onClick={() => setAttachedImage(null)} type="button">
                ×
              </button>
            </div>

            <div className="example-questions" aria-label="Pytania o obraz">
              {visionQuestions.map((question) => (
                <button
                  disabled={isLoading || isRemixing}
                  key={question}
                  onClick={() => handleQuestion(question)}
                  type="button"
                >
                  {question}
                </button>
              ))}
            </div>

            <form className="composer composer-separated" onSubmit={handleSubmit}>
              <input
                aria-label="Pytanie o obraz"
                disabled={isLoading}
                onChange={(event) => setInput(event.target.value)}
                onPaste={handlePaste}
                placeholder="Zadaj pytanie o obraz..."
                value={input}
              />
              <button disabled={isLoading || !input.trim()} type="submit">
                Analizuj
              </button>
            </form>

            <div className="messages vision-messages" aria-live="polite">
              {messages.map((message) => (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble">
                    {messageText(message.parts) ||
                      (message.role === 'assistant' ? 'Analizuję...' : '')}
                  </div>
                </article>
              ))}

              {isLoading && messages.at(-1)?.role !== 'assistant' ? (
                <article className="message-row assistant">
                  <div className="message-bubble thinking">Analizuję...</div>
                </article>
              ) : null}

              <div ref={bottomRef} />
            </div>

            {isRemixing ? (
              <div className="image-placeholder">Generuję... (5-15 sekund)</div>
            ) : null}

            {remixResult ? (
              <div className="vision-remix">
                <div>
                  <h2>Oryginał</h2>
                  <img alt="Oryginał" src={attachedImage.dataUrl} />
                </div>
                <div>
                  <h2>Nowa wersja</h2>
                  <img alt="Nowa wersja" src={remixResult.image} />
                </div>
                <p>{remixResult.prompt}</p>
              </div>
            ) : null}
          </section>
        )}

        {imageError ? <div className="error-message">{imageError}</div> : null}
        {error ? (
          <div className="error-message">
            Nie udało się pobrać odpowiedzi.
            {errorMessage ? ` Szczegóły: ${errorMessage}` : ''}
          </div>
        ) : null}
        {remixError ? <div className="error-message">{remixError}</div> : null}
      </section>
    </main>
  );
}
