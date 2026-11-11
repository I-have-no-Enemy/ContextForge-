import { useEffect, useRef } from 'react';

/**
 * Light layer over the hero film: two slow brand-colour blooms (CSS @property animation) and one
 * bloom that follows the pointer. Pure CSS paint, no canvas; reduced motion keeps it still.
 */
export function HeroAurora() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(pointer: fine)').matches) return;
    const host = el.parentElement!;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect();
        el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
      });
    };
    host.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <div ref={ref} className="aurora" aria-hidden="true" />;
}
