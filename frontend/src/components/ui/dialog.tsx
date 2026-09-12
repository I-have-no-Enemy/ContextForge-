import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[#212121] bg-[#080808] text-[#f3f3f3] shadow-2xl',
          className
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-[#212121]">
          <div>
            <div className="text-sm font-semibold tracking-tight text-[#f3f3f3] flex items-center gap-2">
              {title}
            </div>
            {description && (
              <p className="text-xs text-[#9c9c9c] font-mono mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-md text-[#9c9c9c] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {footer && (
          <div className="flex items-center justify-between p-4 border-t border-[#212121] bg-[#101010]/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
