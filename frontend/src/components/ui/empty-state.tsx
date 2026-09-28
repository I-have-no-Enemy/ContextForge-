import * as React from 'react';
import { cn } from '../../lib/utils';

export interface EmptyStateProps {
  heading: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Good-news states (queue cleared): solid frame, no action. */
  tone?: 'ok';
}

export function EmptyState({ heading, children, action, tone }: EmptyStateProps) {
  return (
    <div className={cn('cf-empty', tone === 'ok' && 'cf-empty--ok')}>
      <h3 className="cf-empty__h">{heading}</h3>
      <p className="cf-empty__p">{children}</p>
      {action}
    </div>
  );
}
