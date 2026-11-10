import { cn } from '../../lib/utils';

export type RiskLevel = 'read_only' | 'network' | 'filesystem' | 'destructive';

export const RISK_ORDER: RiskLevel[] = ['read_only', 'network', 'filesystem', 'destructive'];

const LABELS: Record<RiskLevel, string> = {
  read_only: 'Read-only',
  network: 'Network access',
  filesystem: 'Local filesystem',
  destructive: 'Destructive',
};

/** Highest risk level among a server's tools; read_only when it has none. */
export function maxRisk(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((m, l) => (RISK_ORDER.indexOf(l) > RISK_ORDER.indexOf(m) ? l : m), 'read_only');
}

export interface RiskMeterProps {
  level: RiskLevel;
  /** Drop the human label; the code stays. */
  compact?: boolean;
  className?: string;
}

export function RiskMeter({ level, compact, className }: RiskMeterProps) {
  const n = RISK_ORDER.indexOf(level) + 1;
  return (
    <span className={cn('cf-risk', `cf-risk--${level}`, className)}>
      <span className="cf-risk__bars" aria-hidden="true">
        {RISK_ORDER.map((_, i) => (
          <span key={i} className={cn('cf-risk__bar', i < n && 'is-on')} />
        ))}
      </span>
      {!compact && <span>{LABELS[level]}</span>}
      <span className="cf-risk__code">{level}</span>
      <span className="cf-sr">, risk level {n} of 4</span>
    </span>
  );
}
