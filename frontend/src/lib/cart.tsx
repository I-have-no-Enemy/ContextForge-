import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import * as api from '../services/api';
import type { ClientId, GeneratedConfig } from '../services/api';
import type { CartItem, ClientOption } from '../components/ui/config-rail';
import { Dialog } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Tag } from '../components/ui/badge';
import { errorText, useToast } from './toast';

export const CLIENTS: ClientOption[] = [
  { id: 'claude_desktop', label: 'Claude Desktop', file: 'claude_desktop_config.json' },
  { id: 'cursor', label: 'Cursor', file: '.cursor/mcp.json' },
  { id: 'cline', label: 'Cline', file: 'cline_mcp_settings.json' },
  { id: 'antigravity', label: 'Antigravity', file: '~/.gemini/antigravity/mcp_config.json' },
];
export const clientLabel = (id: string) => CLIENTS.find((c) => c.id === id)?.label ?? id;

interface Cart {
  items: CartItem[];
  client: ClientId;
  setClient: (c: ClientId) => void;
  has: (id: string) => boolean;
  toggle: (item: CartItem) => void;
  remove: (id: string) => void;
  warnings: string[];
  generating: boolean;
  generate: () => Promise<void>;
  /** Re-open a snapshot (e.g. from the workspace history). */
  show: (config: GeneratedConfig) => void;
}

const CartContext = createContext<Cart | null>(null);

function saveFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const baseName = (path: string) => path.split('/').pop() || path;
export const configText = (c: GeneratedConfig) => JSON.stringify(c.generated_json.config ?? c.generated_json, null, 2);

/** Saves the client's config file under its real file name. */
export function downloadConfig(c: GeneratedConfig) {
  saveFile(baseName(c.generated_json.config_path ?? `${c.client_type}.json`), configText(c), 'application/json');
}

/** Saves one skill file; the folder part of the path is kept in the name (skills__tdd__SKILL.md) so files never collide. */
export function downloadSkill(path: string, content: string) {
  saveFile(path.replace(/^[~./]+/, '').replace(/\//g, '__'), content, 'text/markdown');
}

/** Config cart shared by every page, plus the result dialog. */
export function CartProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [client, setClient] = useState<ClientId>('claude_desktop');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedConfig | null>(null);
  const [copied, setCopied] = useState(false);

  const warnings = items
    .filter((i) => i.clients && !i.clients.includes(client))
    .map((i) => `${i.name} is not compatible with ${clientLabel(client)}. Remove it or choose another client.`);

  const value = useMemo<Cart>(
    () => ({
      items,
      client,
      setClient,
      has: (id) => items.some((c) => c.id === id),
      toggle: (item) =>
        setItems((prev) => (prev.some((c) => c.id === item.id) ? prev.filter((c) => c.id !== item.id) : [...prev, item])),
      remove: (id) => setItems((prev) => prev.filter((c) => c.id !== id)),
      warnings,
      generating,
      show: setResult,
      generate: async () => {
        if (!items.length || warnings.length) return;
        setGenerating(true);
        try {
          const config = await api.generateConfig(
            client,
            items.filter((c) => c.kind === 'mcp').map((c) => c.id),
            items.filter((c) => c.kind === 'skill').map((c) => c.id)
          );
          setResult(config);
          setItems([]);
        } catch (err) {
          toast(errorText(err), 'error');
        } finally {
          setGenerating(false);
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, client, generating, warnings.join('|'), toast]
  );

  const json = result ? configText(result) : '';

  return (
    <CartContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(result)}
        onOpenChange={(open) => !open && setResult(null)}
        title={
          <>
            Config generated <Tag>{result?.client_type}</Tag>
          </>
        }
        description={`Snapshot ${result?.id?.slice(0, 8)} · save as ${result?.generated_json.config_path ?? ''}`}
        footer={
          <>
            <span className="cf-mono cf-muted" style={{ fontSize: 13 }}>
              Replace each YOUR_..._HERE value locally
            </span>
            <div className="cf-row">
              <Button
                variant="ghost"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={() => {
                  navigator.clipboard?.writeText(json).catch(() => {});
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
              <Button variant="primary" size="sm" icon={Download} onClick={() => result && downloadConfig(result)}>
                Download config
              </Button>
            </div>
          </>
        }
      >
        <div className="stack-24">
          {result?.generated_json.instructions && <p className="form__lead">{result.generated_json.instructions}</p>}
          <pre className="cf-code" aria-label={result?.generated_json.config_path}>
            {json}
          </pre>
          {!!result?.generated_json.skill_files?.length && (
            <div>
              <h3 className="cf-field__label">Skill files ({result.generated_json.skill_files.length})</h3>
              <ul className="rows">
                {result.generated_json.skill_files.map((f) => (
                  <li key={f.path} className="row">
                    <span className="row__main cf-mono">{f.path}</span>
                    <Button variant="ghost" size="sm" icon={Download} onClick={() => downloadSkill(f.path, f.content)}>
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Dialog>
    </CartContext.Provider>
  );
}

export function useCart(): Cart {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
