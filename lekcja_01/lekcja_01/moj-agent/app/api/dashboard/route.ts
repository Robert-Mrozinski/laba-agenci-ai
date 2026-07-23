function safeError(error: unknown) {
  return error instanceof Error ? error.message : 'Nieznany błąd.';
}

async function fetchJsonWithTimeout(url: string, label: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return { error: `${label} zwróciło błąd ${response.status}.` };
    }

    return { data: await response.json() };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: `Timeout — ${label} nie odpowiedziało w 5 sekund.` };
    }

    return { error: `Błąd połączenia z ${label}: ${safeError(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

type WeatherPlace = {
  country?: string;
  latitude: number;
  longitude: number;
  locationNote?: string;
  name: string;
};

async function getWeatherForPlace(place: WeatherPlace, locationSource: string) {
  const weatherResult = await fetchJsonWithTimeout(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`,
    'Open-Meteo forecast',
  );

  if (weatherResult.error) {
    return {
      city: place.name,
      country: place.country,
      error: weatherResult.error,
      locationNote: place.locationNote,
      locationSource,
    };
  }

  const weather = weatherResult.data as {
    current?: {
      precipitation?: number;
      relative_humidity_2m?: number;
      temperature_2m?: number;
      time?: string;
      weather_code?: number;
      wind_speed_10m?: number;
    };
  };

  return {
    city: place.name,
    country: place.country,
    current: weather.current,
    locationNote: place.locationNote,
    locationSource,
    source: 'Open-Meteo',
    updatedAt: new Date().toISOString(),
  };
}

async function getWeather(city: string) {
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

  return getWeatherForPlace(place, 'fallback');
}

function isUsableLocationName(value?: string) {
  if (!value) {
    return false;
  }

  return !/ocean|atlantyk|atlantic|morze|sea/i.test(value);
}

async function getWeatherByCoordinates(latitude: number, longitude: number) {
  const locationResult = await fetchJsonWithTimeout(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pl`,
    'BigDataCloud reverse geocoding',
  );
  const locationData = locationResult.data as
    | {
        city?: string;
        countryName?: string;
        locality?: string;
        principalSubdivision?: string;
      }
    | undefined;
  const reverseResult = await fetchJsonWithTimeout(
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&count=1&language=pl&format=json`,
    'Open-Meteo reverse geocoding',
  );
  const reverseData = reverseResult.data as
    | {
        results?: Array<{
          country?: string;
          latitude?: number;
          longitude?: number;
          name?: string;
        }>;
      }
    | undefined;
  const place = reverseData?.results?.[0];
  const candidates = [
    locationData?.city,
    locationData?.locality,
    place?.name,
    locationData?.principalSubdivision,
  ];
  const city = candidates.find(isUsableLocationName) ?? 'Lokalizacja z przeglądarki';
  const country = locationData?.countryName || place?.country;

  return getWeatherForPlace(
    {
      country,
      latitude,
      longitude,
      locationNote:
        city === 'Lokalizacja z przeglądarki'
          ? 'Przeglądarka podała współrzędne, ale serwis map nie rozpoznał nazwy miasta.'
          : 'Pogoda dla miejsca logowania.',
      name: city,
    },
    'browser',
  );
}

async function getExchangeRates(currencies: string[]) {
  const results = await Promise.all(
    currencies.map(async (currency) => {
      const code = currency.toUpperCase();
      const result = await fetchJsonWithTimeout(
        `https://api.frankfurter.app/latest?from=${code}&to=PLN`,
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
        updatedAt: new Date().toISOString(),
      };
    }),
  );

  return results;
}

async function getUpcomingHolidays(countryCode: string, year: number) {
  const result = await fetchJsonWithTimeout(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
    'Nager.Date',
  );

  if (result.error) {
    return { countryCode, year, error: result.error, holidays: [] };
  }

  const today = new Date();
  const holidays = (result.data as Array<{ date: string; localName: string; name: string }>)
    .filter((holiday) => new Date(`${holiday.date}T00:00:00`) >= today)
    .slice(0, 4);

  return {
    countryCode,
    holidays,
    source: 'Nager.Date',
    updatedAt: new Date().toISOString(),
    year,
  };
}

export async function GET(request: Request) {
  const now = new Date();
  const year = now.getFullYear();
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get('lat'));
  const longitude = Number(searchParams.get('lon'));
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const [weather, rates, holidays] = await Promise.all([
    hasCoordinates ? getWeatherByCoordinates(latitude, longitude) : getWeather('Warszawa'),
    getExchangeRates(['EUR', 'USD']),
    getUpcomingHolidays('PL', year),
  ]);

  return Response.json({
    generatedAt: now.toISOString(),
    holidays,
    rates,
    time: {
      iso: now.toISOString(),
      local: new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Europe/Madrid',
      }).format(now),
      timeZone: 'Europe/Madrid',
    },
    weather,
  });
}
