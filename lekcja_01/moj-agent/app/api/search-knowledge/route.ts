import { NextResponse } from 'next/server';
import { searchKnowledgeBase } from '../../../lib/knowledge';
import { formatAiError } from '../errorMessages';

export async function POST(req: Request) {
  try {
    const { query }: { query?: string } = await req.json();
    const trimmedQuery = query?.trim();

    if (!trimmedQuery) {
      return NextResponse.json({ error: 'Podaj pytanie do wyszukania.' }, { status: 400 });
    }

    return NextResponse.json(await searchKnowledgeBase(trimmedQuery));
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się przeszukać bazy wiedzy.'),
      },
      { status: 500 },
    );
  }
}
