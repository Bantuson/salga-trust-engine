/**
 * SALGA Trust Engine — Badge Component
 * Status badges for ticket states
 */

import React from 'react';
import { cn } from '../../lib/utils';

export type TicketStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  status?: TicketStatus;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: React.ReactNode;
  className?: string;
}

const statusColors: Record<TicketStatus, { bg: string; text: string; border: string }> = {
  open: {
    bg: 'rgba(251, 191, 36, 0.1)',
    text: '#FBBF24',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  in_progress: {
    bg: 'rgba(0, 217, 166, 0.1)',
    text: '#00D9A6',
    border: 'rgba(0, 217, 166, 0.3)',
  },
  escalated: {
    bg: 'rgba(255, 107, 74, 0.1)',
    text: '#FF6B4A',
    border: 'rgba(255, 107, 74, 0.3)',
  },
  resolved: {
    bg: 'rgba(0, 217, 166, 0.2)',
    text: '#00F0B8',
    border: 'rgba(0, 217, 166, 0.5)',
  },
  closed: {
    bg: 'rgba(156, 163, 175, 0.1)',
    text: '#9CA3AF',
    border: 'rgba(156, 163, 175, 0.3)',
  },
};

const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
};

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  border: '1px solid',
};

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  default: {
    bg: 'rgba(156, 163, 175, 0.1)',
    text: '#9CA3AF',
    border: 'rgba(156, 163, 175, 0.3)',
  },
  success: {
    bg: 'rgba(0, 217, 166, 0.1)',
    text: '#00D9A6',
    border: 'rgba(0, 217, 166, 0.3)',
  },
  warning: {
    bg: 'rgba(251, 191, 36, 0.1)',
    text: '#FBBF24',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  error: {
    bg: 'rgba(255, 107, 74, 0.1)',
    text: '#FF6B4A',
    border: 'rgba(255, 107, 74, 0.3)',
  },
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: { padding: '2px 8px', fontSize: '0.75rem' },
  md: { padding: '4px 12px', fontSize: '0.875rem' },
  lg: { padding: '6px 16px', fontSize: '1rem' },
};

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant = 'default',
  size = 'md',
  children,
  className
}) => {
  // If status is provided, use status-based styling
  const colors = status ? statusColors[status] : variantColors[variant];
  const label = status ? statusLabels[status] : children;

  const styles: React.CSSProperties = {
    ...baseStyles,
    ...sizeStyles[size],
    background: colors.bg,
    color: colors.text,
    borderColor: colors.border,
  };

  return (
    <span className={cn('badge', className)} style={styles}>
      {label}
    </span>
  );
};
