import * as React from 'react';
import { X } from '../icons';
import { lockPageScroll } from '../../lib/smoothScroll';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  // Callers pass inline handlers, so keep the latest one in a ref. If the effect depended on it,
  // every keystroke (a re-render) would re-run the effect and pull focus out of the field being typed in.
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  React.useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;
    // Focus the first field when there is one, otherwise the dialog itself.
    const firstField = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select');
    (firstField ?? ref.current)?.focus();
    const focusables = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);

    // aria-modal promises that nothing behind the dialog is reachable, so Tab wraps inside it (WCAG 2.4.3).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onOpenChangeRef.current(false);
      if (e.key !== 'Tab' || !ref.current) return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Focus that lands outside (a click on the page behind, a screen reader jump) is pulled back in.
    const onFocusIn = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) (focusables()[0] ?? ref.current).focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    const unlockScroll = lockPageScroll();
    return () => {
      unlockScroll();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      returnTo?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="cf-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div ref={ref} className="cf-dialog" data-lenis-prevent role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
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
