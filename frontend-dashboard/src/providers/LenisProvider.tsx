/**
 * Lenis Smooth Scroll Provider
 * Wraps the dashboard app with Lenis smooth scrolling
 * Syncs with GSAP ticker for ScrollTrigger compatibility
 */

import { ReactLenis } from 'lenis/react';
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync Lenis with GSAP ticker for ScrollTrigger compatibility
    const lenisRoot = document.querySelector('[data-lenis-root]') as any;
    const lenis = lenisRoot?.__lenis;

    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time: number) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }, []);

  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
