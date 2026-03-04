import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  CategoryBreakdownData,
  LeaderboardEntry,
} from '../types/public';

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

// Municipal performance leaderboard — ranked by composite score (resolution rate, response time, SDBIP achievement)
// rank_delta: positive = improved (moved up in rankings), negative = dropped, 0 = unchanged
export const mockLeaderboard: LeaderboardEntry[] = [
  { municipality_id: 'man-001', municipality_name: 'Mangaung Metropolitan', resolution_rate: 79, avg_response_hours: 18.6, sdbip_achievement_pct: 61.2, total_tickets: 504, current_rank: 1, previous_rank: 2, rank_delta: 1 },
  { municipality_id: 'eth-001', municipality_name: 'eThekwini Metropolitan', resolution_rate: 71, avg_response_hours: 28.4, sdbip_achievement_pct: 72.4, total_tickets: 812, current_rank: 2, previous_rank: 1, rank_delta: -1 },
  { municipality_id: 'buf-001', municipality_name: 'Buffalo City Metropolitan', resolution_rate: 68, avg_response_hours: 22.1, sdbip_achievement_pct: 78.6, total_tickets: 467, current_rank: 3, previous_rank: 3, rank_delta: 0 },
  { municipality_id: 'nmb-001', municipality_name: 'Nelson Mandela Bay', resolution_rate: 65, avg_response_hours: 31.5, sdbip_achievement_pct: 55.0, total_tickets: 589, current_rank: 4, previous_rank: 5, rank_delta: 1 },
  { municipality_id: 'joh-001', municipality_name: 'City of Johannesburg', resolution_rate: 62, avg_response_hours: 36.2, sdbip_achievement_pct: 48.3, total_tickets: 875, current_rank: 5, previous_rank: 4, rank_delta: -1 },
];
