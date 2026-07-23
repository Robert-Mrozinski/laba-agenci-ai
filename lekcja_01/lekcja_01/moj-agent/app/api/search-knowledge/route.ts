import { NextResponse } from 'next/server';
import { getRequestUser } from '../../../lib/auth';
import { searchKnowledgeBase } from '../../../lib/knowledge';
import { formatAiError } from '../errorMessages';

export async function POST(req: Request) {
  try {
    const {
      error: authError,
      supabase,
      user,
    } = await getRequestUser(req);

    if (authError || !user || !supabase) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { query }: { query?: string } = await req.json();
    const trimmedQuery = query?.trim();

    if (!trimmedQuery) {
      return NextResponse.json({ error: 'Podaj pytanie do wyszukania.' }, { status: 400 });
    }

    return NextResponse.json(await searchKnowledgeBase(trimmedQuery, user.id, supabase));
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się przeszukać bazy wiedzy.'),
      },
      { status: 500 },
    );
  }
}
