/**
 * Category configuration for SALGA Trust Engine service types.
 *
 * Maps each service category to its display color, background color,
 * icon identifier, and human-readable label.
 *
 * Used in: ticket tables, badge components, analytics charts, SparkLine cards.
 */

export interface CategoryConfig {
  /** Primary accent color (hex) */
  color: string;
  /** Light background tint for badge backgrounds (hex) */
  bgColor: string;
  /** Lucide icon name for this category */
  icon: string;
  /** Human-readable category label */
  label: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  water: {
    color: '#00bfa5',
    bgColor: '#e0f7fa',
    icon: 'droplet',
    label: 'Water & Sanitation',
  },
  electricity: {
    color: '#ffd54f',
    bgColor: '#fffde7',
    icon: 'zap',
    label: 'Electricity',
  },
  roads: {
    color: '#ff8a65',
    bgColor: '#fbe9e7',
    icon: 'road',
    label: 'Roads & Infrastructure',
  },
  waste: {
    color: '#81c784',
    bgColor: '#e8f5e9',
    icon: 'trash',
    label: 'Waste Management',
  },
  sanitation: {
    color: '#64b5f6',
    bgColor: '#e3f2fd',
    icon: 'pipe',
    label: 'Sanitation',
  },
  gbv: {
    color: '#e57373',
    bgColor: '#ffebee',
    icon: 'shield',
    label: 'GBV / Safety',
  },
  other: {
    color: '#b0bec5',
    bgColor: '#eceff1',
    icon: 'help-circle',
    label: 'Other',
  },
};

/**
 * Get category config with fallback to "other" for unknown categories.
 */
export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category.toLowerCase()] ?? CATEGORY_CONFIG.other;
}
