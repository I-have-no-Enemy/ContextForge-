import * as React from 'react';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}

export function Tabs({ items, value, onChange, label = 'Sections' }: TabsProps) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = (idx + d + items.length) % items.length;
    onChange(items[next].id);
    const tabs = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next].focus();
  };

  return (
    <div className="cf-tabs" role="tablist" aria-label={label}>
      {items.map((it, idx) => {
        const on = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            className="cf-tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(it.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
          >
            {it.label}
            {it.count != null && <span className="cf-tab__count">{String(it.count).padStart(2, '0')}</span>}
          </button>
        );
      })}
    </div>
  );
}
