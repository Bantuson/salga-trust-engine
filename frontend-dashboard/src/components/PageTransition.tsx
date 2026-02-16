/**
 * Page Transition Component
 * GSAP color overlay sweep on route changes
 * Per user decision: NOT using Barba.js (conflicts with React SPAs)
 * Gradient: gold -> pink/rose
 */

import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

interface PageTransitionProps {
  routeKey: string; // current hash route
  children: React.ReactNode;
}

export function PageTransition({ routeKey, children }: PageTransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [displayChildren, setDisplayChildren] = useState(children);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => setDisplayChildren(children),
    });

    // Sweep in from left
    tl.fromTo(
      overlayRef.current,
      { scaleX: 0, transformOrigin: 'left' },
      { scaleX: 1, duration: 0.5, ease: 'power2.inOut' }
    )
      // Sweep out to right
      .fromTo(
        overlayRef.current,
        { scaleX: 1, transformOrigin: 'right' },
        { scaleX: 0, duration: 0.5, ease: 'power2.inOut' }
      );
  }, [routeKey]);

  useEffect(() => {
    setDisplayChildren(children);
  }, [children]);

  return (
    <>
      <div
        ref={overlayRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary))',
          transformOrigin: 'left',
          transform: 'scaleX(0)',
          pointerEvents: 'none',
        }}
      />
      <div ref={contentRef}>{displayChildren}</div>
    </>
  );
}
