import { google } from '@ai-sdk/google';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { supabase } from '../../../../lib/supabase';
import { formatAiError } from '../../errorMessages';

const briefingCity = process.env.MORNING_BRIEFING_CITY ?? 'Warszawa';
const briefingTimeZone = process.env.MORNING_BRIEFING_TIME_ZONE ?? 'Europe/Warsaw';

type NewsItem = {
  link: string;
  publishedAt: string;
  source: string;
  title: string;
};

type WeatherData = {
  city: string;
  country?: string;
  current?: {
    precipitation?: number;
    relative_humidity_2m?: number;
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  error?: string;
  source?: string;
};

type ExchangeRate = {
  currency: string;
  date?: string;
  error?: string;
  rate?: number;
  source?: string;
};

type Holiday = {
  date: string;
  localName: string;
  name: string;
};

function safeError(error: unknown) {
  return error instanceof Error ? error.message : 'Nieznany blad.';
}

async function authorizeCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json(
      { error: 'Brakuje CRON_SECRET w zmiennych srodowiskowych.' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader === `Bearer ${cronSecret}`) {
    return null;
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (supabase && token) {
    const { data } = await supabase.auth.getUser(token);

    if (data.user) {
      return null;
    }
  }

  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

async function fetchJsonWithTimeout(url: string, label: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `${label} zwrocilo blad ${response.status}.` };
    }

    return { data: await response.json() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: `Timeout - ${label} nie odpowiedzialo w 7 sekund.` };
    }

    return { error: `Blad polaczenia z ${label}: ${safeError(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithTimeout(url: string, label: string, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'user-agent': 'moj-agent-morning-briefing/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `${label} zwrocilo blad ${response.status}.` };
    }

    return { data: await response.text() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: `Timeout - ${label} nie odpowiedzialo w 7 sekund.` };
    }

    return { error: `Blad polaczenia z ${label}: ${safeError(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagValue(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '';
}

function weatherDescription(code?: number) {
  if (typeof code !== 'number') {
    return 'brak opisu';
  }

  if (code === 0) return 'bezchmurnie';
  if ([1, 2, 3].includes(code)) return 'czesciowe zachmurzenie';
  if ([45, 48].includes(code)) return 'mgla';
  if ([51, 53, 55, 56, 57].includes(code)) return 'mzawka';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'deszcz';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snieg';
  if ([95, 96, 99].includes(code)) return 'burza';

  return `kod pogody ${code}`;
}

function localDateParts(now: Date) {
  const date = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: briefingTimeZone,
    year: 'numeric',
  }).format(now);

  return {
    date,
    displayDate: new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'full',
      timeZone: briefingTimeZone,
    }).format(now),
    weekday: new Intl.DateTimeFormat('pl-PL', {
      timeZone: briefingTimeZone,
      weekday: 'long',
    }).format(now),
  };
}

async function getWeather(city: string): Promise<WeatherData> {
  const geoResult = await fetchJsonWithTimeout(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city,
    )}&count=1&language=pl&format=json`,
    'Open-Meteo geocoding',
  );

  if (geoResult.error) {
    return { city, error: geoResult.error };
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
    return { city, error: `Nie znaleziono miasta ${city}.` };
  }

  const weatherResult = await fetchJsonWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`,
    'Open-Meteo forecast',
  );

  if (weatherResult.error) {
    return { city: place.name, country: place.country, error: weatherResult.error };
  }

  const weather = weatherResult.data as { current?: WeatherData['current'] };

  return {
    city: place.name,
    country: place.country,
    current: weather.current,
    source: 'Open-Meteo',
  };
}

async function getExchangeRate(currency: string): Promise<ExchangeRate> {
  const code = currency.trim().toUpperCase();

  const result = await fetchJsonWithTimeout(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(code)}&to=PLN`,
    `Frankfurter ${code}`,
  );

  if (result.error) {
    return { currency: code, error: result.error };
  }

  const data = result.data as { date?: string; rates?: { PLN?: number } };

  return {
    currency: code,
    date: data.date,
    rate: data.rates?.PLN,
    source: 'Frankfurter API',
  };
}

async function getPolishHoliday(date: string) {
  const year = Number(date.slice(0, 4));
  const result = await fetchJsonWithTimeout(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/PL`,
    'Nager.Date',
  );

  if (result.error) {
    return { error: result.error, holiday: null };
  }

  const holidays = result.data as Holiday[];
  const holiday = holidays.find((item) => item.date === date) ?? null;

  return { holiday, source: 'Nager.Date' };
}

async function getNews() {
  const result = await fetchTextWithTimeout(
    'https://news.google.com/rss?hl=pl&gl=PL&ceid=PL:pl',
    'Google News RSS',
  );

  if (result.error) {
    return { error: result.error, items: [] as NewsItem[] };
  }

  const items = [...(result.data ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, 6)
    .map((match) => {
      const item = match[1];

      return {
        link: decodeXml(tagValue(item, 'link')),
        publishedAt: decodeXml(tagValue(item, 'pubDate')),
        source: decodeXml(tagValue(item, 'source')) || 'Google News',
        title: decodeXml(tagValue(item, 'title')),
      };
    })
    .filter((item) => item.title);

  return { items, source: 'Google News RSS' };
}

function createSupabaseForCron() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey);
  }

  return supabase;
}

function buildFallbackBriefing({
  date,
  holiday,
  news,
  rates,
  weather,
  weekday,
}: {
  date: string;
  holiday: Holiday | null;
  news: NewsItem[];
  rates: ExchangeRate[];
  weather: WeatherData;
  weekday: string;
}) {
  const temperature = weather.current?.temperature_2m;
  const description = weatherDescription(weather.current?.weather_code);
  const rateLines = rates
    .map((rate) => `- ${rate.currency}: ${rate.rate?.toFixed(4) ?? 'brak danych'} PLN`)
    .join('\n');
  const newsLines = news
    .slice(0, 5)
    .map((item) => `- ${item.title} (${item.source})`)
    .join('\n');

  return `# Dzien dobry! Twoj briefing na ${date}

## Pogoda
${weather.city}: ${temperature ?? 'brak danych'}°C, ${description}. Wez pod uwage wiatr ${weather.current?.wind_speed_10m ?? 'brak danych'} km/h i opady ${weather.current?.precipitation ?? 'brak danych'} mm.

## Kursy walut
${rateLines}

## Wiadomosci
${newsLines || '- Brak aktualnych naglowkow z RSS.'}

## Dzisiejszy dzien
- Dzien tygodnia: ${weekday}
- Uwagi: ${holiday ? `Dzis jest swieto: ${holiday.localName}.` : 'Brak ogolnopolskiego swieta publicznego w kalendarzu Nager.Date.'}

## Porada dnia
Wybierz jedna najwazniejsza rzecz na start dnia i zrob ja zanim rozproszysz sie drobiazgami.`;
}

export async function GET(request: Request) {
  const unauthorizedResponse = await authorizeCronRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const now = new Date();
  const { date, displayDate, weekday } = localDateParts(now);
  const [weather, eur, usd, holidayResult, newsResult] = await Promise.all([
    getWeather(briefingCity),
    getExchangeRate('EUR'),
    getExchangeRate('USD'),
    getPolishHoliday(date),
    getNews(),
  ]);
  const rates = [eur, usd];
  const rateLines = rates
    .map((rate) => `- ${rate.currency}: ${rate.rate?.toFixed(4) ?? 'brak danych'} PLN`)
    .join('\n');
  const holiday = holidayResult.holiday;
  const news = newsResult.items;
  const newsLines = news
    .slice(0, 5)
    .map((item) => `- [${item.title}](${item.link}) (${item.source})`)
    .join('\n');

  try {
    const result = await generateText({
      model: google('gemini-3.1-flash-lite'),
      system: `Jestes osobistym asystentem. Napisz poranny briefing w formacie:

# Dzien dobry! Twoj briefing na [data]

## Pogoda
[temperatura, opis, co ubrac]

## Kursy walut
- EUR: [kurs] PLN
- USD: [kurs] PLN

## Wiadomosci
[3-5 najwazniejszych naglowkow jako linki Markdown: - [tytul](url)]

## Dzisiejszy dzien
- Dzien tygodnia: [...]
- Uwagi: [czy dzis swieto? dzien wolny?]

## Porada dnia
[Krotka, pozytywna porada na dzien]

Pisz po polsku, konkretnie, bez wymyslania danych. Jesli czegos brakuje, napisz "brak danych".`,
      prompt: JSON.stringify(
        {
          date: displayDate,
          holiday,
          news,
          newsLines,
          rateLines,
          rates,
          sources: {
            exchangeRates: 'Frankfurter API',
            holidays: 'Nager.Date',
            news: 'Google News RSS',
            weather: 'Open-Meteo',
          },
          weather: {
            ...weather,
            description: weatherDescription(weather.current?.weather_code),
          },
          weekday,
        },
        null,
        2,
      ),
    });

    const content = result.text.trim();
    const db = createSupabaseForCron();

    if (!db) {
      return Response.json(
        {
          error:
            'Brakuje konfiguracji Supabase. Ustaw NEXT_PUBLIC_SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY albo NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        },
        { status: 500 },
      );
    }

    const { error } = await db.from('briefings').insert({
      content,
      date,
    });

    if (error) {
      return Response.json(
        {
          error:
            `${error.message} Uruchom supabase-briefings-migration.sql i upewnij sie, ze endpoint ma SUPABASE_SERVICE_ROLE_KEY albo tabela pozwala na insert.`,
        },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      date,
      preview: content.slice(0, 220),
    });
  } catch (error) {
    const fallbackContent = buildFallbackBriefing({
      date: displayDate,
      holiday,
      news,
      rates,
      weather,
      weekday,
    });

    const db = createSupabaseForCron();

    if (db) {
      await db.from('briefings').insert({
        content: fallbackContent,
        date,
      });
    }

    return Response.json(
      {
        error: formatAiError(error, 'Nie udalo sie wygenerowac briefingu.'),
        fallbackSaved: Boolean(db),
        preview: fallbackContent.slice(0, 220),
      },
      { status: 500 },
    );
  }
}
