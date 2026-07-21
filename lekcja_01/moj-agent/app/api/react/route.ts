import { google } from '@ai-sdk/google';
import {
  convertToModelMessages,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type UIMessage,
} from 'ai';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { searchKnowledgeBase, shouldSearchKnowledge } from '../../../lib/knowledge';
import { formatAiError } from '../errorMessages';

const notesPath = path.join(process.cwd(), 'data', 'react-notes.json');
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

const reactSystemPrompt = `Jesteś autonomicznym agentem. Gdy dostajesz ZADANIE (nie pytanie),
MUSISZ je zrealizować krok po kroku.

## TWÓJ PROCES:

Dla KAŻDEGO kroku wypisz:

### 🧠 Myślę...
Co muszę teraz zrobić? Jakie informacje mi brakuje?
Które narzędzie użyć?

Potem UŻYJ narzędzia.

Po otrzymaniu wyniku:

### 👁️ Obserwuję...
Co dostałem? Czy to wystarczy do odpowiedzi?
Jeśli nie — jaki następny krok?

Powtarzaj aż będziesz mieć WSZYSTKO co potrzebne.

Na koniec:

### ✅ Wynik końcowy
Podaj pełną, konkretną odpowiedź opartą na zebranych danych.
Cytuj źródła (API, Wikipedia, Google).

## ZASADY:
- ZAWSZE pokazuj tok myślenia — użytkownik widzi cały proces
- NIE zgaduj — jeśli potrzebujesz danych, UŻYJ narzędzia
- Maksymalnie 5 głównych kroków
- Jeśli narzędzie zwróci błąd — spróbuj inaczej lub poinformuj
- ŁĄCZ dane z wielu narzędzi w spójną odpowiedź
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com
- Gdy zadanie dotyczy cennika, pakietów, oferty, regulaminu, FAQ, kosztów, cen lub warunków firmy, użyj najpierw narzędzia searchKnowledge.
- Gdy odpowiadasz na podstawie searchKnowledge, zakończ odpowiedź cytatem: "📎 Źródło: [tytuł dokumentu]" albo "📎 Źródła: [tytuły dokumentów]".
- Jeśli searchKnowledge nic nie znajdzie, powiedz wprost: "Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z Costa Broker bezpośrednio." Nie odpowiadaj z pamięci.

## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → "Nie udało się sprawdzić pogody w X. Mogę poszukać w Google lub spróbować innego miasta."
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje`;

function searchGroundingPrompt() {
  return searchGroundingEnabled
    ? 'Search Grounding / google_search jest włączony przez ENABLE_SEARCH_GROUNDING=true. Używaj go oszczędnie, tylko gdy naprawdę potrzebujesz aktualnych informacji.'
    : 'Search Grounding / google_search jest wyłączony kosztowo. Nie próbuj używać google_search; korzystaj z darmowych narzędzi, zapisków i danych podanych przez użytkownika.';
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

async function fetchJsonWithTimeout(url: string, label: string, timeoutMs = 5000) {
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
        error: `Timeout — ${label} nie odpowiedziało w 5 sekund. Spróbuj ponownie.`,
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

async function readNotes() {
  try {
    const file = await readFile(notesPath, 'utf8');
    return JSON.parse(file) as Array<{
      content: string;
      createdAt: string;
      title: string;
    }>;
  } catch {
    return [];
  }
}

async function writeNotes(
  notes: Array<{ content: string; createdAt: string; title: string }>,
) {
  await mkdir(path.dirname(notesPath), { recursive: true });
  await writeFile(notesPath, JSON.stringify(notes, null, 2), 'utf8');
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const modelMessages = await convertToModelMessages(messages);
  const lastMessage = modelMessages.at(-1);
  const lastUserText =
    lastMessage?.role === 'user' ? messageContentText(lastMessage.content) : '';

  if (lastMessage?.role === 'user' && shouldSearchKnowledge(lastUserText)) {
    modelMessages[modelMessages.length - 1] = {
      role: 'user',
      content: [
        lastUserText,
        'Najpierw użyj narzędzia searchKnowledge z treścią tego pytania. Odpowiedz tylko na podstawie wyniku narzędzia. Jeśli narzędzie nic nie znajdzie, nie odpowiadaj z wiedzy ogólnej. Jeśli znajdziesz odpowiedź, zakończ ją cytatem "📎 Źródło:" lub "📎 Źródła:".',
      ].join('\n\n'),
    };
  }

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: [reactSystemPrompt, searchGroundingPrompt()].join('\n\n'),
    messages: modelMessages,
    tools: {
      calculator: tool({
        description:
          'Wykonuje obliczenia matematyczne. Używaj do przeliczeń, procentów i działań po zebraniu danych.',
        inputSchema: jsonSchema<{ expression: string }>({
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Wyrażenie matematyczne, np. 5000 * 4.25',
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
          'Zwraca aktualną datę i czas. Używaj gdy zadanie zależy od dziś, weekendu lub kolejnych dni.',
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
                'Pytanie lub fraza do wyszukania w bazie wiedzy, np. "co zawiera pakiet VIP".',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ query }) => {
          try {
            return await searchKnowledgeBase(query);
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
      getWeather: tool({
        description:
          'Sprawdza aktualną pogodę dla miasta z Open-Meteo. Używaj do porównań pogody i planów podróży.',
        inputSchema: jsonSchema<{ city: string }>({
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'Nazwa miasta, np. Warszawa, Kraków, Berlin',
            },
          },
          required: ['city'],
          additionalProperties: false,
        }),
        execute: async ({ city }) => {
          const trimmedCity = city.trim();

          if (!trimmedCity) {
            return { city, error: 'Podaj nazwę miasta.' };
          }

          const geoResult = await fetchJsonWithTimeout(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              trimmedCity,
            )}&count=1&language=pl&format=json`,
            'Open-Meteo geocoding',
          );
          if (geoResult.error) {
            return { city: trimmedCity, error: geoResult.error };
          }

          const geoData = geoResult.data as {
            results?: Array<{
              country: string;
              latitude: number;
              longitude: number;
              name: string;
            }>;
          };
          const place = geoData.results?.[0];

          if (!place) {
            return {
              city: trimmedCity,
              error: `Nie znalazłem miasta ${trimmedCity}. Sprawdź pisownię.`,
            };
          }

          const weatherResult = await fetchJsonWithTimeout(
            `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=auto`,
            'Open-Meteo forecast',
          );
          if (weatherResult.error) {
            return { city: place.name, error: weatherResult.error };
          }

          const weather = weatherResult.data;

          return {
            source: 'Open-Meteo',
            city: place.name,
            country: place.country,
            current: weather.current,
            daily: weather.daily,
          };
        },
      }),
      getExchangeRate: tool({
        description:
          'Pobiera aktualny kurs waluty względem PLN z publicznego API Frankfurter.',
        inputSchema: jsonSchema<{ currency: string }>({
          type: 'object',
          properties: {
            currency: {
              type: 'string',
              description: 'Kod waluty, np. EUR, USD, CHF',
            },
          },
          required: ['currency'],
          additionalProperties: false,
        }),
        execute: async ({ currency }) => {
          const code = currency.trim().toUpperCase();

          if (!/^[A-Z]{3}$/.test(code)) {
            return {
              currency,
              error: 'Podaj 3-literowy kod waluty (np. EUR, USD).',
            };
          }

          if (code === 'PLN') {
            return { base: 'PLN', target: 'PLN', rate: 1, source: 'Frankfurter' };
          }

          const result = await fetchJsonWithTimeout(
            `https://api.frankfurter.app/latest?from=${encodeURIComponent(
              code,
            )}&to=PLN`,
            'Frankfurter API',
          );
          if (result.error) {
            return { currency: code, error: result.error };
          }

          const data = result.data as { date?: string; rates?: { PLN?: number } };

          if (typeof data.rates?.PLN !== 'number') {
            return {
              currency: code,
              error: `Waluta ${code} nie jest w tabeli kursów. Popularne: EUR, USD, GBP, CHF.`,
            };
          }

          return {
            date: data.date,
            base: code,
            target: 'PLN',
            rate: data.rates.PLN,
            source: 'Frankfurter API',
          };
        },
      }),
      getHolidays: tool({
        description:
          'Pobiera święta publiczne dla kraju i roku z Nager.Date. Używaj do sprawdzania dni wolnych.',
        inputSchema: jsonSchema<{ countryCode?: string; year?: number }>({
          type: 'object',
          properties: {
            countryCode: {
              type: 'string',
              description: 'Kod kraju ISO 3166-1 alpha-2, domyślnie PL',
            },
            year: {
              type: 'number',
              description: 'Rok, domyślnie bieżący',
            },
          },
          additionalProperties: false,
        }),
        execute: async ({ countryCode = 'PL', year = new Date().getFullYear() }) => {
          const normalizedCountryCode =
            countryCode.toUpperCase() === 'UK' ? 'GB' : countryCode.toUpperCase();

          if (!/^[A-Z]{2}$/.test(normalizedCountryCode)) {
            return {
              countryCode,
              year,
              error: 'Podaj 2-literowy kod kraju (np. PL, DE, US).',
            };
          }

          const result = await fetchJsonWithTimeout(
            `https://date.nager.at/api/v3/PublicHolidays/${year}/${normalizedCountryCode}`,
            'Nager.Date',
          );

          if (result.error) {
            return {
              countryCode: normalizedCountryCode,
              year,
              error: `Nie znalazłem świąt dla kraju ${normalizedCountryCode}. Popularne: PL, DE, US, GB, FR. Szczegóły: ${result.error}`,
            };
          }

          return {
            countryCode: normalizedCountryCode,
            year,
            source: 'Nager.Date',
            holidays: result.data,
          };
        },
      }),
      searchWikipedia: tool({
        description:
          'Wyszukuje hasło w Wikipedii i zwraca krótkie streszczenie oraz link.',
        inputSchema: jsonSchema<{ query: string; language?: string }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Hasło lub temat do wyszukania',
            },
            language: {
              type: 'string',
              description: 'Kod języka Wikipedii, domyślnie pl',
            },
          },
          required: ['query'],
          additionalProperties: false,
        }),
        execute: async ({ query, language = 'pl' }) => {
          const trimmedQuery = query.trim();
          const normalizedLanguage = language.trim().toLowerCase() || 'pl';

          if (!trimmedQuery) {
            return { query, error: 'Podaj hasło do wyszukania w Wikipedii.' };
          }

          const searchResult = await fetchJsonWithTimeout(
            `https://${normalizedLanguage}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              trimmedQuery,
            )}&format=json&origin=*`,
            'Wikipedia Search',
          );
          if (searchResult.error) {
            return { query: trimmedQuery, error: searchResult.error };
          }

          const searchData = searchResult.data as {
            query?: { search?: Array<{ title: string }> };
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
          'Pobiera i czyta zawartość strony internetowej. Używaj gdy potrzebujesz treści spod konkretnego URL.',
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

            return {
              url,
              source: parsedUrl.hostname,
              text:
                text ||
                'Strona została pobrana, ale nie znaleziono czytelnego tekstu.',
            };
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
      saveNote: tool({
        description:
          'Zapisuje notatkę lokalnie po stronie serwera. Używaj gdy użytkownik prosi o zapisanie wyników.',
        inputSchema: jsonSchema<{ content: string; title: string }>({
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Krótki tytuł notatki',
            },
            content: {
              type: 'string',
              description: 'Treść notatki',
            },
          },
          required: ['title', 'content'],
          additionalProperties: false,
        }),
        execute: async ({ content, title }) => {
          const notes = await readNotes();
          const note = {
            title,
            content,
            createdAt: new Date().toISOString(),
          };

          notes.unshift(note);
          await writeNotes(notes.slice(0, 50));

          return {
            saved: true,
            note,
            totalNotes: Math.min(notes.length, 50),
          };
        },
      }),
      getNotes: tool({
        description:
          'Odczytuje zapisane notatki. Używaj gdy potrzebujesz wcześniejszych wyników lub zapisanych danych.',
        inputSchema: jsonSchema<Record<string, never>>({
          type: 'object',
          properties: {},
          additionalProperties: false,
        }),
        execute: async () => ({
          source: 'local file',
          notes: await readNotes(),
        }),
      }),
      ...(searchGroundingEnabled
        ? { google_search: google.tools.googleSearch({}) }
        : {}),
    },
    // maxSteps: 3 (AI SDK v7 equivalent)
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas działania agenta ReAct.'),
    sendSources: true,
  });
}
