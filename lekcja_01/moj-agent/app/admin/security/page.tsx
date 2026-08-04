'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../components/AuthProvider';

type SecurityData = {
  alerts: Array<{
    createdAt: string;
    level: string;
    message: string;
    type: string;
  }>;
  blockedMessages: Array<{
    created_at: string;
    email: string;
    endpoint: string;
    id: string;
    message: string;
    reason: string;
    user_id: string;
  }>;
  generatedAt: string;
  stats: {
    averageTokensPerUser: number;
    blockedMessages: number;
    totalTokensThisWeek: number;
    totalTokensToday: number;
    userCount: number;
  };
  topUsers: Array<{
    email: string;
    percentOfLimit: number;
    tokensThisWeek: number;
    tokensToday: number;
    userId: string;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('pl-PL').format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
}

export default function SecurityPage() {
  const { session } = useAuth();
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  async function loadSecurityData() {
    if (!session?.access_token) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/security', {
        cache: 'no-store',
        headers: {
          authorization: `Bearer ${session.access_token}`,
        },
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? 'Nie udało się pobrać danych panelu.');
      }

      setData(body);
    } catch (securityError) {
      setError(
        securityError instanceof Error
          ? securityError.message
          : 'Nie udało się pobrać danych panelu.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSecurityData();
  }, [session?.access_token]);

  const cards = useMemo(
    () => [
      {
        label: 'Tokeny dziś',
        value: formatNumber(data?.stats.totalTokensToday ?? 0),
      },
      {
        label: 'Tokeny w tygodniu',
        value: formatNumber(data?.stats.totalTokensThisWeek ?? 0),
      },
      {
        label: 'Zablokowane',
        value: formatNumber(data?.stats.blockedMessages ?? 0),
      },
      {
        label: 'Śr. tokeny / user',
        value: formatNumber(data?.stats.averageTokensPerUser ?? 0),
      },
    ],
    [data],
  );

  return (
    <main className="security-shell">
      <header className="security-hero">
        <div>
          <p>Monitoring agenta</p>
          <h1>🛡️ Panel bezpieczeństwa</h1>
        </div>
        <button disabled={isLoading} onClick={loadSecurityData} type="button">
          Odśwież
        </button>
      </header>

      {error ? <div className="security-error">{error}</div> : null}

      <section className="security-stat-grid" aria-label="Statystyki">
        {cards.map((card) => (
          <article className="security-stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{isLoading ? '...' : card.value}</strong>
          </article>
        ))}
      </section>

      <section className="security-grid">
        <article className="security-panel">
          <div className="security-panel-head">
            <h2>⚠️ Zablokowane wiadomości</h2>
            <span>{data?.blockedMessages.length ?? 0}</span>
          </div>
          <div className="security-table-wrap">
            <table className="security-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Wiadomość</th>
                  <th>Powód</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data?.blockedMessages.length ? (
                  data.blockedMessages.map((message) => (
                    <tr key={message.id}>
                      <td>{message.email}</td>
                      <td>{message.message}</td>
                      <td>{message.reason}</td>
                      <td>{formatDate(message.created_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Brak zablokowanych wiadomości.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="security-panel">
          <div className="security-panel-head">
            <h2>📊 Top 5 użytkowników po zużyciu</h2>
            <span>{data?.topUsers.length ?? 0}</span>
          </div>
          <div className="security-table-wrap">
            <table className="security-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Dziś</th>
                  <th>Tydzień</th>
                  <th>% limitu</th>
                </tr>
              </thead>
              <tbody>
                {data?.topUsers.length ? (
                  data.topUsers.map((user) => (
                    <tr key={user.userId}>
                      <td>{user.email}</td>
                      <td>{formatNumber(user.tokensToday)}</td>
                      <td>{formatNumber(user.tokensThisWeek)}</td>
                      <td>
                        <span className={user.percentOfLimit >= 80 ? 'security-chip danger' : 'security-chip'}>
                          {user.percentOfLimit}%
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Brak danych o zużyciu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="security-panel security-alert-panel">
          <div className="security-panel-head">
            <h2>🔴 Alerty</h2>
            <span>{data?.alerts.length ?? 0}</span>
          </div>
          <div className="security-alert-list">
            {data?.alerts.length ? (
              data.alerts.map((alert, index) => (
                <div className={`security-alert ${alert.level}`} key={`${alert.type}-${index}`}>
                  <strong>{alert.message}</strong>
                  <span>{formatDate(alert.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="security-empty">Brak aktywnych alertów.</p>
            )}
          </div>
        </article>

        <article className="security-panel">
          <div className="security-panel-head">
            <h2>📈 Statystyki</h2>
            <span>{data ? formatDate(data.generatedAt) : '...'}</span>
          </div>
          <dl className="security-stats-list">
            <div>
              <dt>Aktywni użytkownicy</dt>
              <dd>{formatNumber(data?.stats.userCount ?? 0)}</dd>
            </div>
            <div>
              <dt>Łączne tokeny dziś</dt>
              <dd>{formatNumber(data?.stats.totalTokensToday ?? 0)}</dd>
            </div>
            <div>
              <dt>Łączne tokeny tydzień</dt>
              <dd>{formatNumber(data?.stats.totalTokensThisWeek ?? 0)}</dd>
            </div>
            <div>
              <dt>Zablokowane wiadomości</dt>
              <dd>{formatNumber(data?.stats.blockedMessages ?? 0)}</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}
