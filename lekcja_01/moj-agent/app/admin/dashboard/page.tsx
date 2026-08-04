'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

type Point = {
  day: string;
  value: number;
};

type EndpointPoint = {
  endpoint: string;
  value: number;
};

type AdminDashboardData = {
  charts: {
    conversationsByDay: Point[];
    tokensByDay: Point[];
    tokensByEndpoint: EndpointPoint[];
  };
  generatedAt: string;
  pricing: {
    inputTokenPricePerMillion: number;
    outputTokenPricePerMillion: number;
  };
  recentConversations: Array<{
    createdAt: string;
    email: string;
    id: string;
    messageCount: number;
    title: string;
    updatedAt: string;
  }>;
  stats: {
    conversations: number;
    costTodayUsd: number;
    tokensToday: number;
    users: number;
  };
};

const chartColors = ['#0b2b55', '#b79b59', '#0b6b4f', '#5d8bd8', '#6941c6'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('pl-PL').format(value);
}

function formatCost(value: number) {
  return new Intl.NumberFormat('pl-PL', {
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 4,
    minimumFractionDigits: value >= 1 ? 2 : 4,
    style: 'currency',
  }).format(value);
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
}

function linePath(points: Point[], width: number, height: number) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - (point.value / max) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function LineChart({ points }: { points: Point[] }) {
  const width = 640;
  const height = 180;
  const path = linePath(points, width, height);

  return (
    <div className="usage-line-chart">
      <svg aria-label="Tokeny per dzień" role="img" viewBox={`0 0 ${width} ${height}`}>
        <path d={path} fill="none" stroke="#0b2b55" strokeLinecap="round" strokeWidth="5" />
        {points.map((point, index) => {
          const max = Math.max(...points.map((item) => item.value), 1);
          const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
          const y = height - (point.value / max) * height;

          return (
            <circle cx={x} cy={y} fill="#b79b59" key={point.day} r="6">
              <title>
                {formatDay(point.day)}: {formatNumber(point.value)} tokenów
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="usage-chart-labels">
        {points.map((point) => (
          <span key={point.day}>{formatDay(point.day)}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ points }: { points: Point[] }) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="usage-bar-chart" aria-label="Rozmowy per dzień">
      {points.map((point) => (
        <div className="usage-bar-column" key={point.day}>
          <strong>{formatNumber(point.value)}</strong>
          <span style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} />
          <small>{formatDay(point.day)}</small>
        </div>
      ))}
    </div>
  );
}

function EndpointPie({ points }: { points: EndpointPoint[] }) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  let current = 0;
  const gradient =
    total === 0
      ? '#eef5ff 0deg 360deg'
      : points
          .map((point, index) => {
            const start = current;
            const end = current + (point.value / total) * 360;
            current = end;
            return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
          })
          .join(', ');

  return (
    <div className="usage-pie-wrap">
      <div
        aria-label="Tokeny per endpoint"
        className="usage-pie"
        role="img"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <span>{total ? formatNumber(total) : '0'}</span>
      </div>
      <div className="usage-pie-legend">
        {(points.length ? points : [{ endpoint: 'Brak danych', value: 0 }]).map(
          (point, index) => (
            <div key={point.endpoint}>
              <i style={{ background: chartColors[index % chartColors.length] }} />
              <span>{point.endpoint}</span>
              <strong>{formatNumber(point.value)}</strong>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { session } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function loadDashboard() {
    if (!session?.access_token) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/dashboard', {
        cache: 'no-store',
        headers: {
          authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? 'Nie udało się pobrać dashboardu.');
      }

      setData(body);
    } catch (dashboardError) {
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : 'Nie udało się pobrać dashboardu.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [session?.access_token]);

  const cards = useMemo(
    () => [
      {
        label: 'Użytkownicy',
        value: formatNumber(data?.stats.users ?? 0),
      },
      {
        label: 'Rozmowy',
        value: formatNumber(data?.stats.conversations ?? 0),
      },
      {
        label: 'Tokeny dziś',
        value: formatNumber(data?.stats.tokensToday ?? 0),
      },
      {
        label: 'Koszt dziś',
        value: formatCost(data?.stats.costTodayUsd ?? 0),
      },
    ],
    [data],
  );

  return (
    <main className="usage-shell">
      <header className="usage-hero">
        <div>
          <p>Statystyki agenta</p>
          <h1>📊 Dashboard</h1>
        </div>
        <button disabled={isLoading} onClick={loadDashboard} type="button">
          Odśwież
        </button>
      </header>

      {error ? <div className="security-error">{error}</div> : null}

      <section className="usage-stat-grid" aria-label="Najważniejsze metryki">
        {cards.map((card) => (
          <article className="usage-stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{isLoading ? '...' : card.value}</strong>
          </article>
        ))}
      </section>

      <section className="usage-grid">
        <article className="usage-panel usage-wide-panel">
          <div className="usage-panel-head">
            <h2>🔤 Tokeny per dzień</h2>
            <span>Ostatnie 7 dni</span>
          </div>
          <LineChart points={data?.charts.tokensByDay ?? []} />
        </article>

        <article className="usage-panel">
          <div className="usage-panel-head">
            <h2>💬 Rozmowy per dzień</h2>
            <span>Ostatnie 7 dni</span>
          </div>
          <BarChart points={data?.charts.conversationsByDay ?? []} />
        </article>

        <article className="usage-panel">
          <div className="usage-panel-head">
            <h2>Endpointy</h2>
            <span>Tokeny</span>
          </div>
          <EndpointPie points={data?.charts.tokensByEndpoint ?? []} />
        </article>

        <article className="usage-panel usage-wide-panel">
          <div className="usage-panel-head">
            <h2>Ostatnie rozmowy</h2>
            <span>{data ? formatDate(data.generatedAt) : '...'}</span>
          </div>
          <div className="security-table-wrap">
            <table className="security-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tytuł</th>
                  <th>Wiadomości</th>
                  <th>Aktualizacja</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentConversations.length ? (
                  data.recentConversations.map((conversation) => (
                    <tr key={conversation.id}>
                      <td>{conversation.email}</td>
                      <td>{conversation.title}</td>
                      <td>{formatNumber(conversation.messageCount)}</td>
                      <td>{formatDate(conversation.updatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Brak rozmów do pokazania.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <p className="usage-pricing-note">
        Koszt liczony orientacyjnie: input {formatCost(data?.pricing.inputTokenPricePerMillion ?? 0.15)}
        /1M tokenów, output {formatCost(data?.pricing.outputTokenPricePerMillion ?? 0.6)}
        /1M tokenów.
      </p>
    </main>
  );
}
