import * as React from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      returnTo?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="cf-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div ref={ref} className="cf-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="cf-dialog__head">
          <div>
            <h2 id={titleId} className="cf-dialog__title">
              {title}
            </h2>
            {description && <p className="cf-dialog__desc">{description}</p>}
          </div>
          <button type="button" className="cf-iconbtn" aria-label="Close" onClick={() => onOpenChange(false)}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="cf-dialog__body">{children}</div>
        {footer && <div className="cf-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
