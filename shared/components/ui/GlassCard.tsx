/**
 * SALGA Trust Engine — GlassCard Component
 * Reusable glassmorphism card inspired by the municipal dashboard login card
 */

import React from 'react';
import { cn } from '../../lib/utils';

export type GlassCardVariant = 'default' | 'elevated' | 'interactive';
export type GlowColor = 'coral' | 'teal' | 'gold' | 'none';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: GlassCardVariant;
  glow?: GlowColor;
  onClick?: () => void;
  style?: React.CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const glowStyles: Record<GlowColor, React.CSSProperties> = {
  coral: {
    boxShadow: '0 0 20px rgba(255, 107, 74, 0.15), 0 0 60px rgba(255, 107, 74, 0.05)',
  },
  teal: {
    boxShadow: '0 0 20px rgba(0, 217, 166, 0.15), 0 0 60px rgba(0, 217, 166, 0.05)',
  },
  gold: {
    boxShadow: '0 0 20px rgba(251, 191, 36, 0.15), 0 0 60px rgba(251, 191, 36, 0.05)',
  },
  none: {},
};

const baseStyles: React.CSSProperties = {
  borderRadius: 'var(--radius-xl)',
  transition: 'var(--transition-base)',
  position: 'relative',
};

const variantStyles: Record<GlassCardVariant, React.CSSProperties> = {
  default: {
    background: 'rgba(26, 31, 58, 0.6)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  elevated: {
    background: 'rgba(26, 31, 58, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
  },
  interactive: {
    background: 'rgba(26, 31, 58, 0.6)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
  },
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  variant = 'default',
  glow = 'none',
  onClick,
  style,
  onMouseEnter,
  onMouseLeave,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const combinedStyles: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...(glow !== 'none' && isHovered && variant === 'interactive' ? glowStyles[glow] : {}),
    ...(variant === 'interactive' && isHovered
      ? {
          transform: 'translateY(-2px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }
      : {}),
    ...style, // User-provided styles override defaults
  };

  const handleMouseEnter = () => {
    if (variant === 'interactive') setIsHovered(true);
    onMouseEnter?.();
  };

  const handleMouseLeave = () => {
    if (variant === 'interactive') setIsHovered(false);
    onMouseLeave?.();
  };

  return (
    <div
      className={cn('glass-card', className)}
      style={combinedStyles}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};
