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
  gold: '#FBBF24',
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
  displayFont: "'Space Grotesk', sans-serif",
} as const;

export const gradients = [
  'linear-gradient(135deg, #0A0E1A 0%, #1A1F3A 50%, #0F1523 100%)',
  'linear-gradient(225deg, #0A0E1A 0%, #1C1A2E 50%, #131829 100%)',
  'linear-gradient(315deg, #0A0E1A 0%, #0F2322 50%, #1A1F3A 100%)',
] as const;

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
