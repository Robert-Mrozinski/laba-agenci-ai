import { readFile } from 'node:fs/promises';
import path from 'node:path';

type GenerateImageBody = {
  prompt?: string;
};

export const runtime = 'nodejs';

const brandLogoPath = path.join(
  process.cwd(),
  'public',
  'brand',
  'costa-broker-logo.png',
);

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function friendlyGoogleError(message: string, status: number) {
  const isQuotaError =
    status === 429 ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('spending cap') ||
    message.toLowerCase().includes('resource_exhausted') ||
    message.toLowerCase().includes('rate-limit');

  if (isQuotaError) {
    const retryMatch = message.match(/retry in ([\d.]+)s/i);
    const retryText = retryMatch?.[1]
      ? ` Spróbuj ponownie za około ${Math.ceil(Number(retryMatch[1]))} sekund.`
      : '';

    return {
      error:
        'Google API odrzuciło generowanie obrazu, bo obecny projekt ma wyczerpany albo zerowy limit. Sprawdź limity w Google AI Studio, zwiększ miesięczny limit wydatków albo użyj innego klucza API.' +
        retryText,
      status: 429,
    };
  }

  return {
    error: message || `Google API zwróciło błąd HTTP ${status}.`,
    status: 500,
  };
}

function fetchWithTimeout(url: string, init: RequestInit, milliseconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), milliseconds);

  return fetch(url, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}

async function getCostaBrokerLogoPart() {
  try {
    const logo = await readFile(brandLogoPath);

    return {
      inlineData: {
        data: logo.toString('base64'),
        mimeType: 'image/png',
      },
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { prompt }: GenerateImageBody = await req.json();
  const trimmedPrompt = prompt?.trim();

  if (!trimmedPrompt) {
    return Response.json(
      { error: 'Podaj opis obrazu do wygenerowania.' },
      { status: 400 },
    );
  }

  const apiKey =
    process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return Response.json(
      {
        error:
          'Brakuje GOOGLE_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY w pliku .env.local.',
      },
      { status: 500 },
    );
  }

  try {
    const imageModel =
      process.env.GOOGLE_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';
    const logoPart = await getCostaBrokerLogoPart();
    const brandPrompt = [
      'Masz w pamięci brand Costa Broker i załączony plik logo jako referencję.',
      'Jeśli użytkownik prosi o grafikę dla Costa Broker, nieruchomości w Hiszpanii, materiały reklamowe firmy albo użycie logo, korzystaj z załączonego logo Costa Broker jako elementu identyfikacji wizualnej.',
      'Jeśli na grafice pojawia się adres strony Costa Broker, użyj dokładnie tekstu: costabroker.com',
      'Nie zmieniaj napisu ani proporcji logo. Umieszczaj je czytelnie, z dobrym kontrastem i bez zasłaniania ważnych treści.',
      `Opis użytkownika: ${trimmedPrompt}`,
    ].join(' ');
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: brandPrompt },
                ...(logoPart ? [logoPart] : []),
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      },
      30000,
    );

    const data: GeminiImageResponse = await response.json();

    if (!response.ok) {
      const googleError = friendlyGoogleError(
        data.error?.message ?? '',
        response.status,
      );

      return Response.json(
        { error: googleError.error },
        { status: googleError.status },
      );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    const textPart = parts.find((part) => part.text);

    if (!imagePart?.inlineData?.data) {
      return Response.json(
        { error: 'Model nie zwrócił obrazu. Spróbuj doprecyzować opis.' },
        { status: 500 },
      );
    }

    const mimeType = imagePart.inlineData.mimeType ?? 'image/png';

    return Response.json({
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      text: textPart?.text ?? '',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return Response.json(
        { error: 'Generowanie przekroczyło limit 30 sekund.' },
        { status: 500 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Nie udało się wygenerować obrazu.';

    return Response.json(
      { error: `Błąd generowania obrazu: ${message}` },
      { status: 500 },
    );
  }
}
