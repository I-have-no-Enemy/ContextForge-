import * as React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  heading: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Good-news states (queue cleared): solid frame, no action. */
  tone?: 'ok';
  /** 1 when the state replaces the whole page (not found, signed out); inside a list it stays a section heading. */
  level?: 1 | 3;
}

export function EmptyState({ heading, children, action, tone, level = 3 }: EmptyStateProps) {
  const Heading = level === 1 ? 'h1' : 'h3';
  return (
    <div className={cn('cf-empty', tone === 'ok' && 'cf-empty--ok')}>
      <Heading className="cf-empty__h">{heading}</Heading>
      <p className="cf-empty__p">{children}</p>
      {action}
    </div>
  );
}
