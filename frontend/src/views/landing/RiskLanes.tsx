import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as api from '../../services/api';
import type { McpServer } from '../../services/api';
import { href } from '../../lib/router';
import { RISK_LABEL, RISK_MEANING, RISK_ORDER } from '../../lib/configPreview';

gsap.registerPlugin(ScrollTrigger);

/** Seeded scatter so each tile starts from the same place on every render. */
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: (r(1) - 0.5) * 420, y: -180 - r(2) * 260, rotate: (r(3) - 0.5) * 50 };
};

/**
 * Scroll story: every tool of every listed server falls into its risk lane as the section scrolls in.
 * Scrubbed to the scrollbar; static under prefers-reduced-motion.
 */
export function RiskLanes() {
  const root = useRef<HTMLElement>(null);
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    api
      .listServers({ limit: 100 })
      .then((r) => setServers(r.data))
      .catch(() => setServers([]));
  }, []);

  const tools = servers.flatMap((s) => (s.tools ?? []).map((t) => ({ ...t, server: s })));
  const total = tools.length;

  useLayoutEffect(() => {
    if (!root.current || !total) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tiles = gsap.utils.toArray<HTMLElement>('.lane-tile', root.current);
      tiles.forEach((el, i) => gsap.set(el, { ...scatter(i), opacity: 0 }));
      gsap.to(tiles, {
        x: 0,
        y: 0,
        rotate: 0,
        opacity: 1,
        ease: 'power3.out',
        stagger: { each: 0.02, from: 'random' },
        scrollTrigger: { trigger: root.current, start: 'top 75%', end: 'top 15%', scrub: 0.8 },
      });
    });
    ScrollTrigger.refresh();
    return () => mm.revert();
  }, [total]);

  return (
    <section ref={root} className="lanes section" aria-labelledby="lanes-h">
      <div className="pg lanes__grid">
        <div className="lanes__intro">
          <h2 id="lanes-h">Four kinds of reach</h2>
          <p>
            Each tool is filed under the most it can do on the machine that runs it. A server is as risky as its riskiest
            tool, so you see that level first on every card.
          </p>
          <p className="lanes__count">
            <b>{total}</b> tools across <b>{servers.length}</b> reviewed servers.
          </p>
        </div>
        <div className="lanes__cols">
          {RISK_ORDER.map((level) => {
            const inLane = tools.filter((t) => t.risk_level === level);
            return (
              <div key={level} className="lane" data-level={level}>
                <div className="lane__head">
                  <span className="risk-dot" data-level={level} aria-hidden="true" />
                  <h3>{RISK_LABEL[level]}</h3>
                  <span className="lane__n">{inLane.length}</span>
                </div>
                <p className="lane__meaning">{RISK_MEANING[level]}.</p>
                <ul className="lane__list">
                  {inLane.map((t) => (
                    <li key={`${t.server.id}-${t.name}`}>
                      <a className="lane-tile" href={href.server(t.server.id)}>
                        <b>{t.name}</b>
                        <span>{t.server.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
