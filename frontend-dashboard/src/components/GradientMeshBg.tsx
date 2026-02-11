/**
 * Gradient Mesh Background
 * Animated radial gradients for login page background
 * Uses GSAP for smooth background position animation
 */

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function GradientMeshBg() {
  const bgRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.to(bgRef.current, {
        backgroundPosition: '100% 50%',
        duration: 8,
        ease: 'none',
        repeat: -1,
        yoyo: true,
      });
    },
    { scope: bgRef }
  );

  return (
    <div
      ref={bgRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(255, 107, 74, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(0, 217, 166, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(167, 139, 250, 0.08) 0%, transparent 50%),
          var(--color-navy)
        `,
        backgroundSize: '200% 200%',
      }}
    />
  );
}
