'use client';

import { FormEvent, useState } from 'react';

const examplePrompts = [
  'Post Costa Broker: luksusowy apartament w Hiszpanii, użyj logo Costa Broker',
  'Minimalistyczne logo kawiarni w stylu japońskim',
  'Post na Instagram: kawa latte art, ciepłe światło, widok z góry',
  'Kreacja reklamowa: wyprzedaż letnia -50%, nowoczesny design',
  'Ikona aplikacji: robot AI, gradient fioletowo-niebieski, flat design',
  'Infografika: 5 kroków do produktywności, pastelowe kolory',
  'Zdjęcie produktowe: elegancki zegarek na ciemnym tle',
];

type ImageResult = {
  image: string;
  text: string;
};

export default function GeneratePage() {
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [result, setResult] = useState<ImageResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function generateImage(nextPrompt = prompt) {
    const trimmedPrompt = nextPrompt.trim();

    if (!trimmedPrompt || isLoading) {
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);
    setLastPrompt(trimmedPrompt);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Nie udało się wygenerować obrazu.');
      }

      setResult({
        image: data.image,
        text: data.text ?? '',
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Nie udało się wygenerować obrazu.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateImage();
  }

  function handleExamplePrompt(examplePrompt: string) {
    setPrompt(examplePrompt);
    void generateImage(examplePrompt);
  }

  function handleDownload() {
    if (!result?.image) {
      return;
    }

    const link = document.createElement('a');
    link.href = result.image;
    link.download = 'ai-generated.png';
    link.click();
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Generator grafik AI">
        <header className="chat-header">
          <div className="bot-mark" aria-hidden="true">
            🎨
          </div>
          <div>
            <h1>🎨 Generator grafik AI</h1>
            <p className="agent-description">
              Opisz co chcesz - AI stworzy obraz w kilka sekund
            </p>
            <p className="agent-description">
              Logo Costa Broker jest zapisane w pamięci generatora dla materiałów firmowych.
            </p>
            <div className="example-questions" aria-label="Przykładowe prompty">
              {examplePrompts.map((examplePrompt) => (
                <button
                  disabled={isLoading}
                  key={examplePrompt}
                  onClick={() => handleExamplePrompt(examplePrompt)}
                  type="button"
                >
                  {examplePrompt}
                </button>
              ))}
            </div>
          </div>
        </header>

        <form className="generate-form" onSubmit={handleSubmit}>
          <textarea
            aria-label="Opis obrazu"
            disabled={isLoading}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Opisz obraz który chcesz wygenerować..."
            value={prompt}
          />
          <button disabled={isLoading || !prompt.trim()} type="submit">
            🎨 Generuj
          </button>
        </form>

        <section className="generate-result" aria-live="polite">
          {isLoading ? (
            <div className="image-placeholder">Generuję... (5-15 sekund)</div>
          ) : null}

          {error ? <div className="error-message">{error}</div> : null}

          {result ? (
            <div className="generated-image-wrap">
              <img alt={lastPrompt} src={result.image} />
              {result.text ? <p>{result.text}</p> : null}
              <div className="generate-actions">
                <button onClick={handleDownload} type="button">
                  💾 Pobierz
                </button>
                <button
                  disabled={!lastPrompt || isLoading}
                  onClick={() => generateImage(lastPrompt)}
                  type="button"
                >
                  🔄 Ponownie
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
