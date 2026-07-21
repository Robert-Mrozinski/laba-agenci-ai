import { NextResponse } from 'next/server';
import { getRequestUser } from '../../../lib/auth';
import { splitIntoChunks } from '../../../lib/chunking';
import { createEmbedding } from '../../../lib/embeddings';
import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { formatAiError } from '../errorMessages';

type KnowledgeDocument = {
  title: string;
  content: string;
  created_at: string | null;
};

type ProgressMessage =
  | {
      type: 'start';
      total: number;
      message: string;
    }
  | {
      type: 'progress';
      current: number;
      total: number;
      message: string;
    }
  | {
      type: 'done';
      chunks_saved: number;
      message: string;
    }
  | {
      type: 'error';
      message: string;
    };

export async function GET(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ documents: [] });
  }

  const {
    error: authError,
    supabase: userSupabase,
    user,
  } = await getRequestUser(req);

  if (authError || !user || !userSupabase) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const url = new URL(req.url);
  const title = url.searchParams.get('title')?.trim();

  if (title) {
    const { data, error } = await userSupabase
      .from('documents')
      .select('title, content, metadata, created_at')
      .eq('title', title)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chunks: data ?? [] });
  }

  const { data, error } = await userSupabase
    .from('documents')
    .select('title, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groupedDocuments = new Map<
    string,
    { title: string; chunks: number; created_at: string | null }
  >();

  for (const row of (data ?? []) as KnowledgeDocument[]) {
    const existing = groupedDocuments.get(row.title);

    if (existing) {
      existing.chunks += 1;
      if (
        row.created_at &&
        (!existing.created_at || new Date(row.created_at) > new Date(existing.created_at))
      ) {
        existing.created_at = row.created_at;
      }
      continue;
    }

    groupedDocuments.set(row.title, {
      title: row.title,
      chunks: 1,
      created_at: row.created_at,
    });
  }

  return NextResponse.json({ documents: Array.from(groupedDocuments.values()) });
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  function send(message: ProgressMessage) {
    return encoder.encode(`${JSON.stringify(message)}\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (!isSupabaseConfigured || !supabase) {
          controller.enqueue(
            send({
              type: 'error',
              message:
                'Brakuje konfiguracji Supabase: NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY.',
            }),
          );
          return;
        }

        const {
          error: authError,
          supabase: userSupabase,
          user,
        } = await getRequestUser(req);

        if (authError || !user || !userSupabase) {
          controller.enqueue(
            send({
              type: 'error',
              message: authError ?? 'Musisz się zalogować.',
            }),
          );
          return;
        }

        const { title, content }: { title?: string; content?: string } = await req.json();
        const trimmedTitle = title?.trim();
        const trimmedContent = content?.trim();

        if (!trimmedTitle || !trimmedContent) {
          controller.enqueue(
            send({
              type: 'error',
              message: 'Podaj tytuł i treść dokumentu.',
            }),
          );
          return;
        }

        const chunks = splitIntoChunks(trimmedContent);
        const addedAt = new Date().toISOString();

        if (chunks.length === 0) {
          controller.enqueue(
            send({
              type: 'error',
              message: 'Nie udało się utworzyć fragmentów z podanej treści.',
            }),
          );
          return;
        }

        const { error: deleteExistingError } = await userSupabase
          .from('documents')
          .delete()
          .eq('title', trimmedTitle)
          .eq('user_id', user.id);

        if (deleteExistingError) {
          throw new Error(deleteExistingError.message);
        }

        controller.enqueue(
          send({
            type: 'start',
            total: chunks.length,
            message: `Znaleziono ${chunks.length} fragmentów do zapisania. Stara wersja dokumentu została zastąpiona.`,
          }),
        );

        for (const [index, chunk] of chunks.entries()) {
          const current = index + 1;
          controller.enqueue(
            send({
              type: 'progress',
              current,
              total: chunks.length,
              message: `Przetwarzam fragment ${current} z ${chunks.length}...`,
            }),
          );

          const embedding = await createEmbedding(chunk);
          const { error } = await userSupabase.from('documents').insert({
            title: trimmedTitle,
            content: chunk,
            embedding,
            user_id: user.id,
            metadata: {
              source: trimmedTitle,
              chunk_index: index,
              total_chunks: chunks.length,
              added_at: addedAt,
              user_id: user.id,
            },
          });

          if (error) {
            throw new Error(error.message);
          }
        }

        controller.enqueue(
          send({
            type: 'done',
            chunks_saved: chunks.length,
            message: `Zapisano ${chunks.length} fragmentów!`,
          }),
        );
      } catch (error) {
        controller.enqueue(
          send({
            type: 'error',
            message: formatAiError(error, 'Nieznany błąd podczas zapisu dokumentu.'),
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
  });
}

export async function DELETE(req: Request) {
  try {
    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json(
        {
          error:
            'Brakuje konfiguracji Supabase: NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        },
        { status: 500 },
      );
    }

    const {
      error: authError,
      supabase: userSupabase,
      user,
    } = await getRequestUser(req);

    if (authError || !user || !userSupabase) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const { title }: { title?: string } = await req.json();
    const trimmedTitle = title?.trim();

    if (!trimmedTitle) {
      return NextResponse.json({ error: 'Podaj tytuł dokumentu do usunięcia.' }, { status: 400 });
    }

    const { error } = await userSupabase
      .from('documents')
      .delete()
      .eq('title', trimmedTitle)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Nie udało się usunąć dokumentu.',
      },
      { status: 500 },
    );
  }
}
