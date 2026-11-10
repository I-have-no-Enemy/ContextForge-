import { useEffect, useRef, useState } from 'react';
import { Check, Copy, FileText, Plus, SquareTerminal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { StatusBadge, Tag } from './badge';
import { RiskMeter, type RiskLevel } from './risk-meter';

export interface RegistryStat {
  label: string;
  value: number;
}

export interface RegistryCardProps {
  kind: 'mcp' | 'skill';
  name: string;
  description: string;
  verified?: boolean;
  flagged?: boolean;
  /** Highest tool risk (servers). */
  risk?: RiskLevel;
  /** Install command (servers). */
  command?: string;
  /** Compatible clients (skills). */
  tags?: string[];
  stats?: RegistryStat[];
  selected?: boolean;
  onToggle?: () => void;
  onInspect?: () => void;
}

function short(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n);
}

export function RegistryCard({
  kind, name, description, verified, flagged, risk, command, tags, stats = [], selected, onToggle, onInspect,
}: RegistryCardProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = () => {
    if (!command) return;
    navigator.clipboard?.writeText(command).catch(() => {});
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const KindIcon = kind === 'mcp' ? SquareTerminal : FileText;
  const statNodes = stats.map((s) => (
    <span key={s.label} aria-label={`${s.value.toLocaleString('en-US')} ${s.label}`}>
      <b>{short(s.value)}</b> {s.label}
    </span>
  ));

  return (
    <article className={cn('cf-card', selected && 'is-selected')} aria-label={name}>
      <div className="cf-card__body">
        <div className="cf-card__kind">
          <span className="cf-card__kind-l">
            <KindIcon size={18} strokeWidth={1.5} className="cf-icon--gold" aria-hidden="true" />
            {kind === 'mcp' ? 'MCP server' : 'Skill'}
          </span>
          {flagged ? (
            <StatusBadge tone="alert">LLM01 flagged</StatusBadge>
          ) : verified ? (
            <StatusBadge tone="live">Verified</StatusBadge>
          ) : (
            <StatusBadge tone="idle">Pending review</StatusBadge>
          )}
        </div>
        <h3 className="cf-card__name">{name}</h3>
        <p className="cf-card__desc">{description}</p>
        {command && (
          <div className="cf-cmd">
            <span className="cf-cmd__text" title={command}>
              {command}
            </span>
            <button type="button" className="cf-iconbtn" onClick={copy} aria-label={copied ? 'Copied' : 'Copy install command'}>
              {copied ? <Check size={14} strokeWidth={1.5} /> : <Copy size={14} strokeWidth={1.5} />}
            </button>
          </div>
        )}
        {tags && tags.length > 0 && (
          <div className="cf-card__tags">
            {tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
      </div>
      <div className="cf-card__foot">
        {risk ? <RiskMeter level={risk} compact /> : <span className="cf-stats">{statNodes}</span>}
        {risk && statNodes.length > 0 && <span className="cf-stats">{statNodes}</span>}
        {onInspect && (
          <Button variant="quiet" size="sm" onClick={onInspect}>
            Inspect
          </Button>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={selected ? 'true' : 'false'}
            disabled={flagged}
            icon={selected ? Check : Plus}
            onClick={onToggle}
          >
            {flagged ? 'Blocked' : selected ? 'In config' : 'Add'}
          </Button>
        )}
      </div>
    </article>
  );
}
