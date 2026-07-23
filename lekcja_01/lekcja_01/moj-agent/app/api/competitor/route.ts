import { google } from '@ai-sdk/google';
import {
  convertToModelMessages,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { formatAiError } from '../errorMessages';

const searchGroundingEnabled =
  process.env.ENABLE_SEARCH_GROUNDING === 'true';

if (searchGroundingEnabled) {
  console.warn(
    '⚠️ UWAGA: Search Grounding jest WŁĄCZONY. ' +
      'To jest najdroższa funkcja API ($14/1000 zapytań). ' +
      'Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local.',
  );
}

const competitorSystemPrompt = `Jesteś analitykiem konkurencji. Gdy użytkownik poda nazwy firm,
AUTONOMICZNIE zbierasz informacje i porównujesz je.

## TWÓJ PROCES:
1. Dla KAŻDEJ firmy: szukaj informacji (Google, Wikipedia, strony firmowe)
2. Zbierz: opis, branża, wielkość, produkty, ceny, mocne/słabe strony
3. Stwórz tabelę porównawczą
4. Napisz rekomendację

## FORMAT:

# 🏢 Analiza konkurencji

## Porównanie

| Aspekt | [Firma 1] | [Firma 2] | [Firma 3] |
|--------|-----------|-----------|-----------|
| Branża | ... | ... | ... |
| Wielkość | ... | ... | ... |
| Główny produkt | ... | ... | ... |
| Mocne strony | ... | ... | ... |
| Słabe strony | ... | ... | ... |
| Ceny (orientacyjne) | ... | ... | ... |

## Szczegółowa analiza
[Rozwinięcie dla każdej firmy — 3-4 zdania]

## Rekomendacja
[Która firma jest najlepsza i dlaczego — w kontekście użytkownika]

## Źródła
[Linki do stron firmowych i artykułów]

ZASADY:
- Używaj prawdziwych danych z narzędzi. Nie wymyślaj cen, wielkości firm ani funkcji.
- Jeśli ceny są niejawne albo zmienne, napisz "brak publicznych danych" albo "zależy od planu/oferty".
- Porównanie ma być praktyczne i menedżerskie, nie marketingowe.
- Jeśli użytkownik poda kontekst, dopasuj rekomendację do tego kontekstu.
- Jeśli Google Search jest wyłączony, zaznacz krótko ograniczenie aktualności i oprzyj analizę na Wikipedii oraz odczytanych stronach.
- Odpowiadaj po polsku.
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com`;

function searchGroundingPrompt() {
  return searchGroundingEnabled
    ? 'Search Grounding / google_search jest włączony przez ENABLE_SEARCH_GROUNDING=true. Przy analizie konkurencji użyj Google Search dla każdej firmy, a potem uzupełnij Wikipedią lub readWebPage.'
    : 'Search Grounding / google_search jest wyłączony kosztowo. Nie próbuj używać google_search. Użyj searchWikipedia i readWebPage dla znanych/podanych stron; jasno zaznacz ograniczenie aktualności.';
}

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
    .slice(0, 5000);
}

async function fetchJsonWithTimeout(url: string, label: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return {
        error: `${label} zwróciło błąd ${response.status}. Sprawdź parametry.`,
      };
    }

    return { data: await response.json() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        error: `Timeout — ${label} nie odpowiedziało w ${timeoutMs / 1000} sekund.`,
      };
    }

    return {
      error: `Błąd połączenia z ${label}: ${
        error instanceof Error ? error.message : 'nieznany błąd'
      }`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: [
      competitorSystemPrompt,
      searchGroundingPrompt(),
      `Dzisiejsza data: ${new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'long',
        timeZone: 'Europe/Madrid',
      }).format(new Date())}.`,
    ].join('\n\n'),
    messages: await convertToModelMessages(messages),
    tools: {
      searchWikipedia: tool({
        description:
          'Wyszukuje hasło w Wikipedii i pobiera krótkie streszczenie z linkiem. Używaj do tła firmy, historii i podstawowych faktów.',
        inputSchema: jsonSchema<{ language?: string; query: string }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Nazwa firmy, produktu lub tematu do wyszukania w Wikipedii.',
            },
            language: {
              type: 'string',
              description: 'Kod języka Wikipedii, np. pl lub en. Domyślnie en dla firm globalnych.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ language = 'en', query }) => {
          const trimmedQuery = query.trim();
          const normalizedLanguage = /^[a-z]{2,3}$/i.test(language)
            ? language.toLowerCase()
            : 'en';

          if (!trimmedQuery) {
            return { error: 'Podaj hasło do wyszukania w Wikipedii.' };
          }

          const searchResult = await fetchJsonWithTimeout(
            `https://${normalizedLanguage}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(
              trimmedQuery,
            )}`,
            'Wikipedia Search',
          );

          if (searchResult.error) {
            return { query: trimmedQuery, error: searchResult.error };
          }

          const searchData = searchResult.data as {
            query?: { search?: Array<{ title?: string }> };
          };
          const title = searchData.query?.search?.[0]?.title;

          if (!title) {
            return { query: trimmedQuery, error: 'Nie znaleziono hasła w Wikipedii.' };
          }

          const summaryResult = await fetchJsonWithTimeout(
            `https://${normalizedLanguage}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              title,
            )}`,
            'Wikipedia Summary',
          );

          if (summaryResult.error) {
            return { query: trimmedQuery, title, error: summaryResult.error };
          }

          const summary = summaryResult.data as {
            content_urls?: { desktop?: { page?: string } };
            extract?: string;
          };

          return {
            query: trimmedQuery,
            title,
            extract: summary.extract,
            url: summary.content_urls?.desktop?.page,
            source: 'Wikipedia',
          };
        },
      }),
      readWebPage: tool({
        description:
          'Pobiera i czyta zawartość strony internetowej. Używaj dla konkretnych URL-i stron firmowych, cenników lub dokumentacji.',
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
          const timeout = setTimeout(() => controller.abort(), 6000);

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

            return {
              url,
              source: parsedUrl.hostname,
              text:
                text ||
                'Strona została pobrana, ale nie znaleziono czytelnego tekstu.',
            };
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              return 'Nie udało się odczytać strony: przekroczono limit czasu 6 sekund.';
            }

            return 'Nie udało się odczytać strony: strona jest niedostępna lub blokuje pobieranie.';
          } finally {
            clearTimeout(timeout);
          }
        },
      }),
      ...(searchGroundingEnabled
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
    },
    stopWhen: isStepCount(10),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas analizy konkurencji.'),
    sendSources: true,
  });
}
