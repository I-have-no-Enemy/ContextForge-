import * as React from 'react';
import { cn } from '../../lib/utils';

export interface StatusBadgeProps {
  /** live: pulse-green dot. idle: hollow ring. alert: chalk frame and diamond. */
  tone?: 'live' | 'idle' | 'alert';
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ tone = 'live', children, className }: StatusBadgeProps) {
  return (
    <span className={cn('cf-badge', `cf-badge--${tone}`, className)}>
      <span className="cf-badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export interface TagProps {
  children: React.ReactNode;
  /** Makes the tag a filter toggle. */
  onClick?: () => void;
  pressed?: boolean;
}

export function Tag({ children, onClick, pressed }: TagProps) {
  if (onClick) {
    return (
      <button type="button" className="cf-tag" aria-pressed={pressed ? 'true' : 'false'} onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className="cf-tag">{children}</span>;
}
