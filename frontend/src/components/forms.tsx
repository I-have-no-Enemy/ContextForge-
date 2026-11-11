import { useId, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from './icons';
import type { LatestReview, Pagination } from '../services/api';
import { Button } from './ui/button';
import { StatusBadge } from './ui/badge';
import { Dialog } from './ui/dialog';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="form-field">
      <label className="cf-field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? noteId : undefined })}
      {(error || hint) && (
        <p id={noteId} className={error ? 'form-field__err' : 'form-field__hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** Splits "A, B  C" into ["A","B","C"]. */
export const splitList = (s: string) =>
  s
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export function ReviewBadge({ verified, review }: { verified: boolean; review?: LatestReview | null }) {
  if (review?.flagged_by_scan && review.status === 'pending') return <StatusBadge tone="alert">Flagged · pending</StatusBadge>;
  if (verified) return <StatusBadge tone="live">Verified</StatusBadge>;
  if (review?.status === 'rejected') return <StatusBadge tone="alert">Rejected</StatusBadge>;
  return <StatusBadge tone="idle">Pending review</StatusBadge>;
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (p: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <nav className="pager" aria-label="Pagination">
      <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Prev
      </Button>
      <span className="cf-mono cf-muted">
        Page {page} of {totalPages} · {total} items
      </span>
      <Button variant="ghost" size="sm" trailingIcon={ChevronRight} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** Receives the typed reason when `reason` is set, otherwise ''. */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  /** Ask for a reason (admin takedown). */
  reason?: { label: string; min: number };
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose, reason }: ConfirmProps) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  const run = async () => {
    if (reason && text.trim().length < reason.min) {
      setError(`Write at least ${reason.min} characters.`);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(text.trim());
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="quiet" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={run} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="form">
        <p className="form__lead">{body}</p>
        {reason && (
          <Field label={reason.label} error={error}>
            {(p) => (
              <textarea
                {...p}
                className="cf-input"
                rows={3}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(undefined);
                }}
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
}
