/**
 * SALGA Trust Engine — Button Component
 * Premium button with coral/teal/ghost variants and micro-interactions
 */

import React from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const baseStyles: React.CSSProperties = {
  border: 'none',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'var(--transition-base)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  position: 'relative',
  outline: 'none',
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '8px 16px',
    fontSize: 'var(--text-sm)',
    borderRadius: 'var(--radius-sm)',
  },
  md: {
    padding: '12px 24px',
    fontSize: 'var(--text-base)',
    borderRadius: 'var(--radius-md)',
  },
  lg: {
    padding: '16px 32px',
    fontSize: 'var(--text-lg)',
    borderRadius: 'var(--radius-lg)',
  },
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--color-coral)',
    color: 'var(--color-white)',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--color-teal)',
    border: '2px solid var(--color-teal)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-primary)',
  },
};

const LoadingSpinner: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', loading = false, disabled, className, style, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);

    const combinedStyles: React.CSSProperties = {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
      ...(disabled || loading
        ? { opacity: 0.5, cursor: 'not-allowed' }
        : {
            ...(isHovered && variant === 'primary'
              ? {
                  transform: 'scale(1.02)',
                  boxShadow: 'var(--glow-coral)',
                }
              : {}),
            ...(isHovered && variant === 'secondary'
              ? {
                  transform: 'scale(1.02)',
                  background: 'rgba(0, 217, 166, 0.1)',
                }
              : {}),
            ...(isHovered && variant === 'ghost'
              ? {
                  transform: 'scale(1.02)',
                  background: 'rgba(255, 255, 255, 0.05)',
                }
              : {}),
            ...(isFocused
              ? {
                  outline: `2px solid ${variant === 'primary' ? 'var(--color-coral)' : 'var(--color-teal)'}`,
                  outlineOffset: '2px',
                }
              : {}),
          }),
    };

    return (
      <button
        ref={ref}
        className={cn('button', className)}
        style={combinedStyles}
        disabled={disabled || loading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      >
        {loading && <LoadingSpinner />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
