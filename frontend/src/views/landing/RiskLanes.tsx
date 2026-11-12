import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as api from '../../services/api';
import type { McpServer } from '../../services/api';
import { href } from '../../lib/router';
import { browseMemory } from '../../lib/browseMemory';
import { RISK_LABEL, RISK_MEANING, RISK_ORDER } from '../../lib/configPreview';

gsap.registerPlugin(ScrollTrigger);

/** Seeded scatter so each tile starts from the same place on every render. */
const scatter = (i: number) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: (r(1) - 0.5) * 420, y: -180 - r(2) * 260, rotate: (r(3) - 0.5) * 50 };
};

/** How many tiles a lane shows. The full list is in the registry; 500+ tiles made the page too long to scroll past. */
const PER_LANE = 8;

type Tab = 'servers' | 'skills';
interface RiskLanesProps {
  /** Totals from the registry, so the jump buttons say how much is there. */
  serverTotal?: number;
  skillTotal?: number;
  onOpen: (tab: Tab) => void;
}

/**
 * Scroll story: a sample of the tools falls into its risk lane as the section scrolls in. Each lane shows
 * the most-starred servers' tools first, one per server in turn, so a lane is not one server repeated.
 * Scrubbed to the scrollbar; static under prefers-reduced-motion.
 */
export function RiskLanes({ serverTotal, skillTotal, onOpen }: RiskLanesProps) {
  const root = useRef<HTMLElement>(null);
  const [servers, setServers] = useState<McpServer[]>(browseMemory.laneServers ?? []);

  useEffect(() => {
    api
      .listAllServers()
      .then((all) => {
        browseMemory.laneServers = all;
        setServers(all);
      })
      .catch(() => setServers([]));
  }, []);

  const ranked = [...servers].sort((a, b) => b.github_stars - a.github_stars);
  const total = servers.reduce((n, s) => n + (s.tools?.length ?? 0), 0);
  const laneOf = (level: string) =>
    ranked.map((s) => (s.tools ?? []).filter((t) => t.risk_level === level).map((t) => ({ ...t, server: s })));
  const sample = (level: string) => {
    const perServer = laneOf(level);
    const out: Array<(typeof perServer)[number][number]> = [];
    for (let i = 0; out.length < PER_LANE && perServer.some((l) => l.length > i); i++) {
      for (const l of perServer) if (l[i] && out.length < PER_LANE) out.push(l[i]);
    }
    return { shown: out, all: perServer.reduce((n, l) => n + l.length, 0) };
  };

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
          <p className="lanes__jump">
            <button type="button" className="linkish" onClick={() => onOpen('servers')}>
              Browse {serverTotal ?? servers.length} MCP servers
            </button>
            {skillTotal !== undefined && (
              <button type="button" className="linkish" onClick={() => onOpen('skills')}>
                Browse {skillTotal} skills
              </button>
            )}
          </p>
        </div>
        <div className="lanes__cols">
          {RISK_ORDER.map((level) => {
            const { shown, all } = sample(level);
            return (
              <div key={level} className="lane" data-level={level}>
                <div className="lane__head">
                  <span className="risk-dot" data-level={level} aria-hidden="true" />
                  <h3>{RISK_LABEL[level]}</h3>
                  <span className="lane__n">{all}</span>
                </div>
                <p className="lane__meaning">{RISK_MEANING[level]}.</p>
                <ul className="lane__list">
                  {shown.map((t) => (
                    <li key={`${t.server.id}-${t.name}`}>
                      <a className="lane-tile" href={href.server(t.server.id)} title={`${t.name} (${t.server.name})`}>
                        <b>{t.name}</b>
                        <span>{t.server.name}</span>
                      </a>
                    </li>
                  ))}
                  {all > shown.length && (
                    <li>
                      <button type="button" className="linkish lane__more" onClick={() => onOpen('servers')}>
                        {all - shown.length} more in the registry
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
