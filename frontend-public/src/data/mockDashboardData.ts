import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  HeatmapPoint,
  SystemSummary,
  CategoryBreakdownData,
} from '../types/public';

// TRNS-05: total_sensitive_tickets is 0 — GBV counts are NEVER exposed on the public dashboard
export const mockSystemSummary: SystemSummary = {
  total_municipalities: 5,
  total_tickets: 3247,
  total_sensitive_tickets: 0,
};

export const mockMunicipalities: Municipality[] = [
  { id: 'eth-001', name: 'eThekwini Metropolitan', code: 'ETH', province: 'KwaZulu-Natal' },
  { id: 'man-001', name: 'Mangaung Metropolitan', code: 'MAN', province: 'Free State' },
  { id: 'buf-001', name: 'Buffalo City Metropolitan', code: 'BUF', province: 'Eastern Cape' },
  { id: 'nmb-001', name: 'Nelson Mandela Bay', code: 'NMB', province: 'Eastern Cape' },
  { id: 'joh-001', name: 'City of Johannesburg', code: 'JHB', province: 'Gauteng' },
];

export const mockResponseTimes: ResponseTimeData[] = [
  {
    municipality_id: 'eth-001',
    municipality_name: 'eThekwini Metropolitan',
    avg_response_hours: 28.4,
    ticket_count: 812,
  },
  {
    municipality_id: 'man-001',
    municipality_name: 'Mangaung Metropolitan',
    avg_response_hours: 18.6,
    ticket_count: 504,
  },
  {
    municipality_id: 'buf-001',
    municipality_name: 'Buffalo City Metropolitan',
    avg_response_hours: 22.1,
    ticket_count: 467,
  },
  {
    municipality_id: 'nmb-001',
    municipality_name: 'Nelson Mandela Bay',
    avg_response_hours: 31.5,
    ticket_count: 589,
  },
  {
    municipality_id: 'joh-001',
    municipality_name: 'City of Johannesburg',
    avg_response_hours: 36.2,
    ticket_count: 875,
  },
];

// Each municipality's trend array shows an improvement arc over 6 months (2025-09 to 2026-02)
export const mockResolutionRates: ResolutionRateData[] = [
  {
    municipality_id: 'eth-001',
    municipality_name: 'eThekwini Metropolitan',
    resolution_rate: 71,
    total_tickets: 812,
    resolved_tickets: 577,
    trend: [
      { month: '2025-09', rate: 58 },
      { month: '2025-10', rate: 62 },
      { month: '2025-11', rate: 65 },
      { month: '2025-12', rate: 68 },
      { month: '2026-01', rate: 71 },
      { month: '2026-02', rate: 74 },
    ],
  },
  {
    municipality_id: 'man-001',
    municipality_name: 'Mangaung Metropolitan',
    resolution_rate: 79,
    total_tickets: 504,
    resolved_tickets: 398,
    trend: [
      { month: '2025-09', rate: 68 },
      { month: '2025-10', rate: 71 },
      { month: '2025-11', rate: 73 },
      { month: '2025-12', rate: 76 },
      { month: '2026-01', rate: 79 },
      { month: '2026-02', rate: 82 },
    ],
  },
  {
    municipality_id: 'buf-001',
    municipality_name: 'Buffalo City Metropolitan',
    resolution_rate: 68,
    total_tickets: 467,
    resolved_tickets: 318,
    trend: [
      { month: '2025-09', rate: 55 },
      { month: '2025-10', rate: 58 },
      { month: '2025-11', rate: 61 },
      { month: '2025-12', rate: 64 },
      { month: '2026-01', rate: 67 },
      { month: '2026-02', rate: 71 },
    ],
  },
  {
    municipality_id: 'nmb-001',
    municipality_name: 'Nelson Mandela Bay',
    resolution_rate: 65,
    total_tickets: 589,
    resolved_tickets: 383,
    trend: [
      { month: '2025-09', rate: 52 },
      { month: '2025-10', rate: 55 },
      { month: '2025-11', rate: 58 },
      { month: '2025-12', rate: 61 },
      { month: '2026-01', rate: 64 },
      { month: '2026-02', rate: 68 },
    ],
  },
  {
    municipality_id: 'joh-001',
    municipality_name: 'City of Johannesburg',
    resolution_rate: 62,
    total_tickets: 875,
    resolved_tickets: 543,
    trend: [
      { month: '2025-09', rate: 50 },
      { month: '2025-10', rate: 53 },
      { month: '2025-11', rate: 56 },
      { month: '2025-12', rate: 59 },
      { month: '2026-01', rate: 62 },
      { month: '2026-02', rate: 66 },
    ],
  },
];

// Realistic SA municipal issue distribution — categories match CATEGORY_CONFIG
// TRNS-05: No sensitive data categories present — public dashboard never exposes GBV data
export const mockCategoryBreakdown: CategoryBreakdownData[] = [
  { category: 'water', count: 612 },
  { category: 'electricity', count: 534 },
  { category: 'roads', count: 487 },
  { category: 'other', count: 412 },
  { category: 'waste', count: 389 },
  { category: 'sanitation', count: 298 },
];

// ~44 heatmap points covering all 5 municipalities with real GPS coordinates
// TRNS-05: No sensitive data categories present in heatmap — public dashboard never exposes GBV locations
export const mockHeatmapData: HeatmapPoint[] = [
  // eThekwini (Durban) — KwaZulu-Natal
  { lat: -29.8587, lng: 31.0218, intensity: 7, category: 'water' },
  { lat: -29.8630, lng: 31.0260, intensity: 5, category: 'electricity' },
  { lat: -29.8550, lng: 31.0170, intensity: 6, category: 'roads' },
  // eThekwini — uMlazi
  { lat: -29.9631, lng: 30.8967, intensity: 9, category: 'water' },
  { lat: -29.9680, lng: 30.9010, intensity: 8, category: 'sanitation' },
  { lat: -29.9590, lng: 30.8920, intensity: 7, category: 'waste' },
  // eThekwini — KwaMashu
  { lat: -29.7460, lng: 30.9785, intensity: 8, category: 'electricity' },
  { lat: -29.7510, lng: 30.9840, intensity: 6, category: 'roads' },
  { lat: -29.7410, lng: 30.9730, intensity: 7, category: 'water' },
  // eThekwini — Pinetown
  { lat: -29.8167, lng: 30.8500, intensity: 5, category: 'roads' },
  { lat: -29.8210, lng: 30.8560, intensity: 4, category: 'other' },

  // Mangaung (Bloemfontein) — Free State
  { lat: -29.1167, lng: 26.2167, intensity: 6, category: 'electricity' },
  { lat: -29.1210, lng: 26.2220, intensity: 5, category: 'roads' },
  { lat: -29.1120, lng: 26.2110, intensity: 4, category: 'water' },
  // Mangaung — Botshabelo
  { lat: -29.2667, lng: 26.7167, intensity: 8, category: 'water' },
  { lat: -29.2720, lng: 26.7220, intensity: 7, category: 'sanitation' },
  { lat: -29.2610, lng: 26.7110, intensity: 6, category: 'waste' },
  // Mangaung — Thaba Nchu
  { lat: -29.2167, lng: 26.8333, intensity: 5, category: 'roads' },
  { lat: -29.2220, lng: 26.8390, intensity: 4, category: 'electricity' },

  // Buffalo City (East London) — Eastern Cape
  { lat: -33.0153, lng: 27.9116, intensity: 6, category: 'electricity' },
  { lat: -33.0200, lng: 27.9170, intensity: 5, category: 'roads' },
  { lat: -33.0100, lng: 27.9060, intensity: 4, category: 'other' },
  // Buffalo City — Mdantsane
  { lat: -32.9500, lng: 27.7667, intensity: 8, category: 'water' },
  { lat: -32.9550, lng: 27.7720, intensity: 7, category: 'sanitation' },
  { lat: -32.9450, lng: 27.7610, intensity: 6, category: 'electricity' },
  // Buffalo City — King William's Town
  { lat: -32.8800, lng: 27.3900, intensity: 5, category: 'waste' },
  { lat: -32.8850, lng: 27.3960, intensity: 4, category: 'roads' },

  // Nelson Mandela Bay (Port Elizabeth) — Eastern Cape
  { lat: -33.9608, lng: 25.6022, intensity: 6, category: 'water' },
  { lat: -33.9660, lng: 25.6080, intensity: 5, category: 'electricity' },
  // Nelson Mandela Bay — KwaZakhele
  { lat: -33.8833, lng: 25.6333, intensity: 9, category: 'sanitation' },
  { lat: -33.8880, lng: 25.6390, intensity: 8, category: 'water' },
  { lat: -33.8780, lng: 25.6280, intensity: 7, category: 'waste' },
  // Nelson Mandela Bay — Motherwell
  { lat: -33.8000, lng: 25.7500, intensity: 8, category: 'roads' },
  { lat: -33.8050, lng: 25.7560, intensity: 6, category: 'electricity' },

  // City of Johannesburg — Gauteng
  // Sandton
  { lat: -26.1076, lng: 28.0567, intensity: 6, category: 'electricity' },
  { lat: -26.1030, lng: 28.0610, intensity: 4, category: 'other' },
  // Soweto
  { lat: -26.2485, lng: 27.8546, intensity: 9, category: 'water' },
  { lat: -26.2530, lng: 27.8610, intensity: 8, category: 'sanitation' },
  // Hillbrow
  { lat: -26.1875, lng: 28.0475, intensity: 8, category: 'electricity' },
  { lat: -26.1910, lng: 28.0510, intensity: 7, category: 'other' },
  // Alexandra
  { lat: -26.1068, lng: 28.1092, intensity: 9, category: 'water' },
  { lat: -26.1100, lng: 28.1120, intensity: 7, category: 'waste' },
  // CBD
  { lat: -26.2041, lng: 28.0473, intensity: 6, category: 'roads' },
  { lat: -26.2000, lng: 28.0430, intensity: 5, category: 'electricity' },
];
