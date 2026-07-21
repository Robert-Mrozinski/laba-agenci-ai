import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import {
  answerFromKnowledge,
  knowledgeNotFoundMessage,
  searchKnowledgeBase,
  shouldSearchKnowledge,
} from '../../../lib/knowledge';
import { createSupabaseWithToken, supabase } from '../../../lib/supabase';
import { formatAiError } from '../errorMessages';

type AiModel = 'flash' | 'pro';
type ChatMode = 'agent' | 'chat';

const searchGroundingEnabled =
  process.env.ENABLE_SEARCH_GROUNDING === 'true';

if (searchGroundingEnabled) {
  console.warn(
    '⚠️ UWAGA: Search Grounding jest WŁĄCZONY. ' +
      'To jest najdroższa funkcja API ($14/1000 zapytań). ' +
      'Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, ' +
      'bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.',
  );
}

type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string> | null;
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

const models: Record<AiModel, string> = {
  flash: 'gemini-3.1-flash-lite',
  pro: 'gemini-3.1-flash-lite',
};

const personaPrompt = `# Karolina — Ekspert nieruchomości Costa Broker w Hiszpanii

## KIM JESTEM
Jestem doradcą nieruchomości agencji Costa Broker z 10-letnim doświadczeniem w rynku nieruchomości w Hiszpanii.
Specjalizuję się w zakupie nieruchomości przez klientów z Polski, analizie lokalizacji na Costa Blanca i Costa del Sol oraz prowadzeniu klienta przez proces transakcji.
Pracowałam z klientami indywidualnymi, inwestorami kupującymi pod wynajem oraz osobami szukającymi drugiego domu w Hiszpanii.

## JAK ODPOWIADAM

## BRAND COSTA BROKER
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com
- Nie używaj innych wariantów domeny ani spacji w adresie.

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** — potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** — merytoryczna odpowiedź (max 2 akapity)
3. ✅ **Rekomendacja** — konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** — jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie, pytam o kontekst
- Gdy podaję fakty, oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu
- Używam list numerowanych dla kroków, punktowanych dla opcji
- Maksymalnie 3 akapity + rekomendacja
- Jeśli pytanie dotyczy konkretnej transakcji, przypominam, że finalne dokumenty powinien sprawdzić prawnik lub gestor w Hiszpanii

### Styl:
- Język: polski
- Ton: profesjonalny, przystępny i konkretny
- Gdy używam terminu branżowego, wyjaśniam go w nawiasie

## CZEGO NIE ROBIĘ
- Nie odpowiadam na pytania spoza mojej dziedziny — mówię wprost i proponuję, że mogę pomóc w tematach nieruchomości w Hiszpanii
- Nie udaję, że wiem coś, czego nie wiem
- Nie udzielam wiążących porad prawnych, podatkowych ani finansowych; w takich sprawach wskazuję potrzebę konsultacji ze specjalistą
- Nie obiecuję konkretnych wyników inwestycyjnych ani gwarantowanego zwrotu z najmu

## ŹRÓDŁA URZĘDOWE
- Przy pytaniach o przepisy, podatki, zakup nieruchomości, VAT, ITP/AJD, obowiązki fiskalne, Catastro, NIF/VAT albo terminy w Hiszpanii korzystaj z narzędzi urzędowych.
- Najpierw sprawdź właściwe źródło: BOE, AEAT, DGT, EUR-Lex, VIES, Catastro, CENDOJ albo dziennik urzędowy wspólnoty autonomicznej.
- W odpowiedzi podaj źródło, datę sprawdzenia i zaznacz, że finalne dokumenty powinien potwierdzić prawnik, gestor lub asesor fiscal.

## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → "Nie udało się sprawdzić pogody w X. Mogę poszukać w Google lub spróbować innego miasta."
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje

## PAMIĘĆ
- Pamiętasz CAŁĄ rozmowę od początku
- Nawiązuj do wcześniejszych wiadomości gdy to istotne
- Jeśli użytkownik zmienia temat, zaakceptuj to, ale możesz nawiązać do wcześniejszego kontekstu
- Gdy użytkownik powie "podsumuj" lub "co ustaliliśmy", streszczasz CAŁĄ rozmowę w punktach
- Zwracaj się do użytkownika konsekwentnie; jeśli podał imię, używaj go

## KOMENDA "PODSUMUJ"
Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy":
1. Wypisz główne tematy rozmowy
2. Wymień kluczowe ustalenia lub odpowiedzi
3. Zaproponuj, w czym jeszcze możesz pomóc
Format: numerowana lista`;

const fullPowerAgentPrompt = `# Agent AI - Pełna moc

Jesteś uniwersalnym agentem AI z dostępem do narzędzi. Nie jesteś ograniczony do rynku nieruchomości ani persony Karoliny.

## Twoje narzędzia
- calculator: obliczenia matematyczne, procenty, VAT, kwoty netto/brutto
- currentDateTime: aktualna data i czas
- google_search: aktualne informacje z Google
- readWebPage: czytanie i streszczanie stron WWW
- generateImage: generowanie obrazów, logo, grafik social media i ilustracji
- analiza obrazów: gdy użytkownik dołączy screenshot lub zdjęcie
- searchOfficialLegalSources: wyszukiwanie urzędowych źródeł prawnych i podatkowych w Hiszpanii oraz UE
- getBOEDailySummary: dziennik BOE w XML dla konkretnej daty
- checkVIESVatNumber: walidacja numeru VAT UE
- getCatastroByAddress: publiczne dane katastralne po adresie
- getOfficialApiDirectory: katalog oficjalnych API/źródeł: BOE, AEAT, DGT, EUR-Lex, VIES, Catastro, CENDOJ, datos.gob.es

## Jak działasz
- Gdy użytkownik prosi o znalezienie informacji, użyj Google Search.
- Gdy użytkownik poda lub trzeba sprawdzić stronę, użyj readWebPage.
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com
- Gdy pytanie dotyczy przepisów, podatków, nieruchomości w Hiszpanii, faktur, VAT, numerów NIF/VAT, terminów lub obowiązków formalnych, użyj najpierw narzędzi urzędowych i podaj źródła.
- Nie odpowiadaj na pytania prawno-podatkowe wyłącznie z pamięci. Najpierw sprawdź BOE, AEAT, DGT, EUR-Lex, VIES, Catastro albo CENDOJ zależnie od tematu.
- Przy odpowiedziach prawno-podatkowych podaj datę sprawdzenia, źródło i krótką uwagę, że to informacja pomocnicza, a finalną decyzję powinien potwierdzić prawnik, gestor lub asesor fiscal.
- Gdy użytkownik prosi o grafikę, logo, ilustrację albo post wizualny, użyj generateImage.
- Gdy zadanie ma kilka części, wykonaj je po kolei narzędziami zamiast odmawiać.
- Jeśli narzędzie generowania obrazu zwróci błąd limitu/quota, nadal wykonaj resztę zadania: napisz post i podaj prompt do grafiki oraz krótko wyjaśnij, że API obrazu odrzuciło generowanie.
- Odpowiadaj po polsku, konkretnie i praktycznie.
- Przy zadaniach social media zwróć gotowy post, propozycję grafiki/prompt, CTA i hashtagi.
- Nie mów, że nie możesz używać narzędzi, jeśli narzędzie jest dostępne. Po prostu go użyj.

## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → "Nie udało się sprawdzić pogody w X. Mogę poszukać w Google lub spróbować innego miasta."
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje`;

const knowledgeBasePrompt = `# BAZA WIEDZY FIRMY
Masz dostęp do bazy wiedzy firmy przez narzędzie searchKnowledge.

## ZASADY KORZYSTANIA Z BAZY WIEDZY
1. Gdy użytkownik pyta o ceny, pakiety, koszty, ofertę, regulamin, warunki, procedury, FAQ, dokumenty firmy albo usługi firmy — ZAWSZE użyj searchKnowledge jako pierwszego narzędzia.
2. Odpowiadaj na takie pytania TYLKO na podstawie znalezionych fragmentów. Nie dopowiadaj cen, warunków ani procedur z pamięci.
3. Gdy odpowiadasz na podstawie bazy wiedzy, ZAWSZE zakończ odpowiedź cytatem w formacie: "📎 Źródło: [tytuł dokumentu]" albo "📎 Źródła: [tytuły dokumentów]".
4. Jeśli baza wiedzy nie zawiera odpowiedzi, powiedz wprost: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z Costa Broker bezpośrednio."
5. Pytania ogólne obsługuj dotychczasowymi narzędziami. Obliczenia wykonuj kalkulatorem.`;

function profilePrompt(profile: UserProfile | null) {
  if (!profile) {
    return '';
  }

  const preferences = profile.preferences
    ? Object.entries(profile.preferences)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n')
    : '';

  if (profile.name) {
    return [
      `Użytkownik ma na imię ${profile.name}.`,
      'Zwracaj się do niego po imieniu, naturalnie i bez przesady.',
      'To Twój stały użytkownik, więc bądź ciepły, personalny i pamiętaj jego kontekst.',
      preferences ? `Zapamiętane preferencje użytkownika:\n${preferences}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    'To nowy użytkownik. Na początku rozmowy przywitaj się krótko i zapytaj, jak ma na imię.',
    'Gdy użytkownik poda imię, użyj narzędzia saveUserName, żeby zapisać je w Supabase.',
    'Gdy użytkownik powie o swoich preferencjach, użyj saveUserPreference.',
  ].join('\n');
}

function searchGroundingPrompt() {
  return searchGroundingEnabled
    ? 'Search Grounding / google_search jest włączony przez ENABLE_SEARCH_GROUNDING=true. Używaj go oszczędnie, tylko gdy użytkownik potrzebuje aktualnych informacji.'
    : 'Search Grounding / google_search jest wyłączony kosztowo. Nie próbuj używać google_search. Gdy potrzebujesz aktualnych danych, poproś użytkownika o URL albo użyj readWebPage dla podanego adresu.';
}

function messageContentText(content: unknown) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part): part is { text: string; type: string } => {
        return (
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          'text' in part &&
          (part as { type?: unknown }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string'
        );
      })
      .map((part) => part.text)
      .join('\n');
  }

  return '';
}

function addKnowledgeSearchInstruction(text: string) {
  return [
    text,
    'Instrukcja systemowa dla tego pytania: zanim odpowiesz, bezwzględnie wywołaj narzędzie searchKnowledge z treścią pytania. Jeżeli narzędzie nic nie znajdzie, odpowiedz dokładnie: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z Costa Broker bezpośrednio." Nie odpowiadaj z pamięci ogólnej. Jeśli znajdziesz odpowiedź, zakończ ją cytatem "📎 Źródło:" lub "📎 Źródła:".',
  ].join('\n\n');
}

function knowledgeSearchResponse(
  query: string,
  userId?: string,
  supabaseClient?: SupabaseClient | null,
) {
  const stream = createUIMessageStream<UIMessage>({
    execute: async ({ writer }) => {
      const textId = crypto.randomUUID();
      const toolCallId = crypto.randomUUID();

      writer.write({ type: 'start' });
      writer.write({ type: 'start-step' });
      writer.write({
        type: 'tool-input-available',
        toolCallId,
        toolName: 'searchKnowledge',
        input: { query },
      });

      try {
        const searchResult = await searchKnowledgeBase(query, userId, supabaseClient);

        writer.write({
          type: 'tool-output-available',
          toolCallId,
          output: searchResult,
        });

        const answer =
          searchResult.total_found > 0
            ? answerFromKnowledge(searchResult.results)
            : knowledgeNotFoundMessage();

        writer.write({ type: 'text-start', id: textId });
        writer.write({ type: 'text-delta', id: textId, delta: answer });
        writer.write({ type: 'text-end', id: textId });
      } catch (error) {
        const answer = formatAiError(
          error,
          'Nie udało się przeszukać bazy wiedzy.',
        );

        writer.write({
          type: 'tool-output-error',
          toolCallId,
          errorText: answer,
        });
        writer.write({ type: 'text-start', id: textId });
        writer.write({ type: 'text-delta', id: textId, delta: answer });
        writer.write({ type: 'text-end', id: textId });
      }

      writer.write({ type: 'finish-step' });
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

async function loadUserProfile(userId?: string, supabaseClient?: SupabaseClient | null) {
  if (!supabaseClient || !userId) {
    return null;
  }

  const { data } = await supabaseClient
    .from('user_profiles')
    .select('id, name, preferences')
    .eq('id', userId)
    .maybeSingle();

  return data as UserProfile | null;
}

const officialSourceUrls = {
  aeat: 'https://sede.agenciatributaria.gob.es/',
  boe: 'https://www.boe.es/',
  catastro: 'https://www.sedecatastro.gob.es/',
  cendoj: 'https://www.poderjudicial.es/search/',
  datosGob: 'https://datos.gob.es/',
  dgt: 'https://petete.tributos.hacienda.gob.es/consultas/',
  eurlex: 'https://eur-lex.europa.eu/',
  vies: 'https://ec.europa.eu/taxation_customs/vies/',
};

type OfficialSource =
  | 'aeat'
  | 'all'
  | 'boe'
  | 'catastro'
  | 'cendoj'
  | 'datosGob'
  | 'dgt'
  | 'eurlex'
  | 'regional'
  | 'vies';

const regionalOfficialGazettes: Record<string, { name: string; url: string }> = {
  andalucia: { name: 'BOJA - Andalucía', url: 'https://www.juntadeandalucia.es/boja/' },
  aragon: { name: 'BOA - Aragón', url: 'https://www.boa.aragon.es/' },
  asturias: { name: 'BOPA - Asturias', url: 'https://sede.asturias.es/bopa' },
  baleares: { name: 'BOIB - Illes Balears', url: 'https://www.caib.es/eboibfront/' },
  canarias: { name: 'BOC - Canarias', url: 'https://www.gobiernodecanarias.org/boc/' },
  cantabria: { name: 'BOC - Cantabria', url: 'https://boc.cantabria.es/' },
  castillaLaMancha: { name: 'DOCM - Castilla-La Mancha', url: 'https://docm.jccm.es/' },
  castillaLeon: { name: 'BOCyL - Castilla y León', url: 'https://bocyl.jcyl.es/' },
  catalunya: { name: 'DOGC - Catalunya', url: 'https://dogc.gencat.cat/' },
  comunitatValenciana: { name: 'DOGV - Comunitat Valenciana', url: 'https://dogv.gva.es/' },
  extremadura: { name: 'DOE - Extremadura', url: 'https://doe.juntaex.es/' },
  galicia: { name: 'DOG - Galicia', url: 'https://www.xunta.gal/diario-oficial-galicia' },
  madrid: { name: 'BOCM - Comunidad de Madrid', url: 'https://www.bocm.es/' },
  murcia: { name: 'BORM - Región de Murcia', url: 'https://www.borm.es/' },
  navarra: { name: 'BON - Navarra', url: 'https://bon.navarra.es/' },
  paisVasco: { name: 'BOPV - País Vasco', url: 'https://www.euskadi.eus/bopv2/' },
  rioja: { name: 'BOR - La Rioja', url: 'https://web.larioja.org/bor-portada' },
};

function extractReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

function calculateExpression(expression: string) {
  if (/(import|require|eval|process)/i.test(expression)) {
    throw new Error('Wyrażenie zawiera niedozwolone znaki.');
  }

  if (!/^[\d\s()+\-*/.,%]+$/.test(expression)) {
    throw new Error('Kalkulator przyjmuje tylko liczby i operatory matematyczne.');
  }

  const normalizedExpression = expression
    .replace(/,/g, '.')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  const result = Function(`"use strict"; return (${normalizedExpression});`)();

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Nie udało się obliczyć wyrażenia.');
  }

  return result;
}

function stripXml(xml: string) {
  return xml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<[^:>]*:?${tagName}>([\\s\\S]*?)<\\/[^:>]*:?${tagName}>`, 'i'));
  return match?.[1]
    ?.replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function fetchTextWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 5000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();

    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

function boeDailySummaryUrl(date: string) {
  return `https://www.boe.es/diario_boe/xml.php?id=BOE-S-${date.replace(/-/g, '')}`;
}

function officialSearchUrls(query: string, source: OfficialSource, region?: string) {
  const encodedQuery = encodeURIComponent(query);
  const googleQuery = (site: string) =>
    `https://www.google.com/search?q=${encodeURIComponent(`site:${site} ${query}`)}`;
  const urls = {
    aeat: {
      label: 'AEAT - Agencia Tributaria',
      url: googleQuery('sede.agenciatributaria.gob.es'),
      baseUrl: officialSourceUrls.aeat,
    },
    boe: {
      label: 'BOE - legislación y diario oficial',
      url: `https://www.boe.es/buscar/index.php?campo%5B0%5D=TITULO&dato%5B0%5D=${encodedQuery}`,
      baseUrl: officialSourceUrls.boe,
    },
    catastro: {
      label: 'Catastro - sede electrónica',
      url: googleQuery('sedecatastro.gob.es'),
      baseUrl: officialSourceUrls.catastro,
    },
    cendoj: {
      label: 'CENDOJ - jurisprudencia',
      url: googleQuery('poderjudicial.es/search'),
      baseUrl: officialSourceUrls.cendoj,
    },
    datosGob: {
      label: 'datos.gob.es - catálogo nacional de datos abiertos',
      url: `https://datos.gob.es/es/catalogo?texto=${encodedQuery}`,
      baseUrl: officialSourceUrls.datosGob,
    },
    dgt: {
      label: 'DGT - consultas tributarias',
      url: googleQuery('petete.tributos.hacienda.gob.es/consultas'),
      baseUrl: officialSourceUrls.dgt,
    },
    eurlex: {
      label: 'EUR-Lex - derecho UE',
      url: `https://eur-lex.europa.eu/search.html?text=${encodedQuery}&scope=EURLEX&type=quick&qid=${Date.now()}`,
      baseUrl: officialSourceUrls.eurlex,
    },
    vies: {
      label: 'VIES - walidacja VAT UE',
      url: officialSourceUrls.vies,
      baseUrl: officialSourceUrls.vies,
    },
  };

  if (source === 'regional') {
    const selectedRegion = region
      ? regionalOfficialGazettes[region] ??
        Object.entries(regionalOfficialGazettes).find(([key, value]) =>
          `${key} ${value.name}`.toLowerCase().includes(region.toLowerCase()),
        )?.[1]
      : undefined;

    return selectedRegion
      ? [
          {
            label: selectedRegion.name,
            url: googleQuery(new URL(selectedRegion.url).hostname),
            baseUrl: selectedRegion.url,
          },
        ]
      : Object.values(regionalOfficialGazettes).map((item) => ({
          label: item.name,
          url: googleQuery(new URL(item.url).hostname),
          baseUrl: item.url,
        }));
  }

  if (source === 'all') {
    return [
      urls.boe,
      urls.aeat,
      urls.dgt,
      urls.eurlex,
      urls.cendoj,
      urls.catastro,
      urls.datosGob,
      urls.vies,
    ];
  }

  return [urls[source]];
}

async function generateImageFromPrompt(prompt: string) {
  const apiKey =
    process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return {
      error:
        'Brakuje GOOGLE_API_KEY lub GOOGLE_GENERATIVE_AI_API_KEY w pliku .env.local.',
    };
  }

  const imageModel =
    process.env.GOOGLE_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const brandedPrompt = [
      'Jeśli grafika dotyczy Costa Broker albo zawiera adres strony Costa Broker, użyj dokładnie tekstu: costabroker.com',
      prompt,
    ].join('\n\n');
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
              parts: [{ text: brandedPrompt }],
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
      return {
        error:
          data.error?.message ??
          `Google API zwróciło błąd HTTP ${response.status}.`,
      };
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    const textPart = parts.find((part) => part.text);

    if (!imagePart?.inlineData?.data) {
      return { error: 'Model nie zwrócił obrazu.' };
    }

    return {
      image: `data:${imagePart.inlineData.mimeType ?? 'image/png'};base64,${
        imagePart.inlineData.data
      }`,
      text: textPart?.text ?? '',
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Nie udało się wygenerować obrazu.',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const {
    accessToken,
    image,
    messages,
    model = 'flash',
    mode = 'chat',
  }: {
    accessToken?: string;
    image?: string;
    messages: UIMessage[];
    mode?: ChatMode;
    model?: AiModel;
  } =
    await req.json();
  const selectedModel: AiModel = model in models ? model : 'flash';
  const selectedMode: ChatMode = mode === 'agent' ? 'agent' : 'chat';
  const {
    data: { user },
  } =
    supabase && accessToken
      ? await supabase.auth.getUser(accessToken)
      : { data: { user: null } };

  if (!user) {
    return new Response('Musisz się zalogować.', { status: 401 });
  }

  const authenticatedUserId = user.id;
  const authenticatedSupabase = createSupabaseWithToken(accessToken!);
  const userProfile = await loadUserProfile(authenticatedUserId, authenticatedSupabase);
  const systemPrompt = [
    selectedMode === 'agent' ? fullPowerAgentPrompt : personaPrompt,
    knowledgeBasePrompt,
    searchGroundingPrompt(),
    profilePrompt(userProfile),
  ]
    .filter(Boolean)
    .join('\n\n## PERSONALIZACJA\n');
  const modelMessages = await convertToModelMessages(messages);

  const lastMessage = modelMessages.at(-1);
  const lastMessageText =
    lastMessage?.role === 'user' ? messageContentText(lastMessage.content) : '';
  const forceKnowledgeSearch = shouldSearchKnowledge(lastMessageText);

  if (forceKnowledgeSearch && !image) {
    return knowledgeSearchResponse(
      lastMessageText,
      authenticatedUserId,
      authenticatedSupabase,
    );
  }

  if (image && lastMessage?.role === 'user') {
    const text = forceKnowledgeSearch
      ? addKnowledgeSearchInstruction(lastMessageText)
      : lastMessageText;

    modelMessages[modelMessages.length - 1] = {
      role: 'user',
      content: [
        { type: 'image', image },
        { type: 'text', text: text || 'Opisz ten obraz.' },
      ] as never,
    };
  } else if (forceKnowledgeSearch && lastMessage?.role === 'user') {
    modelMessages[modelMessages.length - 1] = {
      role: 'user',
      content: addKnowledgeSearchInstruction(lastMessageText),
    };
  }

  const result = streamText({
    model: google(models[selectedModel]),
    system: systemPrompt,
    messages: modelMessages,
    tools: {
      saveUserName: tool({
        description:
          'Zapisuje imię użytkownika w Supabase. Użyj, gdy użytkownik poda swoje imię.',
        inputSchema: jsonSchema<{ name: string }>({
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Imię użytkownika, np. Paweł, Anna, Robert.',
            },
          },
          required: ['name'],
          additionalProperties: false,
        }),
        execute: async ({ name }) => {
          const cleanName = name.trim().slice(0, 80);

          if (!authenticatedSupabase || !authenticatedUserId) {
            return {
              error:
                'Nie mogę zapisać imienia, bo Supabase albo user_id nie są skonfigurowane.',
            };
          }

          if (!cleanName) {
            return { error: 'Imię jest puste.' };
          }

          const { error } = await authenticatedSupabase
            .from('user_profiles')
            .update({
              name: cleanName,
            })
            .eq('id', authenticatedUserId);

          if (error) {
            return { error: error.message };
          }

          return {
            name: cleanName,
            saved: true,
          };
        },
      }),
      saveUserPreference: tool({
        description:
          'Zapisuje preferencję użytkownika w Supabase. Użyj dla trwałych informacji, np. miasto, ulubione jedzenie, zainteresowania.',
        inputSchema: jsonSchema<{ key: string; value: string }>({
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description:
                'Krótki klucz preferencji po polsku snake_case, np. miasto, ulubione_jedzenie, hobby.',
            },
            value: {
              type: 'string',
              description: 'Wartość preferencji, np. Kraków, pizza, narty.',
            },
          },
          required: ['key', 'value'],
          additionalProperties: false,
        }),
        execute: async ({ key, value }) => {
          if (!authenticatedSupabase || !authenticatedUserId) {
            return {
              error:
                'Nie mogę zapisać preferencji, bo Supabase albo user_id nie są skonfigurowane.',
            };
          }

          const cleanKey = key
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}_-]+/gu, '_')
            .slice(0, 60);
          const cleanValue = value.trim().slice(0, 240);

          if (!cleanKey || !cleanValue) {
            return { error: 'Klucz albo wartość preferencji są puste.' };
          }

          const currentPreferences = userProfile?.preferences ?? {};
          const preferences = {
            ...currentPreferences,
            [cleanKey]: cleanValue,
          };

          const { error } = await authenticatedSupabase
            .from('user_profiles')
            .update({
              preferences,
            })
            .eq('id', authenticatedUserId);

          if (error) {
            return { error: error.message };
          }

          return {
            key: cleanKey,
            value: cleanValue,
            saved: true,
          };
        },
      }),
      calculator: tool({
        description:
          'Wykonuje obliczenia matematyczne. Używaj do VAT, kwot netto/brutto, procentów i prostych działań.',
        inputSchema: jsonSchema<{ expression: string }>({
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Wyrażenie matematyczne, np. 8500 * 0.23',
            },
          },
          required: ['expression'],
          additionalProperties: false,
        }),
        execute: async ({ expression }) => {
          try {
            return {
              expression,
              result: calculateExpression(expression),
            };
          } catch (error) {
            return {
              expression,
              error:
                error instanceof Error
                  ? error.message
                  : `Nie mogę obliczyć: ${expression}`,
            };
          }
        },
      }),
      currentDateTime: tool({
        description:
          'Zwraca aktualną datę i czas. Używaj gdy pytanie zależy od bieżącej daty.',
        inputSchema: jsonSchema<Record<string, never>>({
          type: 'object',
          properties: {},
          additionalProperties: false,
        }),
        execute: async () => ({
          iso: new Date().toISOString(),
          local: new Intl.DateTimeFormat('pl-PL', {
            dateStyle: 'full',
            timeStyle: 'medium',
            timeZone: 'Europe/Madrid',
          }).format(new Date()),
          timeZone: 'Europe/Madrid',
        }),
      }),
      searchKnowledge: tool({
        description:
          'Wyszukuje informacje w bazie wiedzy firmy: cenniki, pakiety, koszty, oferty, FAQ, regulaminy, warunki, procedury i dokumenty firmowe. Używaj zawsze, gdy pytanie może dotyczyć dokumentów firmy.',
        inputSchema: jsonSchema<{ query: string }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Pytanie lub fraza do wyszukania w bazie wiedzy, np. "ile kosztuje pakiet premium".',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ query }) => {
          try {
            return await searchKnowledgeBase(
              query,
              authenticatedUserId,
              authenticatedSupabase,
            );
          } catch (error) {
            return {
              results: [],
              total_found: 0,
              message: formatAiError(
                error,
                'Nieznany błąd podczas wyszukiwania w bazie wiedzy.',
              ),
            };
          }
        },
      }),
      ...(searchGroundingEnabled
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
      readWebPage: tool({
        description:
          'Pobiera i czyta zawartość strony internetowej. Używaj gdy użytkownik poda URL lub gdy chcesz przeczytać artykuł/stronę znalezioną w wyszukiwarce.',
        inputSchema: jsonSchema<{ url: string }>({
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'Pełny adres URL strony, np. https://example.com',
            },
          },
          required: ['url'],
          additionalProperties: false,
        }),
        execute: async ({ url }) => {
          let parsedUrl: URL;

          try {
            parsedUrl = new URL(url);
          } catch {
            return 'Nie udało się odczytać strony: podany adres URL jest nieprawidłowy.';
          }

          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return 'Nie udało się odczytać strony: obsługiwane są tylko adresy http i https.';
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          try {
            const response = await fetch(parsedUrl, {
              headers: {
                'user-agent':
                  'Mozilla/5.0 (compatible; MojAgent/1.0; +https://example.com)',
              },
              signal: controller.signal,
            });

            if (!response.ok) {
              return `Nie udało się odczytać strony: serwer zwrócił błąd HTTP ${response.status}.`;
            }

            const html = await response.text();
            const text = extractReadableText(html);

            return text || 'Strona została pobrana, ale nie znaleziono czytelnego tekstu.';
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              return 'Nie udało się odczytać strony: przekroczono limit czasu 5 sekund.';
            }

            return 'Nie udało się odczytać strony: strona jest niedostępna lub blokuje pobieranie.';
          } finally {
            clearTimeout(timeout);
          }
        },
      }),
      getOfficialApiDirectory: tool({
        description:
          'Zwraca katalog oficjalnych API i źródeł urzędowych dla pytań prawno-podatkowych Costa Broker w Hiszpanii.',
        inputSchema: jsonSchema<Record<string, never>>({
          type: 'object',
          properties: {},
          additionalProperties: false,
        }),
        execute: async () => ({
          checkedAt: new Date().toISOString(),
          sources: [
            {
              name: 'BOE - Boletín Oficial del Estado',
              url: officialSourceUrls.boe,
              useFor:
                'Hiszpańskie przepisy, teksty skonsolidowane, dekrety, akty prawne i oficjalne publikacje.',
              apiNotes:
                'BOE publikuje treści w XML/XSD. Dzienny sumario jest dostępny przez /diario_boe/xml.php?id=BOE-S-YYYYMMDD.',
            },
            {
              name: 'AEAT - Agencia Tributaria',
              url: officialSourceUrls.aeat,
              useFor:
                'Podatki, IVA, IRPF, modele deklaracji, procedury, FAQ i dokumentacja techniczna.',
              apiNotes:
                'Część usług AEAT działa jako SOAP/WSDL i wymaga certyfikatu cyfrowego. SII i VERI*FACTU mają osobne dokumentacje techniczne.',
            },
            {
              name: 'DGT - Dirección General de Tributos',
              url: officialSourceUrls.dgt,
              useFor:
                'Interpretacje podatkowe, consultas vinculantes i kryteria stosowania przepisów podatkowych.',
              apiNotes:
                'Publiczny wyszukiwacz konsultacji; gdy brak stabilnego API, używaj wyszukiwania urzędowego lub site-search.',
            },
            {
              name: 'EUR-Lex',
              url: officialSourceUrls.eurlex,
              useFor:
                'Prawo UE, dyrektywy, rozporządzenia, orzecznictwo TSUE i teksty skonsolidowane UE.',
              apiNotes:
                'Dostępne są identyfikatory CELEX/ELI/ECLI i formaty do pobierania dokumentów.',
            },
            {
              name: 'VIES',
              url: officialSourceUrls.vies,
              useFor: 'Walidacja unijnych numerów VAT kontrahentów.',
              apiNotes:
                'Publiczny web service SOAP checkVatService. Użyj narzędzia checkVIESVatNumber.',
            },
            {
              name: 'Catastro',
              url: officialSourceUrls.catastro,
              useFor:
                'Dane katastralne nieruchomości, referencje katastralne, adresy i usługi kartograficzne.',
              apiNotes:
                'Publiczne usługi XML/ASMX, m.in. wyszukiwanie po adresie. Użyj getCatastroByAddress.',
            },
            {
              name: 'CENDOJ / Poder Judicial',
              url: officialSourceUrls.cendoj,
              useFor:
                'Orzecznictwo sądowe, ECLI/ROJ i praktyka sądowa w Hiszpanii.',
              apiNotes:
                'Publiczny wyszukiwacz orzecznictwa; używaj jako źródła wspierającego, nie zamiast BOE.',
            },
            {
              name: 'datos.gob.es',
              url: officialSourceUrls.datosGob,
              useFor:
                'Katalog danych publicznych Hiszpanii: zbiory danych centralne, regionalne i lokalne.',
              apiNotes:
                'Katalog oparty o standardy danych otwartych; dobry do odkrywania dodatkowych datasetów.',
            },
          ],
          regionalGazettes: regionalOfficialGazettes,
        }),
      }),
      searchOfficialLegalSources: tool({
        description:
          'Buduje linki do wyszukiwania w oficjalnych źródłach prawnych i podatkowych: BOE, AEAT, DGT, EUR-Lex, CENDOJ, Catastro, datos.gob.es i dzienniki regionalne.',
        inputSchema: jsonSchema<{
          query: string;
          region?: string;
          source?: OfficialSource;
        }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Fraza do sprawdzenia, np. ITP Comunidad Valenciana, IVA alquiler vivienda, NIE compra inmueble.',
            },
            source: {
              type: 'string',
              enum: [
                'aeat',
                'all',
                'boe',
                'catastro',
                'cendoj',
                'datosGob',
                'dgt',
                'eurlex',
                'regional',
                'vies',
              ],
              description: 'Źródło do sprawdzenia. Domyślnie all.',
            },
            region: {
              type: 'string',
              description:
                'Opcjonalna wspólnota autonomiczna, np. madrid, andalucia, catalunya, comunitatValenciana.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ query, source = 'all', region }) => ({
          query,
          source,
          region,
          checkedAt: new Date().toISOString(),
          results: officialSearchUrls(query, source, region),
          instruction:
            'Otwórz najbardziej właściwy link przez readWebPage albo użyj google_search z domeną źródła, a następnie odpowiedz z cytowaniem źródeł i datą sprawdzenia.',
        }),
      }),
      getBOEDailySummary: tool({
        description:
          'Pobiera oficjalne XML dziennego BOE dla daty YYYY-MM-DD. Używaj do sprawdzania nowych publikacji prawnych.',
        inputSchema: jsonSchema<{ date?: string }>({
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description:
                'Data w formacie YYYY-MM-DD. Jeśli puste, użyta zostanie dzisiejsza data.',
            },
          },
          additionalProperties: false,
        }),
        execute: async ({ date = new Date().toISOString().slice(0, 10) }) => {
          const url = boeDailySummaryUrl(date);

          try {
            const { ok, status, text } = await fetchTextWithTimeout(url);

            if (!ok) {
              return {
                date,
                url,
                error: `BOE zwrócił HTTP ${status}. Sprawdź, czy tego dnia opublikowano numer BOE.`,
              };
            }

            return {
              date,
              url,
              source: 'BOE XML',
              text: stripXml(text).slice(0, 5000),
            };
          } catch (error) {
            return {
              date,
              url,
              error:
                error instanceof Error
                  ? error.message
                  : 'Nie udało się pobrać XML z BOE.',
            };
          }
        },
      }),
      checkVIESVatNumber: tool({
        description:
          'Sprawdza unijny numer VAT w oficjalnym systemie VIES przez SOAP checkVatService.',
        inputSchema: jsonSchema<{ countryCode: string; vatNumber: string }>({
          type: 'object',
          properties: {
            countryCode: {
              type: 'string',
              description: 'Dwuliterowy kod kraju UE, np. ES, PL, DE, FR.',
            },
            vatNumber: {
              type: 'string',
              description:
                'Numer VAT bez prefiksu kraju, np. dla ESB12345678 podaj B12345678.',
            },
          },
          required: ['countryCode', 'vatNumber'],
          additionalProperties: false,
        }),
        execute: async ({ countryCode, vatNumber }) => {
          const normalizedCountryCode = countryCode.trim().toUpperCase();
          const normalizedVatNumber = vatNumber
            .trim()
            .replace(new RegExp(`^${normalizedCountryCode}`, 'i'), '')
            .replace(/\s+/g, '');
          const body = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${normalizedCountryCode}</urn:countryCode>
      <urn:vatNumber>${normalizedVatNumber}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

          try {
            const { ok, status, text } = await fetchTextWithTimeout(
              'https://ec.europa.eu/taxation_customs/vies/services/checkVatService',
              {
                method: 'POST',
                headers: {
                  'content-type': 'text/xml;charset=UTF-8',
                  soapaction: '',
                },
                body,
              },
              5000,
            );

            if (!ok) {
              return {
                countryCode: normalizedCountryCode,
                vatNumber: normalizedVatNumber,
                source: 'VIES',
                url: officialSourceUrls.vies,
                error: `VIES zwrócił HTTP ${status}.`,
              };
            }

            return {
              countryCode: xmlValue(text, 'countryCode') ?? normalizedCountryCode,
              vatNumber: xmlValue(text, 'vatNumber') ?? normalizedVatNumber,
              requestDate: xmlValue(text, 'requestDate'),
              valid: xmlValue(text, 'valid') === 'true',
              name: xmlValue(text, 'name'),
              address: xmlValue(text, 'address'),
              source: 'VIES SOAP checkVatService',
              url: officialSourceUrls.vies,
            };
          } catch (error) {
            return {
              countryCode: normalizedCountryCode,
              vatNumber: normalizedVatNumber,
              source: 'VIES',
              url: officialSourceUrls.vies,
              error:
                error instanceof Error
                  ? error.message
                  : 'Nie udało się sprawdzić numeru VAT w VIES.',
            };
          }
        },
      }),
      getCatastroByAddress: tool({
        description:
          'Wyszukuje publiczne dane katastralne nieruchomości po adresie przez usługę XML/ASMX Catastro.',
        inputSchema: jsonSchema<{
          municipality: string;
          number: string;
          province: string;
          street: string;
          streetType?: string;
        }>({
          type: 'object',
          properties: {
            province: {
              type: 'string',
              description: 'Prowincja, np. Alicante, Malaga, Madrid.',
            },
            municipality: {
              type: 'string',
              description: 'Gmina/miasto, np. Torrevieja, Marbella, Madrid.',
            },
            streetType: {
              type: 'string',
              description:
                'Typ ulicy po hiszpańsku, np. CL, AV, PS. Jeśli nie wiesz, użyj CL.',
            },
            street: {
              type: 'string',
              description: 'Nazwa ulicy bez typu.',
            },
            number: {
              type: 'string',
              description: 'Numer budynku.',
            },
          },
          required: ['province', 'municipality', 'street', 'number'],
          additionalProperties: false,
        }),
        execute: async ({
          municipality,
          number,
          province,
          street,
          streetType = 'CL',
        }) => {
          const params = new URLSearchParams({
            Provincia: province,
            Municipio: municipality,
            Sigla: streetType,
            Calle: street,
            Numero: number,
          });
          const url = `https://ovc.catastro.meh.es/OVCServWeb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPLOC?${params.toString()}`;

          try {
            const { ok, status, text } = await fetchTextWithTimeout(url);

            if (!ok) {
              return {
                url,
                source: 'Catastro',
                error: `Catastro zwrócił HTTP ${status}.`,
              };
            }

            return {
              url,
              source: 'Catastro XML/ASMX',
              province,
              municipality,
              streetType,
              street,
              number,
              cadastralReference:
                `${xmlValue(text, 'pc1') ?? ''}${xmlValue(text, 'pc2') ?? ''}` ||
                undefined,
              address: stripXml(text).slice(0, 2500),
              note:
                'Publiczny wynik Catastro może wymagać doprecyzowania adresu lub weryfikacji w Sede Electrónica del Catastro.',
            };
          } catch (error) {
            return {
              url,
              source: 'Catastro',
              error:
                error instanceof Error
                  ? error.message
                  : 'Nie udało się pobrać danych z Catastro.',
            };
          }
        },
      }),
      generateImage: tool({
        description:
          'Generuje obraz na podstawie opisu. Używaj gdy użytkownik prosi o logo, grafikę, ilustrację, post wizualny.',
        inputSchema: jsonSchema<{ prompt: string }>({
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Opis obrazu do wygenerowania',
            },
          },
          required: ['prompt'],
          additionalProperties: false,
        }),
        execute: async ({ prompt }) => ({
          prompt,
          ...(await generateImageFromPrompt(prompt)),
        }),
      }),
    },
    // maxSteps: 3 (AI SDK v7 equivalent)
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas pobierania odpowiedzi.'),
    sendSources: true,
  });
}
