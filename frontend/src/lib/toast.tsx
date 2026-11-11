import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { X } from '../components/icons';

type Tone = 'ok' | 'error';
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

/** Announces results politely to screen readers (WCAG 4.1.3) and fades after 5 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const push = useCallback((text: string, tone: Tone = 'ok') => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <span>{t.text}</span>
            <button type="button" className="cf-iconbtn" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Human text for any thrown value. */
export const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.');
