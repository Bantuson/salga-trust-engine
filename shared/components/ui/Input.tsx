/**
 * SALGA Trust Engine — Input Component
 * Dark mode styled input matching design system
 */

import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const baseStyles: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  fontSize: 'var(--text-base)',
  fontFamily: 'var(--font-body)',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  outline: 'none',
  transition: 'var(--transition-base)',
};

const labelStyles: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
};

const errorStyles: React.CSSProperties = {
  marginTop: '4px',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-coral)',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, style, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    const inputStyles: React.CSSProperties = {
      ...baseStyles,
      ...style,
      ...(isFocused
        ? {
            borderColor: 'var(--color-teal)',
            boxShadow: 'var(--glow-teal)',
          }
        : {}),
      ...(error
        ? {
            borderColor: 'var(--color-coral)',
          }
        : {}),
      ...(icon ? { paddingLeft: '44px' } : {}),
    };

    return (
      <div className={cn('input-wrapper', className)}>
        {label && <label style={labelStyles}>{label}</label>}
        <div style={{ position: 'relative' }}>
          {icon && (
            <div
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn('input', className)}
            style={inputStyles}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
        </div>
        {error && <div style={errorStyles}>{error}</div>}
      </div>
    );
  }
);

Input.displayName = 'Input';
