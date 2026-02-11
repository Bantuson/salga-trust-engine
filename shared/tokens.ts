/**
 * SALGA Trust Engine — TypeScript Design Tokens
 * Shared constants for programmatic use in React components
 */

export const colors = {
  navy: '#0A0E1A',
  navyLight: '#131829',
  navySurface: '#1A1F3A',
  coral: '#FF6B4A',
  coralHover: '#FF8566',
  teal: '#00D9A6',
  tealHover: '#00F0B8',
  white: '#FFFFFF',
  textPrimary: '#E8E8EC',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  surfaceElevated: 'rgba(255,255,255,0.05)',
  surfaceHigher: 'rgba(255,255,255,0.08)',
  surfaceHighest: 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.1)',
  borderHover: 'rgba(255,255,255,0.2)',
  chartPrimary: '#FF6B4A',
  chartSecondary: '#00D9A6',
  chartTertiary: '#A78BFA',
  chartQuaternary: '#FBBF24',
} as const;

export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  displayFont: "'Clash Display', 'Inter', -apple-system, sans-serif",
} as const;

export const animation = {
  durationFast: 0.15,
  durationBase: 0.25,
  durationSlow: 0.5,
  durationPage: 0.5,
  easeDefault: 'power2.out',
  easeInOut: 'power2.inOut',
  easeBounce: 'back.out(1.7)',
  staggerDefault: 0.1,
} as const;
