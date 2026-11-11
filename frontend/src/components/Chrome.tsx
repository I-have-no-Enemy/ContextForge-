import { useEffect, useState } from 'react';
import { fetchHealth } from '../services/api';
import { href, navigate, type Route } from '../lib/router';
import { useSession } from '../lib/session';
import { useToast } from '../lib/toast';
import { useCart } from '../lib/cart';
import { useTheme } from '../lib/theme';
import { StatusBadge } from './ui/badge';
import { BookOpen, Gavel, House, Moon, ShoppingBagOpen, Sun, UserCircle } from './icons';

const API_DOCS_URL = 'https://github.com/I-have-no-Enemy/ContextForge-/blob/main/docs/API.md';

const goToCart = (route: Route) => {
  if (route.name !== 'browse') navigate(href.browse());
  window.setTimeout(() => document.getElementById('config-cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};

/** Floating glass navigation bar (functional layer). Collapses to the dock below 900px. */
export function Topbar({ route }: { route: Route }) {
  const { user, logout, requestSignIn } = useSession();
  const toast = useToast();
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState<'healthy' | 'down' | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(h.status === 'healthy' ? 'healthy' : 'down'))
      .catch(() => setHealth('down'));
  }, []);

  const link = (to: string, label: string, active: boolean) => (
    <li>
      <a className="glass-btn" href={to} aria-current={active ? 'page' : undefined}>
        {label}
      </a>
    </li>
  );

  return (
    <header className="topbar pg">
      <nav className="topbar__inner glass glass--pill" aria-label="Primary">
        <a className="wordmark" href={href.browse()}>
          ContextForge <i>/ registry</i>
        </a>
        <ul className="topbar__links">
          {link(href.browse(), 'Browse', ['browse', 'server', 'skill'].includes(route.name))}
          {user && link(href.workspace(), 'Workspace', route.name === 'workspace')}
          {user?.role === 'admin' && link(href.admin(), 'Admin', route.name === 'admin')}
          <li>
            <a className="glass-btn" href={API_DOCS_URL} target="_blank" rel="noreferrer">
              API docs
            </a>
          </li>
        </ul>
        <div className="topbar__meta">
          <StatusBadge tone={health === 'healthy' ? 'live' : health === 'down' ? 'alert' : 'idle'}>
            {health === 'healthy' ? 'API live' : health === 'down' ? 'API offline' : 'Connecting'}
          </StatusBadge>
          <button
            type="button"
            className="glass-btn"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <>
              <span className="topbar__user">
                <b>{user.email.split('@')[0]}</b> · {user.role}
              </span>
              <button
                type="button"
                className="glass-btn"
                onClick={async () => {
                  await logout();
                  toast('Signed out.');
                  if (route.name === 'workspace' || route.name === 'admin') navigate(href.browse());
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="glass-btn topbar__signin" aria-pressed="true" onClick={requestSignIn}>
              Sign in
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

/** iOS-style tab bar for phones: the same destinations as the top bar, within thumb reach. */
export function Dock({ route }: { route: Route }) {
  const { user, requestSignIn } = useSession();
  const cart = useCart();
  return (
    <nav className="dock glass glass--pill glass--strong" aria-label="Quick navigation">
      <a className="glass-btn" href={href.browse()} aria-current={['browse', 'server', 'skill'].includes(route.name) ? 'page' : undefined}>
        <House size={22} aria-hidden="true" />
        Browse
      </a>
      {user ? (
        <a className="glass-btn" href={href.workspace()} aria-current={route.name === 'workspace' ? 'page' : undefined}>
          <UserCircle size={22} aria-hidden="true" />
          Workspace
        </a>
      ) : (
        <button type="button" className="glass-btn" onClick={requestSignIn}>
          <UserCircle size={22} aria-hidden="true" />
          Sign in
        </button>
      )}
      {user?.role === 'admin' && (
        <a className="glass-btn" href={href.admin()} aria-current={route.name === 'admin' ? 'page' : undefined}>
          <Gavel size={22} aria-hidden="true" />
          Admin
        </a>
      )}
      <a className="glass-btn" href={API_DOCS_URL} target="_blank" rel="noreferrer">
        <BookOpen size={22} aria-hidden="true" />
        API docs
      </a>
      <button type="button" className="glass-btn" onClick={() => goToCart(route)} aria-label={`Config cart, ${cart.items.length} items`}>
        <ShoppingBagOpen size={22} aria-hidden="true" />
        Cart
        {cart.items.length > 0 && <span className="dock__count">{cart.items.length > 99 ? '99+' : cart.items.length}</span>}
      </button>
    </nav>
  );
}
