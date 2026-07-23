'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type DashboardData = {
  generatedAt: string;
  holidays: {
    countryCode: string;
    error?: string;
    holidays: Array<{ date: string; localName: string; name: string }>;
    source?: string;
    updatedAt?: string;
    year: number;
  };
  rates: Array<{
    currency: string;
    date?: string;
    error?: string;
    rate?: number;
    source?: string;
    updatedAt?: string;
  }>;
  time: {
    iso: string;
    local: string;
    timeZone: string;
  };
  weather: {
    city: string;
    country?: string;
    current?: {
      precipitation?: number;
      relative_humidity_2m?: number;
      temperature_2m?: number;
      time?: string;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    error?: string;
    locationNote?: string;
    locationSource?: string;
    source?: string;
    updatedAt?: string;
  };
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const quickActions = [
  { href: '/travel', icon: '🌍', label: 'Zaplanuj podróż' },
  {
    href: '/react?prompt=Por%C3%B3wnaj%20kursy%20EUR%2C%20USD%2C%20GBP%2C%20CHF',
    icon: '📊',
    label: 'Porównaj waluty',
  },
  { href: '/react', icon: '🔄', label: 'Agent ReAct' },
  { href: '/chat', icon: '💬', label: 'Chat z agentem' },
  { href: '/think', icon: '🧠', label: 'Tryb myślenia' },
  { href: '/fewshot', icon: '📖', label: 'Słownik AI' },
];

function formatTime(iso?: string) {
  if (!iso) {
    return 'brak danych';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}

function daysUntil(date: string) {
  const today = new Date();
  const target = new Date(`${date}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(
    0,
    Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function weatherEmoji(code?: number) {
  if (code == null) {
    return '🌤️';
  }

  if (code === 0) {
    return '☀️';
  }

  if ([1, 2, 3].includes(code)) {
    return '⛅';
  }

  if (code >= 45 && code <= 48) {
    return '🌫️';
  }

  if (code >= 51 && code <= 67) {
    return '🌧️';
  }

  if (code >= 71 && code <= 77) {
    return '❄️';
  }

  if (code >= 80) {
    return '⛈️';
  }

  return '🌤️';
}

function SkeletonCard({ title }: { title: string }) {
  return (
    <section className="dashboard-card skeleton-card">
      <h2>{title}</h2>
      <span />
      <span />
      <span />
    </section>
  );
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [locationFallbackNote, setLocationFallbackNote] = useState('');
  const coordinatesRef = useRef<Coordinates | null>(null);

  const nextHoliday = data?.holidays.holidays[0];
  const weatherLocationNote =
    data?.weather.locationNote ||
    (data?.weather.locationSource === 'fallback'
      ? locationFallbackNote || 'Pogoda zastępcza dla Warszawy.'
      : 'Pogoda dla miejsca logowania.');
  const greetingDate = useMemo(() => {
    const currentDate = data?.time.iso ? new Date(data.time.iso) : new Date();
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'full',
      timeZone: 'Europe/Madrid',
    }).format(currentDate);
  }, [data?.time.iso]);

  async function loadDashboard(coordinates = coordinatesRef.current) {
    setIsLoading(true);
    setError('');

    try {
      const params = coordinates
        ? `?lat=${coordinates.latitude}&lon=${coordinates.longitude}`
        : '';
      const response = await fetch(`/api/dashboard${params}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Dashboard API zwróciło ${response.status}.`);
      }

      setData(await response.json());
    } catch (dashboardError) {
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : 'Nie udało się pobrać danych dashboardu.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const startFallback = (message: string) => {
      coordinatesRef.current = null;
      setLocationFallbackNote(message);
      void loadDashboard(null);
    };

    if (!navigator.geolocation) {
      startFallback('Przeglądarka nie udostępnia lokalizacji, pokazuję Warszawę.');
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinates = {
            latitude: Number(position.coords.latitude.toFixed(5)),
            longitude: Number(position.coords.longitude.toFixed(5)),
          };

          coordinatesRef.current = coordinates;
          setLocationFallbackNote('');
          void loadDashboard(coordinates);
        },
        () => {
          startFallback('Brak zgody na lokalizację, pokazuję Warszawę.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 12000,
        },
      );
    }

    const weatherRefresh = window.setInterval(() => void loadDashboard(), 15 * 60 * 1000);
    const ratesRefresh = window.setInterval(() => void loadDashboard(), 60 * 60 * 1000);

    return () => {
      window.clearInterval(weatherRefresh);
      window.clearInterval(ratesRefresh);
    };
  }, []);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-hero">
        <div className="dashboard-hero-brand">
          <img alt="Costa Broker" src="/brand/costa-broker-logo.png" />
          <div>
            <p>🌅 Dzień dobry Monika</p>
            <h1>Dziś: {greetingDate}</h1>
          </div>
        </div>
        <button
          aria-label="Odśwież dane"
          disabled={isLoading}
          onClick={() => void loadDashboard()}
          type="button"
        >
          🔄
        </button>
      </header>

      {error ? <div className="error-message dashboard-error">{error}</div> : null}

      {isLoading && !data ? (
        <div className="dashboard-grid">
          <SkeletonCard title="🌤️ Pogoda" />
          <SkeletonCard title="💶 Kursy walut" />
          <SkeletonCard title="📅 Nadchodzące święta" />
          <SkeletonCard title="🍽️ Jedzenie w podróży" />
          <SkeletonCard title="🤖 Szybkie akcje" />
        </div>
      ) : (
        <div className="dashboard-grid">
          <section className="dashboard-card weather-dashboard-card">
            <div className="dashboard-card-head">
              <h2>🌤️ Pogoda</h2>
              <small>Ostatnia aktualizacja: {formatTime(data?.weather.updatedAt)}</small>
            </div>
            {data?.weather.error ? (
              <p className="dashboard-card-error">{data.weather.error}</p>
            ) : (
              <>
                <p className="dashboard-location">
                  {data?.weather.city}, {data?.weather.country}
                </p>
                <p className="dashboard-muted">{weatherLocationNote}</p>
                <strong>
                  {weatherEmoji(data?.weather.current?.weather_code)}{' '}
                  {Math.round(data?.weather.current?.temperature_2m ?? 0)}°C
                </strong>
                <dl>
                  <div>
                    <dt>Wiatr</dt>
                    <dd>{Math.round(data?.weather.current?.wind_speed_10m ?? 0)} km/h</dd>
                  </div>
                  <div>
                    <dt>Wilgotność</dt>
                    <dd>{Math.round(data?.weather.current?.relative_humidity_2m ?? 0)}%</dd>
                  </div>
                  <div>
                    <dt>Opad</dt>
                    <dd>{data?.weather.current?.precipitation ?? 0} mm</dd>
                  </div>
                </dl>
              </>
            )}
          </section>

          <section className="dashboard-card rates-dashboard-card">
            <div className="dashboard-card-head">
              <h2>💶 Kursy walut</h2>
              <small>Ostatnia aktualizacja: {formatTime(data?.rates[0]?.updatedAt)}</small>
            </div>
            <div className="rate-list">
              {data?.rates.map((rate) => (
                <div className="rate-row" key={rate.currency}>
                  <span>{rate.currency}</span>
                  <strong>
                    {rate.rate ? `${rate.rate.toFixed(4)} PLN` : 'brak danych'}
                  </strong>
                </div>
              ))}
            </div>
            <p className="dashboard-muted">
              Kurs z: {data?.rates[0]?.date ?? 'brak daty'} ({data?.rates[0]?.source ?? 'API'})
            </p>
          </section>

          <section className="dashboard-card holidays-dashboard-card">
            <div className="dashboard-card-head">
              <h2>📅 Nadchodzące święta</h2>
              <small>Ostatnia aktualizacja: {formatTime(data?.holidays.updatedAt)}</small>
            </div>
            <div className="holiday-list">
              {data?.holidays.holidays.map((holiday) => (
                <div className="holiday-row" key={holiday.date}>
                  <time>
                    {new Intl.DateTimeFormat('pl-PL', {
                      day: 'numeric',
                      month: 'short',
                    }).format(new Date(`${holiday.date}T00:00:00`))}
                  </time>
                  <span>{holiday.localName}</span>
                </div>
              ))}
            </div>
            {nextHoliday ? (
              <p className="dashboard-muted">Następne za: {daysUntil(nextHoliday.date)} dni</p>
            ) : (
              <p className="dashboard-muted">Brak nadchodzących świąt w tym roku</p>
            )}
          </section>

          <section className="dashboard-card food-dashboard-card">
            <div className="dashboard-card-head">
              <h2>🍽️ Jedzenie w podróży</h2>
              <small>Nowa funkcja asystenta</small>
            </div>
            <p className="dashboard-location">Restauracje i lokalne smaki</p>
            <p className="dashboard-muted">
              Agent podróży podpowie, co warto zjeść i gdzie szukać dobrych miejsc
              w wybranym mieście.
            </p>
            <div className="travel-feature-list">
              <span>✅ sugestie restauracji</span>
              <span>✅ lokalne dania</span>
              <span>✅ pomysły pod budżet</span>
            </div>
            <Link className="dashboard-feature-link" href="/travel">
              🌍 Zapytaj asystenta podróży
            </Link>
          </section>

          <section className="dashboard-card actions-dashboard-card">
            <div className="dashboard-card-head">
              <h2>🤖 Szybkie akcje</h2>
              <small>Centrum dowodzenia</small>
            </div>
            <div className="quick-actions">
              {quickActions.map((action) => (
                <Link href={action.href} key={action.href}>
                  <span>{action.icon}</span>
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
