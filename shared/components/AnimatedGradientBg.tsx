/**
 * SALGA Trust Engine — AnimatedGradientBg Component
 * Rotating gradient background with 3 color schemes
 * Respects prefers-reduced-motion for accessibility
 */

import React from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export const AnimatedGradientBg: React.FC = () => {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    // Static navy background when reduced motion is preferred
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: -1,
          background: 'var(--color-navy)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
        overflow: 'hidden',
      }}
    >
      {/* Gradient Layer 1 */}
      <div
        className="gradient-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--gradient-1)',
          animation: 'gradientFadeInOut 20s ease-in-out infinite',
          animationDelay: '0s',
        }}
      />

      {/* Gradient Layer 2 */}
      <div
        className="gradient-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--gradient-2)',
          animation: 'gradientFadeInOut 20s ease-in-out infinite',
          animationDelay: '6.67s',
        }}
      />

      {/* Gradient Layer 3 */}
      <div
        className="gradient-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--gradient-3)',
          animation: 'gradientFadeInOut 20s ease-in-out infinite',
          animationDelay: '13.34s',
        }}
      />
    </div>
  );
};
