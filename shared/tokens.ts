/**
 * SALGA Trust Engine — TypeScript Design Tokens
 * Shared constants for programmatic use in React components
 */

export const colors = {
  rose: '#cd5e81',
  roseLight: '#e68ba5',
  roseDeep: '#a34866',
  accentGold: '#ffd54f',
  accentGoldHover: '#ffe082',
  teal: '#00bfa5',
  tealHover: '#00d9b8',
  gold: '#FBBF24',
  white: '#FFFFFF',
  textPrimary: '#f9f7f8',
  textSecondary: '#e0d4d8',
  textMuted: '#c7b3ba',
  surfaceElevated: 'rgba(255,255,255,0.08)',
  surfaceHigher: 'rgba(255,255,255,0.12)',
  surfaceHighest: 'rgba(255,255,255,0.16)',
  border: 'rgba(255,255,255,0.15)',
  borderHover: 'rgba(255,255,255,0.25)',
  chartPrimary: '#ffd54f',
  chartSecondary: '#00bfa5',
  chartTertiary: '#7c4dff',
  chartQuaternary: '#ff6e40',
} as const;

export const typography = {
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  displayFont: "'Space Grotesk', sans-serif",
} as const;

export const gradients = [
  'linear-gradient(135deg, #cd5e81 0%, #e68ba5 50%, #d97491 100%)',
  'linear-gradient(225deg, #cd5e81 0%, #c25474 50%, #a34866 100%)',
  'linear-gradient(315deg, #cd5e81 0%, #b84d6f 50%, #e68ba5 100%)',
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
