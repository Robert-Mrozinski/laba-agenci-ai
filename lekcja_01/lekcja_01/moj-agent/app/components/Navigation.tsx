'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';

const navItems = [
  { href: '/', icon: '🏠', label: 'Dashboard' },
  { href: '/agent', icon: '🤖', label: 'Agent' },
  { href: '/history', icon: '📜', label: 'Historia' },
  { href: '/react', icon: '🔄', label: 'ReAct' },
  { href: '/email-triage', icon: '📧', label: 'E-mail Triage' },
  { href: '/report', icon: '📊', label: 'Raporty' },
  { href: '/competitor', icon: '🏢', label: 'Konkurencja' },
  { href: '/travel', icon: '✈️', label: 'Podróże' },
  { href: '/chat', icon: '💬', label: 'Chat' },
  { href: '/think', icon: '🧠', label: 'Myślenie' },
  { href: '/search', icon: '🌐', label: 'Szukaj' },
  { href: '/upload', icon: '📚', label: 'Baza wiedzy' },
  { href: '/knowledge', icon: '👁️', label: 'Podgląd wiedzy' },
  { href: '/generate', icon: '🎨', label: 'Grafiki' },
  { href: '/vision', icon: '👁️', label: 'Vision' },
  { href: '/extract', icon: '📊', label: 'Analizator' },
  { href: '/fewshot', icon: '📚', label: 'Słownik' },
  { href: '/format', icon: '📐', label: 'Formater' },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (pathname === '/login') {
    return null;
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setIsOpen(false);
    router.replace('/login');
    router.refresh();
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="Otwórz menu"
        className="mobile-nav-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        ☰
      </button>
      <nav className={`top-nav app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Nawigacja">
        <strong className="sidebar-brand">
          <img alt="Costa Broker" src="/brand/costa-broker-logo.png" />
        </strong>
        {navItems.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' || pathname === '/dashboard' : pathname === item.href;

          return (
            <Link
              className={active ? 'primary-link' : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <div className="sidebar-auth">
          {session?.user.email ? <span>{session.user.email}</span> : null}
          <button onClick={signOut} type="button">
            Wyloguj
          </button>
        </div>
      </nav>
    </>
  );
}
