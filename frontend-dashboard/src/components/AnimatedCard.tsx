/**
 * Animated Card Component
 * Reusable card wrapper with glow effects and hover animations
 * Uses GSAP for slide-up entrance animation
 */

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface AnimatedCardProps {
  children: React.ReactNode;
  glowColor?: 'coral' | 'teal';
  delay?: number;
  className?: string;
}

export function AnimatedCard({
  children,
  glowColor = 'coral',
  delay = 0,
  className = '',
}: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from(cardRef.current, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        delay,
        ease: 'back.out(1.7)',
      });
    },
    { scope: cardRef }
  );

  const glowClass = glowColor === 'coral' ? 'card-glow-coral' : 'card-glow-teal';

  return (
    <div ref={cardRef} className={`animated-card ${glowClass} ${className}`}>
      {children}
    </div>
  );
}
