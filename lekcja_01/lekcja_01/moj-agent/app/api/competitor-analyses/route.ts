import { NextResponse } from 'next/server';
import { getRequestUser } from '../../../lib/auth';
import { splitIntoChunks } from '../../../lib/chunking';
import { createEmbedding } from '../../../lib/embeddings';
import { formatAiError } from '../errorMessages';

type AnalysisSource = {
  title?: string;
  url: string;
};

type DocumentAnalysisRow = {
  content: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
  title: string | null;
};

function isAnalysisSource(value: unknown): value is AnalysisSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    'url' in value &&
    typeof (value as { url?: unknown }).url === 'string'
  );
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
  return Array.isArray(value) ? value.filter(isAnalysisSource) : [];
}

function analysisTitle(companies: string[], content: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();

  if (heading) {
    return heading.replace(/^🏢\s*/, '').slice(0, 160);
  }

  return `Analiza: ${companies.join(' vs ')}`.slice(0, 160);
}

function analysesFromDocuments(rows: DocumentAnalysisRow[]) {
  const grouped = new Map<
    string,
    {
      chunks: DocumentAnalysisRow[];
      companies: string[];
      context: string;
      created_at: string;
      sources: AnalysisSource[];
      title: string;
    }
  >();

  for (const row of rows) {
    if (row.metadata?.kind !== 'competitor_analysis' || !row.title || !row.content) {
      continue;
    }

    const existing = grouped.get(row.title);
    const createdAt =
      metadataString(row.metadata, 'added_at') || row.created_at || new Date(0).toISOString();
    const metadataCompanies = row.metadata.companies;
    const companies = Array.isArray(metadataCompanies)
      ? metadataCompanies.filter((company): company is string => typeof company === 'string')
      : [];

    if (existing) {
      existing.chunks.push(row);
      if (new Date(createdAt) > new Date(existing.created_at)) {
        existing.created_at = createdAt;
      }
      continue;
    }

    grouped.set(row.title, {
      chunks: [row],
      companies,
      context: metadataString(row.metadata, 'analysis_context'),
      created_at: createdAt,
      sources: metadataSources(row.metadata),
      title: row.title,
    });
  }

  return Array.from(grouped.values()).map((analysis) => ({
    companies: analysis.companies,
    content: analysis.chunks
      .sort(
        (left, right) =>
          metadataNumber(left.metadata, 'chunk_index') -
          metadataNumber(right.metadata, 'chunk_index'),
      )
      .map((chunk) => chunk.content)
      .join('\n\n'),
    context: analysis.context,
    created_at: analysis.created_at,
    id: `documents:${analysis.title}`,
    sources: analysis.sources,
    title: analysis.title,
  }));
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

    const { data, error } = await supabase
      .from('documents')
      .select('title, content, metadata, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const analyses = analysesFromDocuments((data ?? []) as DocumentAnalysisRow[]).sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );

    return NextResponse.json({ analyses });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się wczytać zapisanych analiz.'),
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
      companies?: unknown;
      content?: unknown;
      context?: unknown;
      sources?: unknown;
    } = await req.json();
    const companies = Array.isArray(body.companies)
      ? body.companies
          .filter((company): company is string => typeof company === 'string')
          .map((company) => company.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const context = typeof body.context === 'string' ? body.context.trim() : '';
    const sources = Array.isArray(body.sources)
      ? body.sources.filter(isAnalysisSource).map((source) => ({
          title: source.title?.slice(0, 240),
          url: source.url,
        }))
      : [];

    if (companies.length !== 3 || !content) {
      return NextResponse.json(
        { error: 'Brakuje trzech firm albo treści analizy.' },
        { status: 400 },
      );
    }

    const title = `${analysisTitle(companies, content)} (${new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date())})`;
    const chunks = splitIntoChunks(content);
    const addedAt = new Date().toISOString();

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await createEmbedding(chunk);
      const { error } = await supabase.from('documents').insert({
        content: chunk,
        embedding,
        metadata: {
          added_at: addedAt,
          analysis_context: context,
          companies,
          kind: 'competitor_analysis',
          source: title,
          sources,
          chunk_index: index,
          total_chunks: chunks.length,
          user_id: user.id,
        },
        title,
        user_id: user.id,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.json({
      analysis: {
        chunks_saved: chunks.length,
        title,
      },
      saved: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: formatAiError(error, 'Nie udało się zapisać analizy.'),
      },
      { status: 500 },
    );
  }
}
