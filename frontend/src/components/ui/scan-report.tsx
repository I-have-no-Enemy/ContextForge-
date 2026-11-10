import * as React from 'react';
import { TriangleAlert } from 'lucide-react';

export interface ScanFinding {
  code: string;
  label: string;
}

/** Splits the scanner's "CODE: Label" strings (backend/src/services/scanner.service.ts). */
export function parseScanFlags(flags: string[] = []): ScanFinding[] {
  return flags.map((f) => {
    const i = f.indexOf(':');
    return i < 0 ? { code: f, label: '' } : { code: f.slice(0, i).trim(), label: f.slice(i + 1).trim() };
  });
}

export interface ScanReportProps {
  name: string;
  score: number;
  flags: ScanFinding[];
  excerpt?: React.ReactNode;
}

export function ScanReport({ name, score, flags, excerpt }: ScanReportProps) {
  return (
    <section className="cf-scan" aria-label={`Scan report for ${name}`}>
      <div className="cf-scan__head">
        <div className="cf-row">
          <TriangleAlert size={18} strokeWidth={1.5} className="cf-icon--gold" aria-hidden="true" />
          <h3 className="cf-scan__title">{name}</h3>
        </div>
        <span className="cf-scan__score">
          Risk score <b>{score}</b> / 100 · {flags.length} {flags.length === 1 ? 'finding' : 'findings'}
        </span>
      </div>
      {flags.length > 0 && (
        <ol className="cf-scan__list">
          {flags.map((f, i) => (
            <li key={f.code} className="cf-scan__item">
              <span className="cf-scan__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="cf-scan__code">{f.code}</span>
              <span className="cf-scan__label">{f.label}</span>
            </li>
          ))}
        </ol>
      )}
      {excerpt && <blockquote className="cf-scan__quote">{excerpt}</blockquote>}
    </section>
  );
}
