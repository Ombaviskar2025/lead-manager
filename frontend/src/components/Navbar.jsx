import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const THEME_KEY = 'lm_theme';

function initialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function Logo() {
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true">L</span>
      <span className="logo-text">Lead<b>Manager</b></span>
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <div className="navbar-right">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div className="user-chip" title={user?.email}>
            <span className="avatar avatar-sm" aria-hidden="true">{user?.name?.[0]?.toUpperCase()}</span>
            <span className="user-name">{user?.name}</span>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={logout}>Log out</button>
        </div>
      </div>
    </header>
  );
}
