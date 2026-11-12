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

/**
 * A native modal <dialog>. The browser traps Tab inside it, makes the page behind inert (so screen readers cannot
 * reach it either), draws the backdrop and closes on Escape. It does not stop the page behind from scrolling,
 * which is what lockPageScroll is for.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const returnTo = document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    // The browser focuses the first control, the Close button; a form should start in its first field.
    dialog.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select')?.focus();
    const unlockScroll = lockPageScroll();
    return () => {
      unlockScroll();
      returnTo?.focus(); // the dialog is removed from the DOM, so the browser's own focus return does not run
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="cf-dialog"
      data-lenis-prevent
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // let the parent decide: it owns the open state
        onOpenChange(false);
      }}
      onMouseDown={(e) => {
        // A click on the backdrop lands on the <dialog> element itself, outside its box.
        const box = e.currentTarget.getBoundingClientRect();
        if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) onOpenChange(false);
      }}
    >
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
    </dialog>
  );
}
