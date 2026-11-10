import { useId } from 'react';
import { Search } from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Decorative key hint; the page wires the shortcut itself. */
  hint?: string;
  id?: string;
}

export function SearchField({ value, onChange, label = 'Search', placeholder, hint, id }: SearchFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className="cf-field">
      <label className="cf-field__label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="cf-field__box">
        <Search size={18} strokeWidth={1.5} aria-hidden="true" />
        <input
          id={fieldId}
          className="cf-field__input"
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
        {hint && (
          <kbd className="cf-kbd" aria-hidden="true">
            {hint}
          </kbd>
        )}
      </div>
    </div>
  );
}
