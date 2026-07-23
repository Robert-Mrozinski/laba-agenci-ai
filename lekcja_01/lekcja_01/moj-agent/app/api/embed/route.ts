import { NextResponse } from 'next/server';
import { createEmbedding } from '../../../lib/embeddings';
import { formatAiError } from '../errorMessages';

export async function POST(req: Request) {
  try {
    const { text }: { text?: string } = await req.json();
    const trimmedText = text?.trim();

    if (!trimmedText) {
      return NextResponse.json({ error: 'Podaj tekst do zamiany na embedding.' }, { status: 400 });
    }

    const embedding = await createEmbedding(trimmedText);
    return NextResponse.json({ embedding });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nieznany błąd podczas generowania embeddingu.'),
      },
      { status: 500 },
    );
  }
}
