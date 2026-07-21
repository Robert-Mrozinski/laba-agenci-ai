'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const redirectTo = searchParams.get('redirectTo') || '/';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');

    const credentials = {
      email: email.trim(),
      password,
    };

    const { error: authError } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    if (authError) {
      setError(authError.message);
      setIsSubmitting(false);
      return;
    }

    if (mode === 'register') {
      setMessage('Konto utworzone. Możesz przejść do aplikacji.');
    }

    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-label="Logowanie">
        <img alt="Costa Broker" src="/brand/costa-broker-logo.png" />
        <div>
          <h1>{mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}</h1>
          <p>
            Dostęp do rozmów i bazy wiedzy jest prywatny dla każdego
            użytkownika.
          </p>
        </div>

        {error ? <div className="error-message">{error}</div> : null}
        {message ? <div className="success-message">{message}</div> : null}
        {!supabase ? (
          <div className="error-message">
            Brakuje konfiguracji Supabase. Dodaj zmienne środowiskowe.
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              disabled={isSubmitting}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Hasło</span>
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={isSubmitting}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={isSubmitting || !supabase} type="submit">
            {isSubmitting
              ? 'Pracuję...'
              : mode === 'login'
                ? 'Zaloguj się'
                : 'Zarejestruj się'}
          </button>
        </form>

        <button
          className="auth-switch"
          onClick={() => {
            setMode((currentMode) =>
              currentMode === 'login' ? 'register' : 'login',
            );
            setError('');
            setMessage('');
          }}
          type="button"
        >
          {mode === 'login'
            ? 'Nie masz konta? Zarejestruj się'
            : 'Masz już konto? Zaloguj się'}
        </button>
      </section>
    </main>
  );
}
