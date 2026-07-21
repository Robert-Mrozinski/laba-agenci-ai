import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmbedding } from './embeddings';
import { supabase } from './supabase';

export type KnowledgeSearchRow = {
  title: string | null;
  content: string | null;
  metadata?: Record<string, unknown> | null;
  similarity: number | null;
};

export type KnowledgeSearchResult = {
  added_at: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  title: string;
};

export function shouldSearchKnowledge(text: string) {
  const normalizedText = text.toLowerCase();
  const knowledgeKeywords = [
    'abonament',
    'anulować',
    'anulowanie',
    'cena',
    'cennik',
    'co zawiera',
    'faq',
    'ile kosztuje',
    'koszt',
    'oferta',
    'pakiet',
    'premium',
    'procedura',
    'regulamin',
    'rezygnacja',
    'subskrypcja',
    'warunki',
    'vip',
  ];

  return knowledgeKeywords.some((keyword) => normalizedText.includes(keyword));
}

export async function searchKnowledgeBase(
  query: string,
  userId?: string,
  supabaseClient: SupabaseClient | null = supabase,
) {
  const cleanQuery = query.trim().slice(0, 500);

  if (!supabaseClient) {
    return {
      results: [] as KnowledgeSearchResult[],
      source_documents: [] as string[],
      total_found: 0,
      message:
        'Nie mogę przeszukać bazy wiedzy, bo Supabase nie jest skonfigurowane.',
    };
  }

  if (!cleanQuery) {
    return {
      results: [] as KnowledgeSearchResult[],
      source_documents: [] as string[],
      total_found: 0,
      message: 'Nie podano zapytania do bazy wiedzy.',
    };
  }

  const embedding = await createEmbedding(cleanQuery);
  const { data, error } = await supabaseClient.rpc('match_documents', {
    query_embedding: embedding,
    match_count: 5,
  });

  if (error) {
    return {
      results: [] as KnowledgeSearchResult[],
      source_documents: [] as string[],
      total_found: 0,
      message: `Nie udało się przeszukać bazy wiedzy: ${error.message}`,
    };
  }

  const rawResults = ((data ?? []) as KnowledgeSearchRow[])
    .map((item) => ({
      added_at: metadataString(item.metadata, 'added_at'),
      title: item.title ?? 'Dokument bez tytułu',
      content: item.content ?? '',
      metadata: item.metadata ?? {},
      similarity: Number(item.similarity?.toFixed(3) ?? 0),
    }))
    .filter((item) => item.content.trim())
    .filter((item) => !userId || item.metadata.user_id === userId)
    .filter((item) => hasLexicalMatch(cleanQuery, item))
    .slice(0, 3);
  const results = await hydrateAddedAt(rawResults, userId, supabaseClient);
  const sourceDocuments = Array.from(new Set(results.map((result) => result.title)));

  if (results.length === 0) {
    return {
      results,
      source_documents: [],
      total_found: 0,
      message: 'Nie znaleziono informacji w bazie wiedzy.',
    };
  }

  return {
    results,
    source_documents: sourceDocuments,
    total_found: results.length,
  };
}

export function answerFromKnowledge(results: KnowledgeSearchResult[]) {
  const joinedContent = results.map((result) => result.content).join('\n\n');

  if (!joinedContent.trim()) {
    return knowledgeNotFoundMessage();
  }

  const sourceDocuments = Array.from(new Set(results.map((result) => result.title)));
  const citationLabel = sourceDocuments.length === 1 ? 'Źródło' : 'Źródła';

  return [
    joinedContent,
    '',
    `📎 ${citationLabel}: ${sourceDocuments.join(', ')}`,
  ].join('\n');
}

export function knowledgeNotFoundMessage() {
  return [
    'Nie mam informacji na ten temat w mojej bazie wiedzy.',
    'Skontaktuj się z Costa Broker bezpośrednio.',
    '',
    'Mogę za to odpowiedzieć na pytania o cennik, pakiety i warunki usługi.',
  ].join('\n');
}

function knowledgeTokens(text: string) {
  const stopWords = new Set([
    'albo',
    'bardzo',
    'bez',
    'byc',
    'być',
    'chce',
    'chcę',
    'cie',
    'cię',
    'co',
    'czy',
    'dane',
    'dla',
    'do',
    'dzien',
    'dzień',
    'dzis',
    'dziś',
    'gdzie',
    'go',
    'ich',
    'ile',
    'informacje',
    'informacji',
    'jak',
    'jaka',
    'jakie',
    'jaki',
    'jakim',
    'jakis',
    'jakiś',
    'jako',
    'jest',
    'ktora',
    'ktore',
    'które',
    'który',
    'ktory',
    'kosztuje',
    'koszt',
    'koszty',
    'maja',
    'mają',
    'ma',
    'mam',
    'mnie',
    'moje',
    'mojej',
    'mogę',
    'moge',
    'na',
    'nad',
    'nie',
    'oraz',
    'po',
    'pod',
    'podaj',
    'pokaz',
    'pokaż',
    'prosze',
    'proszę',
    'przez',
    'sa',
    'są',
    'pakiet',
    'się',
    'sie',
    'ten',
    'tego',
    'tej',
    'temat',
    'tym',
    'tym',
    'twojej',
    'twoim',
    'w',
    'we',
    'wedlug',
    'według',
    'wiedzy',
    'za',
    'z',
    'zawiera',
    'znajduje',
  ]);

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function hasLexicalMatch(query: string, result: KnowledgeSearchResult) {
  const tokens = knowledgeTokens(query);
  const genericDomainTokens = new Set([
    'cena',
    'ceny',
    'cennik',
    'costa',
    'broker',
    'dokument',
    'faq',
    'firma',
    'firmy',
    'hiszpania',
    'hiszpanii',
    'kosztow',
    'kosztów',
    'oferta',
    'ofercie',
    'pytanie',
    'regulamin',
    'usluga',
    'usługa',
    'uslugi',
    'usługi',
    'warunki',
  ]);
  const distinctiveTokens = tokens.filter((token) => !genericDomainTokens.has(token));

  if (tokens.length === 0) {
    return result.similarity >= 0.42;
  }

  const haystack = `${result.title} ${result.content}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (distinctiveTokens.length > 0) {
    return distinctiveTokens.some((token) => haystack.includes(token));
  }

  return tokens.some((token) => haystack.includes(token)) && result.similarity >= 0.42;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

async function hydrateAddedAt(
  results: KnowledgeSearchResult[],
  userId?: string,
  supabaseClient: SupabaseClient | null = supabase,
) {
  if (!supabaseClient || results.length === 0) {
    return results;
  }

  return Promise.all(
    results.map(async (result) => {
      if (result.added_at) {
        return result;
      }

      let query = supabaseClient
        .from('documents')
        .select('created_at')
        .eq('title', result.title)
        .eq('content', result.content);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data } = await query.maybeSingle();

      return {
        ...result,
        added_at:
          typeof data?.created_at === 'string'
            ? data.created_at
            : metadataString(result.metadata, 'created_at'),
      };
    }),
  );
}
