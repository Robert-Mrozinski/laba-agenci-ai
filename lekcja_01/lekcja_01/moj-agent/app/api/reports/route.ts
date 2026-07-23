import { NextResponse } from 'next/server';
import { getRequestUser } from '../../../lib/auth';
import { splitIntoChunks } from '../../../lib/chunking';
import { createEmbedding } from '../../../lib/embeddings';
import { formatAiError } from '../errorMessages';

type ReportSource = {
  title?: string;
  url: string;
};

type DocumentReportRow = {
  content: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  title: string | null;
};

function isReportSource(value: unknown): value is ReportSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

function reportTitle(topic: string, content: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (heading) {
    return heading.replace(/^📊\s*/, '').slice(0, 160);
  }

  return topic.slice(0, 160);
}

function metadataNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' ? value : 0;
}

function metadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

function metadataSources(metadata: Record<string, unknown> | null) {
  const value = metadata?.sources;
  return Array.isArray(value) ? value.filter(isReportSource) : [];
}

function reportsFromDocuments(rows: DocumentReportRow[]) {
  const grouped = new Map<
    string,
    {
      chunks: DocumentReportRow[];
      created_at: string;
      sources: ReportSource[];
      title: string;
      topic: string;
    }
  >();

  for (const row of rows) {
    if (row.metadata?.kind !== 'report' || !row.title || !row.content) {
      continue;
    }

    const existing = grouped.get(row.title);
    const createdAt =
      metadataString(row.metadata, 'added_at') || row.created_at || new Date(0).toISOString();

    if (existing) {
      existing.chunks.push(row);
      if (new Date(createdAt) > new Date(existing.created_at)) {
        existing.created_at = createdAt;
      }
      continue;
    }

    grouped.set(row.title, {
      chunks: [row],
      created_at: createdAt,
      sources: metadataSources(row.metadata),
      title: row.title,
      topic: metadataString(row.metadata, 'report_topic') || row.title,
    });
  }

  return Array.from(grouped.values()).map((report) => ({
    content: report.chunks
      .sort(
        (left, right) =>
          metadataNumber(left.metadata, 'chunk_index') -
          metadataNumber(right.metadata, 'chunk_index'),
      )
      .map((chunk) => chunk.content)
      .join('\n\n'),
    created_at: report.created_at,
    id: `documents:${report.title}`,
    sources: report.sources,
    storage: 'documents',
    title: report.title,
    topic: report.topic,
  }));
}

async function saveReportToDocuments({
  content,
  sources,
  supabase,
  title,
  topic,
  userId,
}: {
  content: string;
  sources: ReportSource[];
  supabase: NonNullable<Awaited<ReturnType<typeof getRequestUser>>['supabase']>;
  title: string;
  topic: string;
  userId: string;
}) {
  const chunks = splitIntoChunks(content);
  const addedAt = new Date().toISOString();
  const documentTitle = `${title} (${new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date())})`;

  if (chunks.length === 0) {
    throw new Error('Nie udało się podzielić raportu na fragmenty do zapisu.');
  }

  for (const [index, chunk] of chunks.entries()) {
    const embedding = await createEmbedding(chunk);
    const { error } = await supabase.from('documents').insert({
      content: chunk,
      embedding,
      metadata: {
        added_at: addedAt,
        kind: 'report',
        report_topic: topic,
        source: documentTitle,
        sources,
        chunk_index: index,
        total_chunks: chunks.length,
        user_id: userId,
      },
      title: documentTitle,
      user_id: userId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    chunks_saved: chunks.length,
    title: documentTitle,
  };
}

export async function GET(req: Request) {
  try {
    const {
      error: authError,
      supabase,
      user,
    } = await getRequestUser(req);

    if (authError || !user || !supabase) {
      return NextResponse.json({ error: authError }, { status: 401 });
    }

    const savedReports = [];
    const reportsResult = await supabase
      .from('reports')
      .select('id, title, topic, content, sources, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!reportsResult.error) {
      savedReports.push(
        ...((reportsResult.data ?? []) as Array<{
          content: string;
          created_at: string;
          id: string;
          sources: ReportSource[];
          title: string;
          topic: string;
        }>).map((report) => ({
          ...report,
          storage: 'reports',
        })),
      );
    }

    const documentsResult = await supabase
      .from('documents')
      .select('title, content, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (documentsResult.error) {
      return NextResponse.json(
        { error: documentsResult.error.message },
        { status: 500 },
      );
    }

    savedReports.push(
      ...reportsFromDocuments((documentsResult.data ?? []) as DocumentReportRow[]),
    );

    savedReports.sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );

    return NextResponse.json({ reports: savedReports });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się wczytać zapisanych raportów.'),
      },
      { status: 500 },
    );
  }
}

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

    const body: {
      content?: unknown;
      sources?: unknown;
      topic?: unknown;
    } = await req.json();
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const sources = Array.isArray(body.sources)
      ? body.sources.filter(isReportSource).map((source) => ({
          title: source.title?.slice(0, 240),
          url: source.url,
        }))
      : [];

    if (!topic || !content) {
      return NextResponse.json(
        { error: 'Brakuje tematu albo treści raportu.' },
        { status: 400 },
      );
    }

    const title = reportTitle(topic, content);
    const { data, error } = await supabase
      .from('reports')
      .insert({
        content,
        sources,
        title,
        topic,
        user_id: user.id,
      })
      .select('id, created_at')
      .single();

    if (error) {
      const missingTable =
        error.message.includes('reports') || error.message.includes('schema cache');

      if (!missingTable) {
        return NextResponse.json(
          {
            code: 'REPORT_SAVE_FAILED',
            error: error.message,
          },
          { status: 500 },
        );
      }

      const fallbackDocument = await saveReportToDocuments({
        content,
        sources,
        supabase,
        title,
        topic,
        userId: user.id,
      });

      return NextResponse.json({
        fallback: 'documents',
        report: fallbackDocument,
        saved: true,
      });
    }

    return NextResponse.json({ report: data, saved: true, storage: 'reports' });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się zapisać raportu.'),
      },
      { status: 500 },
    );
  }
}
