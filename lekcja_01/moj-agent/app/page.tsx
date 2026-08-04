'use client';

import Link from 'next/link';
import { Dashboard } from './components/Dashboard';
import { useAuth } from './components/AuthProvider';

const features = [
  {
    icon: '🧠',
    title: 'Pamięta Twoje rozmowy',
    description:
      'Wracasz do wątku bez tłumaczenia wszystkiego od początku. Agent trzyma kontekst pracy i preferencji.',
  },
  {
    icon: '📚',
    title: 'Zna dokumenty Twojej firmy',
    description:
      'Odpowiada na podstawie prywatnej bazy wiedzy, ofert, notatek i materiałów, które mu przekażesz.',
  },
  {
    icon: '🔐',
    title: 'Prywatne dane per user',
    description:
      'Każde konto ma własny dostęp, historię i dokumenty, więc informacje zostają po właściwej stronie drzwi.',
  },
  {
    icon: '⚡',
    title: 'Pracuje 24/7',
    description:
      'Poranne briefingi, raporty i szybkie akcje pomagają utrzymać rytm pracy nawet wtedy, gdy Ty dopiero parzysz kawę.',
  },
];

const stats = [
  { value: '30 s', label: 'do startu' },
  { value: '24/7', label: 'automatyzacje' },
  { value: '1:1', label: 'prywatny kontekst' },
];

function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav" aria-label="Nawigacja publiczna">
        <Link className="landing-logo" href="/">
          <img alt="Costa Broker" src="/brand/costa-broker-logo.png" />
          <span>AI workspace</span>
        </Link>
        <nav>
          <a href="#demo">Demo</a>
          <Link className="landing-login-link" href="/login">
            Zaloguj się
          </Link>
          <Link className="landing-primary nav-cta" href="/login">
            Zacznij za darmo
          </Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="landing-kicker">Asystent dla pracy z wiedzą</p>
          <h1 id="landing-title">Costa Broker AI</h1>
          <p className="landing-tagline">
            Twój osobisty asystent AI z bazą wiedzy firmy, historią rozmów i
            automatyzacjami, które zdejmują z głowy codzienny research.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary" href="/login">
              Zacznij za darmo
            </Link>
            <a className="landing-secondary" href="#demo">
              Zobacz demo
            </a>
          </div>
          <div className="landing-stats" aria-label="Najważniejsze liczby">
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-hero-stack">
          <section className="landing-auth-panel" aria-labelledby="auth-panel-title">
            <p className="landing-kicker">Panel logowania</p>
            <h2 id="auth-panel-title">Wejdź do swojego agenta</h2>
            <p>
              Zaloguj się, żeby wrócić do dashboardu, historii rozmów i prywatnej
              bazy wiedzy.
            </p>
            <div className="landing-auth-actions">
              <Link className="landing-primary" href="/login">
                Zacznij za darmo
              </Link>
              <Link className="landing-auth-secondary" href="/login">
                Zaloguj się
              </Link>
            </div>
          </section>

          <div className="landing-preview" aria-label="Screenshot interfejsu agenta">
            <div className="preview-window main-preview">
              <div className="preview-bar">
                <span />
                <span />
                <span />
                <strong>Costa Broker AI</strong>
              </div>
              <div className="preview-chat">
                <div className="preview-message user">
                  Zapytaj o cennik apartamentów w Marbelli i źródła.
                </div>
                <div className="preview-message assistant">
                  Znalazłem aktualne widełki w Twoich dokumentach. Dla Marbelli
                  segment premium zaczyna się od 720 tys. EUR, a najlepsze leady
                  mają budżet od 950 tys. EUR.
                </div>
                <div className="preview-sources">
                  <span>Oferta Q3.pdf</span>
                  <span>Notatki sprzedażowe</span>
                </div>
              </div>
            </div>

            <div className="preview-window side-preview">
              <div className="mini-chart">
                <span style={{ height: '46%' }} />
                <span style={{ height: '72%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '88%' }} />
              </div>
              <div>
                <strong>Briefing gotowy</strong>
                <p>Nowe leady, kurs EUR i priorytety dnia.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features" aria-label="Możliwości agenta">
        {features.map((feature) => (
          <article className="landing-feature-card" key={feature.title}>
            <span>{feature.icon}</span>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="landing-demo" id="demo" aria-labelledby="demo-title">
        <div>
          <p className="landing-kicker">Demo w praktyce</p>
          <h2 id="demo-title">Zapytaj o cennik, a agent odpowie z Twoich dokumentów.</h2>
          <p>
            Costa Broker AI łączy chat, wyszukiwanie w bazie wiedzy, raporty i
            poranne briefingi w jednym miejscu. Zamiast przekopywać pliki, pytasz
            normalnym językiem i dostajesz odpowiedź z kontekstem.
          </p>
        </div>
        <div className="demo-screenshots" aria-label="Screenshoty funkcji">
          <figure>
            <div className="screenshot-card knowledge-shot">
              <header>
                <span>📚</span>
                <strong>Baza wiedzy</strong>
              </header>
              <p>Oferta Q3.pdf</p>
              <p>Cennik Costa del Sol</p>
              <p>FAQ klientów</p>
            </div>
            <figcaption>Dokumenty firmowe gotowe do zapytań</figcaption>
          </figure>
          <figure>
            <div className="screenshot-card report-shot">
              <header>
                <span>📊</span>
                <strong>Raport</strong>
              </header>
              <div />
              <div />
              <div />
            </div>
            <figcaption>Odpowiedzi, raporty i źródła w jednym widoku</figcaption>
          </figure>
        </div>
      </section>

      <section className="landing-final-cta">
        <div>
          <p className="landing-kicker">Gotowy?</p>
          <h2>Zacznij w 30 sekund.</h2>
        </div>
        <Link className="landing-primary" href="/login">
          Stwórz konto
        </Link>
      </section>
    </main>
  );
}

export default function Home() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <h1>Costa Broker</h1>
          <p>Sprawdzam logowanie...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  return <Dashboard />;
}
