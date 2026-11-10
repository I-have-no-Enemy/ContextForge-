import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: the one white pill per view. ghost: outlined secondary. quiet: underlined text. */
  variant?: 'primary' | 'ghost' | 'quiet';
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', icon: Icon, trailingIcon: Trailing, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn('cf-btn', `cf-btn--${variant}`, size === 'sm' && 'cf-btn--sm', className)}
      {...props}
    >
      {Icon && <Icon size={14} strokeWidth={1.5} aria-hidden="true" />}
      {children}
      {Trailing && <Trailing size={14} strokeWidth={1.5} aria-hidden="true" />}
    </button>
  )
);
Button.displayName = 'Button';
