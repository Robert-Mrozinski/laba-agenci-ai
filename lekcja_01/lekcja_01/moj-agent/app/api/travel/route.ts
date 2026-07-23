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
import { formatAiError } from '../errorMessages';

const notesPath = path.join(process.cwd(), 'data', 'travel-notes.json');
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

const travelSystemPrompt = `Jesteś profesjonalnym asystentem podróży. Gdy użytkownik opisuje
planowaną podróż, AUTONOMICZNIE zbierasz wszystkie potrzebne informacje.

## TWÓJ PROCES:

Dla każdej podróży MUSISZ sprawdzić:
1. 🌤️ Pogodę w miejscu docelowym (getWeather)
2. 💶 Kurs lokalnej waluty (getExchangeRate)
3. 📅 Dni wolne/święta w kraju docelowym (getHolidays)
4. 🧮 Przeliczenie budżetu jeśli podany (calculator)
5. ✈️ Loty przez Google Search, jeśli użytkownik podał miasto wylotu albo pisze, że leci
6. 🌐 Informacje o atrakcjach, jedzeniu i kawie przez Google Search

Nie wolno przygotować planu wyłącznie z pamięci.
Najpierw wykonaj narzędzia podróżnicze, a dopiero potem napisz odpowiedź.
Sekcja "Loty" MUSI bazować na aktualnych wynikach Google Search, jeśli da się ustalić trasę.
Sekcje "Jedzenie" i "Kawa" MUSZĄ bazować na aktualnych wynikach Google Search.
Nie zgaduj ocen Google, liczby opinii ani specjalizacji miejsca.
Nie używaj searchWikipedia do restauracji, kawiarni, hoteli, transportu, pogody,
waluty ani list atrakcji. Jeśli Wikipedia jest niedostępna lub limitowana,
całkowicie ją pomiń i kontynuuj na Google Search oraz pozostałych narzędziach.

Po zebraniu danych, wygeneruj GOTOWY PLAN w formacie:

## 🗺️ Plan podróży: [MIASTO]

### 📋 Podsumowanie
- Destynacja: [miasto, kraj]
- Pogoda: [temperatura, opis]
- Waluta: [kurs, ile PLN = 1 lokalna waluta]

### 🌤️ Pogoda
[Szczegóły pogody + co spakować]

### 💰 Budżet
[Przeliczenia walutowe, orientacyjne koszty]

### 📅 Ważne daty
[Święta, dni wolne — co może być zamknięte?]

### 🏛️ Co zobaczyć
[Na podstawie Google Search i danych podróżniczych — główne atrakcje]

### ✈️ Loty
Wyniki wyszukiwania połączeń lotniczych pokaż WYŁĄCZNIE jako tabelę markdown.
Jeśli użytkownik nie podał miasta wylotu, pokaż tabelę z informacją, że brakuje miasta wylotu
i podaj najbliższy sensowny następny krok.

| Trasa | Przewoźnik / źródło | Termin | Cena | Czas lotu | Uwagi |
|---|---|---|---|---|---|
| [z-do] | [linia/Google/OTA] | [data] | [cena lub brak danych] | [czas lub brak danych] | [bagaż/przesiadka/wiarygodność] |

### 🥗 Jedzenie
Top 5 najlepiej ocenianych restauracji healthy food z Google pokaż WYŁĄCZNIE jako tabelę markdown:

| # | Nazwa | Ocena Google | Opinie | Dlaczego pasuje | Dzielnica / adres |
|---|---|---|---|---|---|
| 1 | [nazwa] | [ocena lub brak danych] | [liczba lub brak danych] | [krótko] | [adres lub brak danych] |

### ☕ Kawa
Top 5 najlepiej ocenianych miejsc speciality coffee z Google pokaż WYŁĄCZNIE jako tabelę markdown:

| # | Nazwa | Ocena Google | Opinie | Dlaczego pasuje | Dzielnica / adres |
|---|---|---|---|---|---|
| 1 | [nazwa] | [ocena lub brak danych] | [liczba lub brak danych] | [krótko] | [adres lub brak danych] |

### ✅ Checklist przed wyjazdem
[Lista rzeczy do zrobienia/spakowania]

## TRYB PORÓWNYWANIA:
Gdy użytkownik prosi "porównaj X i Y", sprawdź pogodę, waluty, święta
i informacje o OBU miejscach. Zwróć tabelę porównawczą oraz rekomendację.
W trybie porównywania użyj narzędzi osobno dla każdego miasta.

## ZASADY:
- Używaj PRAWDZIWYCH danych z narzędzi — nie zgaduj
- Jeśli narzędzie zwróci błąd — poinformuj i kontynuuj
- Bądź praktyczny — konkretne rady, nie ogólniki
- Podawaj ceny w PLN (przeliczone po aktualnym kursie)
- Cytuj źródła danych: Open-Meteo, Frankfurter, Nager.Date, Google
- Dla sekcji "Loty" wykonaj Google Search frazą typu:
  "flights [miasto wylotu] to [miasto docelowe] [daty] prices airlines"
- Dla sekcji "Jedzenie" i "Kawa" wykonaj Google Search frazą typu:
  "best rated healthy food restaurants [miasto] Google rating; best rated speciality coffee [miasto] Google rating"
- Jeśli Google nie pokazuje wiarygodnej oceny lub liczby opinii, napisz "brak danych w wynikach Google" zamiast wymyślać
- Wszystkie wyniki wyszukiwania (loty, jedzenie, kawa, porównania) pokazuj jako tabele markdown, nie jako długi ciąg tekstu
- Gdy podajesz nazwę strony lub adres internetowy Costa Broker, zawsze używaj dokładnie: costabroker.com

## OBSŁUGA BŁĘDÓW:
- Jeśli narzędzie zwróci błąd — NIE powtarzaj tego samego wywołania
- Jeśli Wikipedia zwróci błąd albo limit 429 — pomiń Wikipedię i kontynuuj na podstawie pozostałych danych
- Zamiast tego: poinformuj użytkownika i zaproponuj alternatywę
- Przykład: jeśli pogoda nie działa → "Nie udało się sprawdzić pogody w X. Mogę poszukać w Google lub spróbować innego miasta."
- NIGDY nie wywołuj tego samego narzędzia z tymi samymi argumentami dwa razy z rzędu
- Jeśli po 3 nieudanych próbach nie masz danych — powiedz wprost czego brakuje`;

function searchGroundingPrompt() {
  return searchGroundingEnabled
    ? 'Search Grounding / google_search jest włączony przez ENABLE_SEARCH_GROUNDING=true. Używaj go oszczędnie, szczególnie do lotów i aktualnych miejsc.'
    : 'Search Grounding / google_search jest wyłączony kosztowo. Nie próbuj używać google_search; przygotuj plan z darmowych API, Wikipedii, notatek i informacji od użytkownika, a przy brakujących aktualnych danych poproś o link lub doprecyzowanie.';
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
  const wikipediaCache = new Map<string, Record<string, unknown>>();
  let wikipediaCalls = 0;

  const result = streamText({
    model: google('gemini-3.1-flash-lite'),
    system: [travelSystemPrompt, searchGroundingPrompt()].join('\n\n'),
    messages: modelMessages,
    tools: {
      calculator: tool({
        description:
          'Wykonuje obliczenia matematyczne. Używaj do przeliczania budżetu i kosztów podróży.',
        inputSchema: jsonSchema<{ expression: string }>({
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Wyrażenie matematyczne, np. 3000 / 5.12',
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
          'Zwraca aktualną datę i czas. Używaj do ustalenia weekendu, następnego tygodnia lub sezonu.',
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
      getWeather: tool({
        description:
          'Sprawdza aktualną pogodę i prognozę 7 dni dla miasta z Open-Meteo.',
        inputSchema: jsonSchema<{ city: string }>({
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'Nazwa miasta, np. Berlin, Paryż, Tokyo',
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
              country_code: string;
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
            countryCode: place.country_code,
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
              description: 'Kod waluty, np. EUR, GBP, CZK, JPY',
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
          'Pobiera święta publiczne dla kraju i roku z Nager.Date. Używaj z kodem kraju docelowego.',
        inputSchema: jsonSchema<{ countryCode?: string; year?: number }>({
          type: 'object',
          properties: {
            countryCode: {
              type: 'string',
              description: 'Kod kraju ISO 3166-1 alpha-2, np. DE, FR, GB, JP',
            },
            year: {
              type: 'number',
              description: 'Rok, domyślnie bieżący',
            },
          },
          additionalProperties: false,
        }),
        execute: async ({ countryCode = 'PL', year = new Date().getFullYear() }) => {
          const normalizedCountryCode = countryCode.toUpperCase() === 'UK'
            ? 'GB'
            : countryCode.toUpperCase();

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
          'Wyszukuje wyłącznie główne miasto docelowe w Wikipedii i zwraca krótkie streszczenie oraz link. Nie używaj do restauracji, kawiarni, hoteli ani list atrakcji.',
        inputSchema: jsonSchema<{ query: string; language?: string }>({
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Miasto, region lub atrakcja do wyszukania',
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
          const cacheKey = `${normalizedLanguage}:${trimmedQuery.toLowerCase()}`;

          if (!trimmedQuery) {
            return {
              query,
              source: 'Wikipedia',
              warning: 'Pominięto Wikipedię: brak hasła do wyszukania.',
            };
          }

          const cachedResult = wikipediaCache.get(cacheKey);

          if (cachedResult) {
            return cachedResult;
          }

          if (wikipediaCalls >= 2) {
            return {
              query: trimmedQuery,
              source: 'Wikipedia',
              skipped: true,
              warning:
                'Pominięto dodatkowe zapytanie do Wikipedii, aby uniknąć limitu API. Użyj Google Search lub wiedzy ogólnej dla dalszych szczegółów.',
            };
          }

          wikipediaCalls += 1;

          const searchResult = await fetchJsonWithTimeout(
            `https://${normalizedLanguage}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              trimmedQuery,
            )}&format=json&origin=*`,
            'Wikipedia Search',
          );
          if (searchResult.error) {
            const result = {
              query: trimmedQuery,
              source: 'Wikipedia',
              warning: searchResult.error,
              extract:
                'Wikipedia jest chwilowo niedostępna lub zwróciła limit. Kontynuuj plan bez ponawiania tego zapytania.',
            };
            wikipediaCache.set(cacheKey, result);
            return result;
          }

          const searchData = searchResult.data as {
            query?: { search?: Array<{ title: string }> };
          };
          const title = searchData.query?.search?.[0]?.title;

          if (!title) {
            const result = {
              query: trimmedQuery,
              source: 'Wikipedia',
              warning: 'Nie znaleziono hasła w Wikipedii.',
              extract: '',
            };
            wikipediaCache.set(cacheKey, result);
            return result;
          }

          const summaryResult = await fetchJsonWithTimeout(
            `https://${normalizedLanguage}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              title,
            )}`,
            'Wikipedia Summary',
          );
          if (summaryResult.error) {
            const result = {
              query: trimmedQuery,
              title,
              source: 'Wikipedia',
              warning: summaryResult.error,
              extract:
                'Nie udało się pobrać streszczenia z Wikipedii. Kontynuuj plan bez ponawiania tego zapytania.',
            };
            wikipediaCache.set(cacheKey, result);
            return result;
          }

          const summary = summaryResult.data as {
            content_urls?: { desktop?: { page?: string } };
            extract?: string;
          };

          const result = {
            query: trimmedQuery,
            title,
            extract: summary.extract,
            url: summary.content_urls?.desktop?.page,
            source: 'Wikipedia',
          };
          wikipediaCache.set(cacheKey, result);
          return result;
        },
      }),
      readWebPage: tool({
        description:
          'Pobiera i czyta zawartość strony internetowej. Używaj dla konkretnych stron z atrakcjami lub poradami.',
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
          'Zapisuje plan podróży lub ważne ustalenia lokalnie po stronie serwera.',
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
          'Odczytuje zapisane plany i notatki podróżnicze.',
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
    prepareStep: ({ stepNumber }) => {
      if (stepNumber <= 1) {
        return {
          activeTools: [
            'currentDateTime',
            'getWeather',
            'getExchangeRate',
            'getHolidays',
          ],
          toolChoice: 'required',
        };
      }

      if (searchGroundingEnabled && stepNumber <= 3) {
        return {
          activeTools: ['google_search'],
          toolChoice: 'required',
        };
      }

      return {
        activeTools: [],
        toolChoice: 'none',
      };
    },
    // maxSteps: 3 (AI SDK v7 equivalent)
    stopWhen: isStepCount(3),
  });

  return result.toUIMessageStreamResponse({
    onError: (error) =>
      formatAiError(error, 'Nieznany błąd podczas planowania podróży.'),
    sendSources: true,
  });
}
