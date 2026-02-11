/**
 * SALGA Trust Engine — NdebelePattern Component
 * SVG-based Ndebele/Zulu geometric patterns for subtle accents
 */

import React from 'react';
import { cn } from '../lib/utils';

export type PatternVariant = 'border' | 'corner' | 'background';

export interface NdebelePatternProps {
  variant: PatternVariant;
  className?: string;
  opacity?: number;
}

const BorderPattern: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg
    width="100%"
    height="8"
    viewBox="0 0 200 8"
    fill="none"
    preserveAspectRatio="none"
    style={{ display: 'block' }}
  >
    {/* Repeating geometric border pattern */}
    <pattern id="ndebele-border" x="0" y="0" width="40" height="8" patternUnits="userSpaceOnUse">
      {/* Triangle */}
      <polygon points="0,8 10,0 20,8" fill="#FF6B4A" opacity={opacity} />
      {/* Rectangle */}
      <rect x="20" y="2" width="8" height="4" fill="#00D9A6" opacity={opacity} />
      {/* Chevron */}
      <polygon points="28,4 32,0 36,4 32,8" fill="#FBBF24" opacity={opacity} />
    </pattern>
    <rect width="200" height="8" fill="url(#ndebele-border)" />
  </svg>
);

const CornerPattern: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    {/* Corner ornament pattern */}
    <g opacity={opacity}>
      {/* Outer triangle */}
      <polygon points="80,0 80,30 50,0" fill="#FF6B4A" opacity="0.8" />
      {/* Inner triangle */}
      <polygon points="80,0 80,20 60,0" fill="#00D9A6" opacity="0.6" />
      {/* Accent triangle */}
      <polygon points="80,0 80,10 70,0" fill="#FBBF24" opacity="0.4" />
      {/* Decorative rectangles */}
      <rect x="65" y="12" width="3" height="8" fill="#00D9A6" />
      <rect x="72" y="5" width="8" height="3" fill="#FF6B4A" />
    </g>
  </svg>
);

const BackgroundPattern: React.FC<{ opacity: number }> = ({ opacity }) => (
  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
    <defs>
      <pattern id="ndebele-bg" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
        {/* Repeating tile pattern */}
        <g opacity={opacity}>
          {/* Large triangle */}
          <polygon points="60,20 40,60 80,60" fill="#FF6B4A" opacity="0.05" />
          {/* Rectangle */}
          <rect x="10" y="10" width="20" height="30" fill="#00D9A6" opacity="0.05" />
          {/* Small triangles */}
          <polygon points="90,10 85,20 95,20" fill="#FBBF24" opacity="0.05" />
          <polygon points="20,80 15,90 25,90" fill="#00D9A6" opacity="0.05" />
          {/* Chevrons */}
          <polygon points="50,90 60,80 70,90 60,100" fill="#FF6B4A" opacity="0.05" />
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#ndebele-bg)" />
  </svg>
);

export const NdebelePattern: React.FC<NdebelePatternProps> = ({ variant, className, opacity = 0.1 }) => {
  const wrapperStyle: React.CSSProperties = {
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div className={cn('ndebele-pattern', className)} style={wrapperStyle}>
      {variant === 'border' && <BorderPattern opacity={opacity} />}
      {variant === 'corner' && <CornerPattern opacity={opacity} />}
      {variant === 'background' && <BackgroundPattern opacity={opacity} />}
    </div>
  );
};
