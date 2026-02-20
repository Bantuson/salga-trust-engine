/**
 * GlassSelect — Custom dropdown with frosted glass (glassmorphism) panel.
 *
 * Native <select>/<option> elements cannot support backdrop-filter,
 * so this renders divs for the dropdown to achieve true glass blur.
 */

import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  ariaLabel?: string;
  id?: string;
  maxWidth?: string;
}

export function GlassSelect({ value, onChange, options, ariaLabel, id, maxWidth }: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ ...styles.wrapper, ...(maxWidth ? { maxWidth } : {}) }}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={styles.trigger}
      >
        <span style={styles.triggerText}>{selected?.label ?? value}</span>
        <span style={{ ...styles.chevron, ...(open ? styles.chevronOpen : {}) }}>&#9662;</span>
      </button>

      {open && (
        <div style={styles.dropdown} role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                ...styles.option,
                ...(opt.value === value ? styles.optionActive : {}),
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    outline: 'none',
    textAlign: 'left',
  },
  triggerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: '0.7rem',
    opacity: 0.7,
    transition: 'transform 150ms ease',
    flexShrink: 0,
  },
  chevronOpen: {
    transform: 'rotate(180deg)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    minWidth: '100%',
    maxHeight: '240px',
    overflowY: 'auto',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    zIndex: 50,
    padding: '4px',
  },
  option: {
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-body)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 100ms ease',
  },
  optionActive: {
    backgroundColor: 'rgba(0, 191, 165, 0.25)',
    color: 'var(--text-primary)',
  },
};
