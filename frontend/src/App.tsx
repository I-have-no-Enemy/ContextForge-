import { Component, type ReactNode } from 'react';
import { href, navigate, useRoute, type Route } from './lib/router';
import { SessionProvider, useSession } from './lib/session';
import { ToastProvider } from './lib/toast';
import { CartProvider, clientLabel, useCart } from './lib/cart';
import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { AuthDialog } from './components/AuthDialog';
import { Dock, Topbar } from './components/Chrome';
import { useSmoothScroll } from './lib/smoothScroll';
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
  useSmoothScroll();
  return (
    <>
      {/* A button, not href="#main": the hash is the router. */}
      <button type="button" className="skip-link" onClick={() => document.getElementById('main')?.focus()}>
        Skip to content
      </button>
      <Topbar route={route} />
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
      <Dock route={route} />
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
