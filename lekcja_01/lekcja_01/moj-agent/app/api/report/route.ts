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

const reportSystemPrompt = `Jesteś profesjonalnym analitykiem biznesowym. Gdy użytkownik poda temat,
AUTONOMICZNIE zbierasz informacje i piszesz raport.

## TWÓJ PROCES:
1. Przeanalizuj temat — co trzeba zbadać?
2. Szukaj danych: Google Search, Wikipedia, strony branżowe
3. Zbierz fakty, liczby, statystyki
4. Napisz raport w profesjonalnym formacie

## FORMAT RAPORTU:

# 📊 Raport: [TEMAT]
Data: [dzisiejsza data]
Autor: Agent AI

## Streszczenie (Executive Summary)
[3-4 zdania — kluczowe wnioski]

## 1. Wprowadzenie
[Kontekst, dlaczego ten temat jest ważny]

## 2. Kluczowe dane i fakty
[Wylistowane punkty z danymi — ze źródłami]

## 3. Analiza
[Interpretacja danych, trendy, porównania]

## 4. Wnioski i rekomendacje
[Co z tego wynika? Co robić?]

## Źródła
[Lista użytych źródeł z linkami]

ZASADY:
- Używaj PRAWDZIWYCH danych z narzędzi. Nie wymyślaj statystyk.
- Podawaj źródła przy konkretnych faktach, liczbach i datach.
- Bądź konkretny — liczby, daty, nazwy, porównania.
- Raport powinien mieć 500-1000 słów.
- Jeśli Google Search jest niedostępny, oprzyj raport na Wikipedii i stronach/URL-ach, które da się odczytać narzędziem readWebPage. W raporcie napisz wtedy krótko, że aktualne wyszukiwanie Google jest wyłączone.
- Jeśli brakuje wiarygodnych danych, powiedz to wprost zamiast zgadywać.
- Odpowiadaj po polsku.
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com`;

function searchGroundingPrompt() {
  return searchGroundingEnabled
    ? 'Search Grounding / google_search jest włączony przez ENABLE_SEARCH_GROUNDING=true. Przy raportach najpierw użyj google_search do aktualnych danych, a następnie uzupełnij Wikipedią lub readWebPage.'
    : 'Search Grounding / google_search jest wyłączony kosztowo. Nie próbuj używać google_search. Przygotuj raport z Wikipedii, readWebPage dla podanych URL-i i jasno zaznacz ograniczenie aktualności.';
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
      reportSystemPrompt,
      searchGroundingPrompt(),
      `Dzisiejsza data: ${new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'long',
        timeZone: 'Europe/Madrid',
      }).format(new Date())}.`,
    ].join('\n\n'),
    messages: await convertToModelMessages(messages),
    tools: {
      calculator: tool({
        description:
          'Wykonuje obliczenia matematyczne. Używaj do procentów, wzrostów, CAGR, porównań i prostych przeliczeń.',
        inputSchema: jsonSchema<{ expression: string }>({
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Wyrażenie matematyczne, np. 1200 * 1.23 albo 450 / 900 * 100',
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
      searchWikipedia: tool({
        description:
          'Wyszukuje hasło w Wikipedii i pobiera krótkie streszczenie z linkiem. Używaj do tła tematu, definicji i podstawowych faktów.',
        inputSchema: jsonSchema<{ language?: string; query: string }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Hasło lub temat do wyszukania w Wikipedii.',
            },
            language: {
              type: 'string',
              description: 'Kod języka Wikipedii, np. pl lub en. Domyślnie pl.',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ language = 'pl', query }) => {
          const trimmedQuery = query.trim();
          const normalizedLanguage = /^[a-z]{2,3}$/i.test(language)
            ? language.toLowerCase()
            : 'pl';

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
          'Pobiera i czyta zawartość strony internetowej. Używaj dla konkretnych URL-i znalezionych lub podanych przez użytkownika.',
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
    stopWhen: isStepCount(8),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas generowania raportu.'),
    sendSources: true,
  });
}
