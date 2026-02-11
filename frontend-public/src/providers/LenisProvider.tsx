import { ReactLenis } from 'lenis/react';
import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LenisProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = (document.querySelector('[data-lenis-root]') as any)?.__lenis;
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time: number) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }, []);

  return (
    <ReactLenis root options={{
      lerp: 0.1,
      duration: 1.2,
      smoothWheel: true,
      syncTouch: true,        // Enable touch inertia on mobile
      touchMultiplier: 2,     // Increase touch sensitivity
    }}>
      {children}
    </ReactLenis>
  );
}
