import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const baseStyles =
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium transition-colors';

  const variants = {
    default: 'bg-[#1a1a1a] text-[#f3f3f3] border border-[#212121]',
    secondary: 'bg-[#101010] text-[#9c9c9c] border border-[#212121]',
    outline: 'border border-[#212121] text-[#9c9c9c]',
    success: 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80',
    warning: 'bg-amber-950/70 text-amber-300 border border-amber-800/80',
    destructive: 'bg-red-950/70 text-red-300 border border-red-800/80',
  };

  return <div className={cn(baseStyles, variants[variant], className)} {...props} />;
}
