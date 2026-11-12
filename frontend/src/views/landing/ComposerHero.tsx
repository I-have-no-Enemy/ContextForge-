import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as api from '../../services/api';
import type { ClientId, McpServer } from '../../services/api';
import { useCart, CLIENTS } from '../../lib/cart';
import { CONFIG_PATHS, RISK_LABEL, RISK_MEANING, RISK_ORDER, highestRisk, previewConfig } from '../../lib/configPreview';
import { ArrowUpRight, Check, Plus } from '../../components/icons';
import { HeroAurora } from './HeroAurora';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
// Hash is the router, so in-page jumps scroll instead of changing location.hash.
const toBrowse = () => document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Background film from Google Flow (Veo). Missing or blocked media leaves the gradient ground. */
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
 * Landing stage: full-bleed film, one headline, and a glass composer bar floating over the film.
 * Tapping a server adds it to the real config cart; the bar opens to show the highest risk and the
 * client config, and Generate calls the API.
 */
export function ComposerHero() {
  const cart = useCart();
  const reduce = useReducedMotion();
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    api
      .listServers({ limit: 8 })
      .then((r) => setServers(r.data))
      .catch(() => setServers([]));
  }, []);

  const picked = servers.filter((s) => cart.has(s.id));
  const risk = highestRisk(picked);
  const riskIndex = risk ? RISK_ORDER.indexOf(risk) : -1;
  const open = picked.length > 0;
  const fade = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE_OUT } };

  return (
    <section className="stage" aria-labelledby="hero-title">
      <div className="stage__media" aria-hidden="true">
        <HeroMedia />
        <HeroAurora />
        <div className="stage__scrim" />
      </div>

      <div className="stage__inner pg">
        <motion.h1 id="hero-title" {...fade(0)}>
          Know what a tool can touch.
        </motion.h1>
        <motion.p className="stage__sub" {...fade(0.08)}>
          Before your agent runs it. Pick MCP servers below to see the most they can do on your machine, then take the
          config for your client.
        </motion.p>

        <motion.div className="composer glass glass--strong" data-open={open || undefined} layout={!reduce} {...fade(0.16)}>
          <div className="composer__row">
            <ul className="composer__chips" aria-label="Reviewed MCP servers">
              {servers.map((s) => {
                const inCart = cart.has(s.id);
                const top = highestRisk([s]);
                return (
                  <li key={s.id}>
                    <motion.button
                      type="button"
                      className="chip"
                      aria-pressed={inCart}
                      aria-label={`${inCart ? 'Remove' : 'Add'} ${s.name}${top ? `, highest risk ${RISK_LABEL[top]}` : ''}`}
                      whileTap={reduce ? undefined : { scale: 0.95 }}
                      onClick={() => cart.toggle({ id: s.id, kind: 'mcp', name: s.name })}
                    >
                      {top && <span className="risk-dot" data-level={top} aria-hidden="true" />}
                      {s.name}
                      {inCart ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            <div className="composer__side">
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
              <button type="button" className="cf-btn cf-btn--primary" disabled={!cart.items.length || cart.generating} onClick={cart.generate}>
                {cart.generating ? 'Generating…' : 'Get config'}
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="detail"
                className="composer__detail"
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
              >
                <div className="composer__risk" aria-live="polite">
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
                    <b>{risk ? RISK_LABEL[risk] : 'No tools listed'}</b>
                    <span>{risk ? RISK_MEANING[risk] : 'These servers list no tools yet'}</span>
                    <span className="composer__count">
                      {picked.length} server{picked.length > 1 ? 's' : ''}
                      {cart.items.length > picked.length && ` + ${cart.items.length - picked.length} from the registry`}
                    </span>
                  </div>
                </div>
                <div className="tray__file">
                  <span className="tray__path">{CONFIG_PATHS[cart.client]}</span>
                  <pre className="tray__code">{previewConfig(cart.client, picked)}</pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.p className="stage__foot" {...fade(0.24)}>
          Nothing is listed until an admin approves it.{' '}
          <button type="button" className="linkish" onClick={toBrowse}>
            Browse all servers and skills
          </button>
        </motion.p>
      </div>
    </section>
  );
}
