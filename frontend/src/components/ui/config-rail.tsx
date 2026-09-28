import { ArrowUpRight, TriangleAlert, X } from 'lucide-react';
import { Button } from './button';
import { EmptyState } from './empty-state';

export interface CartItem {
  id: string;
  kind: 'mcp' | 'skill';
  name: string;
  /** Skills only: clients this entry supports. */
  clients?: string[];
}

export interface ClientOption {
  id: string;
  label: string;
  file: string;
}

export interface ConfigRailProps {
  id?: string;
  items: CartItem[];
  clients: ClientOption[];
  client: string;
  onClientChange: (id: string) => void;
  onRemove: (id: string) => void;
  onGenerate: () => void;
  warnings: string[];
  generating?: boolean;
  onBrowse?: () => void;
}

export function ConfigRail({
  id, items, clients, client, onClientChange, onRemove, onGenerate, warnings, generating, onBrowse,
}: ConfigRailProps) {
  const current = clients.find((c) => c.id === client) ?? clients[0];
  return (
    <aside id={id} className="cf-rail" aria-label="Config cart">
      <div className="cf-rail__head">
        <h2 className="cf-rail__title">Config cart</h2>
        <span className="cf-rail__count" aria-live="polite">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="cf-rail__sec">
          <EmptyState
            heading="Config cart is empty"
            action={
              onBrowse && (
                <Button variant="quiet" size="sm" onClick={onBrowse}>
                  Browse registry
                </Button>
              )
            }
          >
            Select verified MCP tools or skills from the catalog to compile your setup.
          </EmptyState>
        </div>
      ) : (
        <ul className="cf-rail__list">
          {items.map((it) => (
            <li key={it.id} className="cf-rail__item">
              <span className="cf-rail__kind">{it.kind}</span>
              <span className="cf-rail__item-name">{it.name}</span>
              <button type="button" className="cf-iconbtn" aria-label={`Remove ${it.name}`} onClick={() => onRemove(it.id)}>
                <X size={14} strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="cf-rail__sec">
        <label className="cf-field__label" htmlFor="cf-rail-client">
          Target client
        </label>
        <select id="cf-rail-client" className="cf-select" value={client} onChange={(e) => onClientChange(e.target.value)}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        {current && <span className="cf-rail__file">→ {current.file}</span>}
        {warnings.map((w) => (
          <p key={w} className="cf-warn" role="alert">
            <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>{w}</span>
          </p>
        ))}
        <Button
          variant="primary"
          trailingIcon={ArrowUpRight}
          disabled={items.length === 0 || warnings.length > 0 || generating}
          onClick={onGenerate}
        >
          {generating ? 'Generating…' : 'Generate config'}
        </Button>
      </div>
    </aside>
  );
}
