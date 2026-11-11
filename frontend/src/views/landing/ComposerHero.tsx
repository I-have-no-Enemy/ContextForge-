import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as api from '../../services/api';
import type { ClientId, McpServer } from '../../services/api';
import { useCart, CLIENTS } from '../../lib/cart';
import { CONFIG_PATHS, RISK_LABEL, RISK_MEANING, RISK_ORDER, highestRisk, previewConfig } from '../../lib/configPreview';
import { ArrowUpRight, Check, HandGrabbing, Plus, X } from '../../components/icons';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Hash is the router, so in-page jumps scroll instead of changing location.hash.
const toBrowse = () => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Background film from Google Flow (Veo). Missing or blocked media leaves the solid gradient. */
function HeroMedia() {
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return reduce ? (
    <img className="hero-media" src="/media/hero-poster.webp" alt="" onError={() => setFailed(true)} />
  ) : (
    <video
      className="hero-media"
      src="/media/hero.mp4"
      poster="/media/hero-poster.webp"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Landing hero: drag real MCP servers into the glass tray (the actual config cart) and watch the
 * highest risk and the client config update. Clicking a chip does the same for keyboard and touch users.
 */
export function ComposerHero() {
  const cart = useCart();
  const reduce = useReducedMotion();
  const trayRef = useRef<HTMLDivElement>(null);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [over, setOver] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    api
      .listServers({ limit: 8 })
      .then((r) => setServers(r.data))
      .catch(() => setServers([]));
  }, []);

  const picked = useMemo(() => servers.filter((s) => cart.has(s.id)), [servers, cart]);
  const risk = highestRisk(picked);
  const riskIndex = risk ? RISK_ORDER.indexOf(risk) : -1;
  const json = previewConfig(cart.client, picked);

  const overTray = (point: { x: number; y: number }) => {
    const r = trayRef.current?.getBoundingClientRect();
    if (!r) return false;
    const x = point.x - window.scrollX;
    const y = point.y - window.scrollY;
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const add = (s: McpServer) => {
    if (!cart.has(s.id)) cart.toggle({ id: s.id, kind: 'mcp', name: s.name });
  };

  return (
    <section className="hero2" aria-labelledby="hero-title">
      <div className="hero2__media" aria-hidden="true">
        <HeroMedia />
        <div className="hero2__scrim" />
      </div>

      <div className="hero2__grid pg">
        <div className="hero2__copy">
          <motion.h1
            id="hero-title"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          >
            Know what a tool can touch <span>before your agent runs it.</span>
          </motion.h1>
          <motion.p
            className="hero2__sub"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE_OUT }}
          >
            Drag a server into the tray. ContextForge shows the most it can do on your machine and writes the config for
            your client. Every listing here was reviewed by a person.
          </motion.p>

          <ul className="chips" aria-label="Verified MCP servers">
            {servers.map((s, i) => {
              const inCart = cart.has(s.id);
              const top = highestRisk([s]);
              return (
                <motion.li
                  key={s.id}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.18 + i * 0.05, ease: EASE_OUT }}
                >
                  <motion.button
                    type="button"
                    className="chip"
                    aria-pressed={inCart}
                    aria-label={`${inCart ? 'Remove' : 'Add'} ${s.name}${top ? `, highest risk ${RISK_LABEL[top]}` : ''}`}
                    drag={!reduce && !inCart}
                    dragSnapToOrigin
                    dragElastic={0.6}
                    whileDrag={{ scale: 1.06, zIndex: 20 }}
                    whileTap={{ scale: 0.96 }}
                    onDragStart={() => setDragging(s.id)}
                    onDrag={(_, info) => setOver(overTray(info.point))}
                    onDragEnd={(_, info) => {
                      if (overTray(info.point)) add(s);
                      setOver(false);
                      // A drag that ends is not a click: swallow the click that follows.
                      window.setTimeout(() => setDragging(null), 0);
                    }}
                    onClick={() => {
                      if (dragging) return;
                      cart.toggle({ id: s.id, kind: 'mcp', name: s.name });
                    }}
                  >
                    {top && <span className="risk-dot" data-level={top} aria-hidden="true" />}
                    {s.name}
                    {inCart ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                  </motion.button>
                </motion.li>
              );
            })}
          </ul>
          <p className="hero2__hint">
            <HandGrabbing size={16} aria-hidden="true" /> Drag on desktop, tap on phones. <button type="button" className="linkish" onClick={toBrowse}>
              See all servers and skills
            </button>
          </p>
        </div>

        <motion.div
          ref={trayRef}
          className="tray glass"
          data-over={over || undefined}
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: over ? 1.015 : 1 }}
          transition={{ duration: 0.6, delay: 0.12, ease: EASE_OUT }}
          aria-label="Config tray"
          role="region"
        >
          <div className="tray__head">
            <span className="tray__title">Config tray</span>
            <div className="seg" role="radiogroup" aria-label="Target client">
              {CLIENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cart.client === c.id}
                  className="seg__opt"
                  onClick={() => cart.setClient(c.id as ClientId)}
                >
                  {c.label.replace(' Desktop', '')}
                </button>
              ))}
            </div>
          </div>

          <ul className="tray__items" aria-live="polite">
            <AnimatePresence initial={false}>
              {cart.items.length === 0 && (
                <motion.li key="empty" className="tray__empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Drop servers here
                </motion.li>
              )}
              {cart.items.map((item) => (
                <motion.li
                  key={item.id}
                  layout
                  className="tray__item"
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                >
                  {item.name}
                  <button type="button" className="tray__remove" aria-label={`Remove ${item.name}`} onClick={() => cart.remove(item.id)}>
                    <X size={12} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="meter" aria-label={risk ? `Highest risk: ${RISK_LABEL[risk]}` : 'No server selected'}>
            <div className="meter__bars" aria-hidden="true">
              {RISK_ORDER.map((level, i) => (
                <motion.span
                  key={level}
                  className="meter__bar"
                  data-level={level}
                  animate={{ opacity: i <= riskIndex ? 1 : 0.16, scaleY: i <= riskIndex ? 1 : 0.55 }}
                  transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.05, ease: EASE_OUT }}
                />
              ))}
            </div>
            <div className="meter__text">
              <b>{risk ? RISK_LABEL[risk] : 'Nothing selected'}</b>
              <span>{risk ? RISK_MEANING[risk] : 'Pick a server to see what it can reach'}</span>
            </div>
          </div>

          <div className="tray__file">
            <span className="tray__path">{CONFIG_PATHS[cart.client]}</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.pre
                key={json}
                className="tray__code"
                initial={reduce ? false : { opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {json}
              </motion.pre>
            </AnimatePresence>
          </div>

          <div className="tray__acts">
            <button type="button" className="cf-btn cf-btn--primary" disabled={!cart.items.length || cart.generating} onClick={cart.generate}>
              {cart.generating ? 'Generating…' : 'Generate config'}
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="tray__more linkish" onClick={toBrowse}>
              Add skills
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
