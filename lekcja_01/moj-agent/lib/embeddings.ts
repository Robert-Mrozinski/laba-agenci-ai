export type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
  embeddings?: Array<{
    values?: number[];
  }>;
  error?: {
    message?: string;
  };
};

export async function createEmbedding(text: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const embeddingModel = process.env.GOOGLE_EMBEDDING_MODEL ?? 'gemini-embedding-2';
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error('Tekst do embeddingu jest pusty.');
  }

  if (!apiKey) {
    throw new Error('Brakuje GOOGLE_GENERATIVE_AI_API_KEY lub GOOGLE_API_KEY w pliku .env.local.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: trimmedText }],
        },
        output_dimensionality: 768,
      }),
    },
  );

  const data = (await response.json()) as GeminiEmbeddingResponse;

  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? 'Nie udało się wygenerować embeddingu.');
  }

  const embedding = data.embeddings?.[0]?.values ?? data.embedding?.values;

  if (!embedding?.length) {
    throw new Error('Google API nie zwróciło wektora embeddingu.');
  }

  return embedding;
}
