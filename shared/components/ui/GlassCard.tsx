/**
 * SALGA Trust Engine — GlassCard Component
 * Reusable glassmorphism card inspired by the municipal dashboard login card
 */

import React from 'react';
import { cn } from '../../lib/utils';

export type GlassCardVariant = 'default' | 'elevated' | 'interactive';
export type GlowColor = 'gold' | 'teal' | 'none';

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
  gold: {
    boxShadow: '0 0 20px rgba(255, 213, 79, 0.2), 0 0 60px rgba(255, 213, 79, 0.08)',
  },
  teal: {
    boxShadow: '0 0 20px rgba(0, 191, 165, 0.2), 0 0 60px rgba(0, 191, 165, 0.08)',
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
    background: 'var(--glass-white-frost)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    border: '1px solid var(--glass-border)',
  },
  elevated: {
    background: 'var(--glass-pink-frost)',
    backdropFilter: 'blur(var(--glass-blur-medium))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-medium))',
    border: '1px solid var(--glass-border)',
  },
  interactive: {
    background: 'var(--glass-white-frost)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    border: '1px solid var(--glass-border)',
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
          borderColor: 'var(--glass-border)',
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
