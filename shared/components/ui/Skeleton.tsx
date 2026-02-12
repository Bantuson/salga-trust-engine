/**
 * SALGA Trust Engine — Skeleton Component
 * Dark mode skeleton loader with shimmer effect
 */

import React from 'react';
import BaseSkeleton, { SkeletonTheme as BaseSkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export interface SkeletonProps {
  count?: number;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const themeColors = {
  baseColor: 'rgba(163, 72, 102, 0.3)',
  highlightColor: 'rgba(205, 94, 129, 0.5)',
};

export const SkeletonTheme: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BaseSkeletonTheme baseColor={themeColors.baseColor} highlightColor={themeColors.highlightColor}>
    {children}
  </BaseSkeletonTheme>
);

export const Skeleton: React.FC<SkeletonProps> = (props) => (
  <SkeletonTheme>
    <BaseSkeleton {...props} />
  </SkeletonTheme>
);

// Convenience components
export const SkeletonCard: React.FC = () => (
  <SkeletonTheme>
    <div style={{ padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)' }}>
      <BaseSkeleton height={20} width="60%" style={{ marginBottom: 'var(--space-md)' }} />
      <BaseSkeleton count={3} height={16} style={{ marginBottom: 'var(--space-sm)' }} />
    </div>
  </SkeletonTheme>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <SkeletonTheme>
    <div>
      <BaseSkeleton height={40} style={{ marginBottom: 'var(--space-sm)' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <BaseSkeleton key={i} height={56} style={{ marginBottom: 'var(--space-xs)' }} />
      ))}
    </div>
  </SkeletonTheme>
);

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <SkeletonTheme>
    <BaseSkeleton count={lines} height={16} style={{ marginBottom: 'var(--space-sm)' }} />
  </SkeletonTheme>
);
