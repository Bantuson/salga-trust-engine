/**
 * Custom Select dropdown — unified glassmorphic design system.
 *
 * Replaces native <select> elements with a fully styled, accessible dropdown
 * that matches the dark glassmorphism theme. Merges GlassSelect frosted glass
 * aesthetic with keyboard navigation, ARIA attributes, and size presets.
 *
 * Features:
 * - Keyboard navigation (Arrow keys, Enter, Space, Escape)
 * - Click-outside to close
 * - ARIA listbox role with aria-selected
 * - Scroll focused items into view
 * - Size presets: sm / md / lg
 * - autoFlip: detects available space below and flips dropdown upward
 * - ariaLabel: sets aria-label on trigger button (for selects without visible labels)
 * - data-lenis-prevent on dropdown panel (prevents scroll bleed)
 * - Full-width by default (fits form layouts)
 */
import { useState, useRef, useEffect, useCallback } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

const SIZE_STYLES: Record<string, { padding: string; fontSize: string }> = {
  sm: { padding: '6px 28px 6px 10px', fontSize: 'var(--text-xs)' },
  md: { padding: '8px 2.5rem 8px 12px', fontSize: 'var(--text-sm)' },
  lg: { padding: '12px 2.5rem 12px 16px', fontSize: 'var(--text-base)' },
};

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  /** Makes the trigger full-width (default true) */
  fullWidth?: boolean;
  /** Size preset: 'sm' | 'md' | 'lg' — defaults to 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Sets aria-label on the trigger button (for selects without visible labels) */
  ariaLabel?: string;
  /** When true, detects available space below and flips dropdown upward if insufficient */
  autoFlip?: boolean;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  disabled,
  required,
  fullWidth = true,
  size = 'md',
  ariaLabel,
  autoFlip = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allOptions: SelectOption[] = [{ value: '', label: placeholder }, ...options];
  const selectedLabel = allOptions.find((o) => o.value === value)?.label || placeholder;

  const sizeStyle = SIZE_STYLES[size];

  // Click-outside handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.children;
      if (items[focusedIndex]) {
        (items[focusedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      switch (e.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setFocusedIndex(allOptions.findIndex((o) => o.value === value));
          } else if (focusedIndex >= 0) {
            onChange(allOptions[focusedIndex].value);
            setIsOpen(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setFocusedIndex(0);
          } else {
            setFocusedIndex((prev) => Math.min(prev + 1, allOptions.length - 1));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setFocusedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
      }
    },
    [disabled, isOpen, focusedIndex, allOptions, value, onChange],
  );

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && autoFlip && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 248); // 240px maxHeight + 8px buffer
    }
    setIsOpen(!isOpen);
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block' }}
    >
      {label && (
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          {label}
          {required && <span style={{ color: 'var(--color-coral)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        style={{
          width: fullWidth ? '100%' : undefined,
          padding: sizeStyle.padding,
          fontSize: sizeStyle.fontSize,
          fontFamily: 'var(--font-body)',
          border: `1px solid ${isOpen ? 'var(--color-teal)' : 'rgba(255, 255, 255, 0.2)'}`,
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'left',
          position: 'relative',
          outline: 'none',
          transition: 'border-color 0.2s',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c7b3ba' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {selectedLabel}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          data-lenis-prevent
          style={{
            position: 'absolute',
            ...(dropUp
              ? { bottom: 'calc(100% + 4px)' }
              : { top: 'calc(100% + 4px)' }),
            left: 0,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxHeight: '240px',
            overflowY: 'auto',
            zIndex: 50,
            padding: '4px',
          }}
        >
          {allOptions.map((option, index) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
              style={{
                padding: '0.625rem 1rem',
                color: option.value === value ? 'var(--color-teal)' : 'var(--text-primary)',
                fontWeight: option.value === value ? 600 : 400,
                background:
                  option.value === value
                    ? focusedIndex === index
                      ? 'rgba(0, 191, 165, 0.25)'
                      : 'rgba(0, 191, 165, 0.25)'
                    : focusedIndex === index
                      ? 'rgba(205, 94, 129, 0.18)'
                      : 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                transition: 'background 0.15s',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
