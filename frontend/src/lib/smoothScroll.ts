import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

/** Jump to a position without animation (restoring a saved place, or the top of a new page). */
export function scrollPageTo(y: number) {
  if (lenis) {
    // Lenis remembers the previous page's scroll limit and would clamp a restored position to it.
    lenis.resize();
    lenis.scrollTo(y, { immediate: true, force: true });
  }
  else window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
}

let locks = 0;
/**
 * Freezes the page behind a modal. Several dialogs can be open at once, so this counts and only the last
 * release lets the page scroll again. The dialog itself scrolls on its own (see data-lenis-prevent).
 */
export function lockPageScroll(): () => void {
  if (locks++ === 0) {
    document.documentElement.classList.add('is-scroll-locked');
    lenis?.stop();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      document.documentElement.classList.remove('is-scroll-locked');
      lenis?.start();
    }
  };
}

/** Lenis smooth scrolling driven by GSAP's ticker so ScrollTrigger scrubs stay in step. Off for reduced motion. */
export function useSmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9 });
    const instance = lenis;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      lenis = null;
    };
  }, []);
}
