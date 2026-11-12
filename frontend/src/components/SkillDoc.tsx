import { Fragment, useId, useMemo, type ReactNode } from 'react';

/**
 * Reads a SKILL.md as a document. Skill text is untrusted (OWASP LLM01/LLM02), so this builds React elements
 * only: nothing is injected as HTML, raw tags show as text, and a link is clickable only when it is https.
 * It covers what skill files actually use: headings, lists, quotes, fenced code, bold, inline code and links.
 */

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\))/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((\S+)\)$/);
    if (link) {
      return /^https:\/\//i.test(link[2]) ? (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer nofollow" className="ext-link">
          {link[1]}
        </a>
      ) : (
        <Fragment key={i}>{link[1]}</Fragment>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'code'; text: string };

export function parseSkillDoc(source: string): Block[] {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''); // the front matter is already shown as the title and summary
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { t: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of body.split(/\r?\n/)) {
    if (/^\s*```/.test(raw)) {
      if (code) {
        blocks.push({ t: 'code', text: code.join('\n') });
        code = null;
      } else {
        flushPara();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const q = line.match(/^>\s?(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ t: 'h', level: h[1].length, text: h[2] });
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (!list || list.t !== kind) {
        flushList();
        list = { t: kind, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
    } else if (q) {
      flushPara();
      flushList();
      blocks.push({ t: 'quote', text: q[1] });
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else if (list && /^\s{2,}\S/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`; // a wrapped list item
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  if (code) blocks.push({ t: 'code', text: code.join('\n') });
  flushPara();
  flushList();
  return blocks;
}

export function SkillDoc({ source }: { source: string }) {
  const uid = useId();
  const blocks = useMemo(() => parseSkillDoc(source), [source]);
  if (blocks.length === 0) return <p className="cf-muted">This skill file has no readable content.</p>;

  // A long skill is a long page and the hash belongs to the router, so the outline scrolls instead of linking.
  const outline = blocks.flatMap((b, i) => (b.t === 'h' && b.level <= 3 ? [{ id: `${uid}-${i}`, text: b.text.replace(/[`*]/g, ''), level: b.level }] : []));
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="skill-doc">
      {outline.length >= 6 && (
        <details className="skill-outline">
          <summary>On this page ({outline.length})</summary>
          <ul data-lenis-prevent>
            {outline.map((h) => (
              <li key={h.id} className={`lv${h.level}`}>
                <button type="button" className="linkish" onClick={() => jump(h.id)}>
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h': {
            // The page title is the h1; the file's own "#" becomes h2.
            const Tag = `h${Math.min(b.level + 1, 6)}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
            return (
              <Tag key={i} id={`${uid}-${i}`}>
                {inline(b.text)}
              </Tag>
            );
          }
          case 'ul':
          case 'ol': {
            const List = b.t;
            return (
              <List key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </List>
            );
          }
          case 'quote':
            return <blockquote key={i}>{inline(b.text)}</blockquote>;
          case 'code':
            return (
              <pre key={i} className="cf-code">
                {b.text}
              </pre>
            );
          default:
            return <p key={i}>{inline(b.text)}</p>;
        }
      })}
    </div>
  );
}
