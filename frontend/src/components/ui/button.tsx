import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'pill';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#474747] disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

    const variants = {
      default: 'bg-[#ffffff] text-[#101010] hover:bg-[#eaeaea] shadow-sm font-semibold',
      pill: 'btn-pill',
      secondary: 'bg-[#1a1a1a] text-[#f3f3f3] hover:bg-[#252525] border border-[#212121]',
      outline: 'border border-[#212121] bg-transparent text-[#f3f3f3] hover:bg-[#1a1a1a] hover:border-[#3b3d45]',
      ghost: 'text-[#9c9c9c] hover:text-[#f3f3f3] hover:bg-[#1a1a1a]',
      destructive: 'bg-red-950/80 text-red-200 border border-red-800/80 hover:bg-red-900',
    };

    const sizes = {
      default: 'h-8 px-3.5 py-1.5',
      sm: 'h-7 px-2.5 text-[11px]',
      lg: 'h-10 px-5 text-sm',
      icon: 'h-8 w-8 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
