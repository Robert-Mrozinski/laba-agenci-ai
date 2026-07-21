import { google } from '@ai-sdk/google';
import { generateText, isStepCount } from 'ai';
import { formatAiError } from '../errorMessages';

type VisionRemixBody = {
  image?: string;
  instruction?: string;
};

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

async function generateImage(prompt: string, apiKey: string) {
  const imageModel =
    process.env.GOOGLE_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        signal: controller.signal,
      },
    );
    const data: GeminiImageResponse = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error?.message ?? `Google API zwróciło błąd HTTP ${response.status}.`,
      );
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    const textPart = parts.find((part) => part.text);

    if (!imagePart?.inlineData?.data) {
      throw new Error('Model nie zwrócił obrazu.');
    }

    const mimeType = imagePart.inlineData.mimeType ?? 'image/png';

    return {
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      text: textPart?.text ?? '',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const { image, instruction }: VisionRemixBody = await req.json();

  if (!image) {
    return Response.json({ error: 'Dodaj obraz do analizy.' }, { status: 400 });
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
    const promptResult = await generateText({
      model: google('gemini-3.1-flash-lite'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image },
            {
              type: 'text',
              text:
                'Opisz ten obraz jako precyzyjny prompt do generatora obrazów. ' +
                'Zachowaj temat i kompozycję, ale zastosuj instrukcję użytkownika: ' +
                (instruction || 'Wygeneruj podobny obraz w innym stylu.'),
            },
          ],
        },
      ],
      // maxSteps: 3 (AI SDK v7 equivalent)
      stopWhen: isStepCount(3),
    });
    const generated = await generateImage(promptResult.text, apiKey);

    return Response.json({
      image: generated.image,
      prompt: promptResult.text,
      text: generated.text,
    });
  } catch (error) {
    const message = formatAiError(
      error,
      'Nie udało się wygenerować podobnej wersji.',
    );

    return Response.json({ error: message }, { status: 500 });
  }
}
