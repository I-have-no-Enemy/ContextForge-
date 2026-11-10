import { Component, useEffect, useState, type ReactNode } from 'react';
import { fetchHealth } from './services/api';
import { href, navigate, useRoute, type Route } from './lib/router';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider, useToast } from './lib/toast';
import { CartProvider, clientLabel, useCart } from './lib/cart';
import { Button } from './components/ui/button';
import { StatusBadge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { AuthDialog } from './components/AuthDialog';
import { BrowseView } from './views/BrowseView';
import { ServerDetailView, SkillDetailView } from './views/DetailViews';
import { WorkspaceView } from './views/WorkspaceView';
import { AdminView } from './views/AdminView';

/** A render error in one page shows a recoverable message instead of a blank screen. */
class PageBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="section pg">
        <EmptyState
          heading="This page hit an error"
          action={
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          {this.state.error.message}
        </EmptyState>
      </section>
    );
  }
}

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'browse':
      return <BrowseView />;
    case 'server':
      return <ServerDetailView key={route.id} id={route.id} />;
    case 'skill':
      return <SkillDetailView key={route.id} id={route.id} />;
    case 'workspace':
      return <WorkspaceView tab={route.tab} />;
    case 'admin':
      return <AdminView />;
    default:
      return (
        <section className="section pg">
          <EmptyState
            heading="Page not found"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate(href.browse())}>
                Back to registry
              </Button>
            }
          >
            This address does not match any page.
          </EmptyState>
        </section>
      );
  }
}

function Nav({ route }: { route: Route }) {
  const { user, logout, requestSignIn } = useSession();
  const toast = useToast();
  const [health, setHealth] = useState<'healthy' | 'down' | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(h.status === 'healthy' ? 'healthy' : 'down'))
      .catch(() => setHealth('down'));
  }, []);

  const link = (to: string, label: string, active: boolean) => (
    <li>
      <a href={to} aria-current={active ? 'page' : undefined}>
        {label}
      </a>
    </li>
  );

  return (
    <nav className="site-nav" aria-label="Primary">
      <a className="wordmark" href={href.browse()}>
        ContextForge <i>/ registry</i>
      </a>
      <ul className="site-nav__links">
        {link(href.browse(), 'Browse', ['browse', 'server', 'skill'].includes(route.name))}
        {user && link(href.workspace(), 'Workspace', route.name === 'workspace')}
        {user?.role === 'admin' && link(href.admin(), 'Admin', route.name === 'admin')}
        <li>
          <a href="https://github.com/I-have-no-Enemy/ContextForge-/blob/main/docs/API.md" target="_blank" rel="noreferrer">
            API docs
          </a>
        </li>
      </ul>
      <StatusBadge tone={health === 'healthy' ? 'live' : health === 'down' ? 'alert' : 'idle'}>
        {health === 'healthy' ? 'API · healthy' : health === 'down' ? 'API · offline' : 'API · connecting'}
      </StatusBadge>
      {user ? (
        <>
          <span className="site-nav__user">
            <b>{user.email.split('@')[0]}</b> · {user.role}
          </span>
          <Button
            variant="quiet"
            size="sm"
            onClick={async () => {
              await logout();
              toast('Signed out.');
              if (route.name === 'workspace' || route.name === 'admin') navigate(href.browse());
            }}
          >
            Sign out
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="sm" onClick={requestSignIn}>
          Sign in
        </Button>
      )}
    </nav>
  );
}

function CartBar({ route }: { route: Route }) {
  const cart = useCart();
  if (!cart.items.length) return null;
  return (
    <div className="cart-bar">
      <span aria-live="polite">
        {cart.items.length} in config · {clientLabel(cart.client)}
      </span>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          if (route.name !== 'browse') navigate(href.browse());
          window.setTimeout(() => document.getElementById('config-cart')?.scrollIntoView({ behavior: 'smooth' }), 50);
        }}
      >
        Review &amp; generate
      </Button>
    </div>
  );
}

function Shell() {
  const route = useRoute();
  return (
    <>
      {/* A button, not href="#main": the hash is the router. */}
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <div className="pg">
        <Nav route={route} />
      </div>
      <main id="main" tabIndex={-1}>
        <PageBoundary resetKey={JSON.stringify(route)}>
          <Page route={route} />
        </PageBoundary>
      </main>
      <footer className="site-foot pg">
        <span>ContextForge · 06016418 Server-Side Web Development, KMITL IT</span>
        <span>Risk levels: read_only · network · filesystem · destructive</span>
      </footer>
      <CartBar route={route} />
      <AuthDialog />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SessionProvider>
        <CartProvider>
          <Shell />
        </CartProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
