import type {
  Municipality,
  ResponseTimeData,
  ResolutionRateData,
  HeatmapPoint,
  SystemSummary,
  CategoryBreakdownData,
} from '../types/public';

export const mockSystemSummary: SystemSummary = {
  total_municipalities: 2,
  total_tickets: 1247,
  total_sensitive_tickets: 23,
};

export const mockMunicipalities: Municipality[] = [
  { id: 'jhb-001', name: 'City of Johannesburg', code: 'JHB', province: 'Gauteng' },
  { id: 'cpt-001', name: 'City of Cape Town', code: 'CPT', province: 'Western Cape' },
];

export const mockResponseTimes: ResponseTimeData[] = [
  {
    municipality_id: 'jhb-001',
    municipality_name: 'City of Johannesburg',
    avg_response_hours: 36.2,
    ticket_count: 743,
  },
  {
    municipality_id: 'cpt-001',
    municipality_name: 'City of Cape Town',
    avg_response_hours: 19.4,
    ticket_count: 504,
  },
];

export const mockResolutionRates: ResolutionRateData[] = [
  {
    municipality_id: 'jhb-001',
    municipality_name: 'City of Johannesburg',
    resolution_rate: 62,
    total_tickets: 743,
    resolved_tickets: 461,
    trend: [
      { month: '2025-09', rate: 54 },
      { month: '2025-10', rate: 57 },
      { month: '2025-11', rate: 59 },
      { month: '2025-12', rate: 61 },
      { month: '2026-01', rate: 63 },
      { month: '2026-02', rate: 66 },
    ],
  },
  {
    municipality_id: 'cpt-001',
    municipality_name: 'City of Cape Town',
    resolution_rate: 79,
    total_tickets: 504,
    resolved_tickets: 398,
    trend: [
      { month: '2025-09', rate: 72 },
      { month: '2025-10', rate: 74 },
      { month: '2025-11', rate: 76 },
      { month: '2025-12', rate: 77 },
      { month: '2026-01', rate: 78 },
      { month: '2026-02', rate: 81 },
    ],
  },
];

export const mockCategoryBreakdown: CategoryBreakdownData[] = [
  { category: 'potholes', count: 312 },
  { category: 'water', count: 287 },
  { category: 'electricity', count: 241 },
  { category: 'sewage', count: 198 },
  { category: 'other', count: 209 },
];

export const mockHeatmapData: HeatmapPoint[] = [
  // Johannesburg - Sandton
  { lat: -26.1076, lng: 28.0567, intensity: 8, category: 'electricity' },
  { lat: -26.1020, lng: 28.0610, intensity: 5, category: 'water' },
  { lat: -26.1110, lng: 28.0530, intensity: 6, category: 'potholes' },
  // Johannesburg - Soweto
  { lat: -26.2485, lng: 27.8546, intensity: 9, category: 'water' },
  { lat: -26.2530, lng: 27.8610, intensity: 7, category: 'sewage' },
  { lat: -26.2410, lng: 27.8480, intensity: 6, category: 'potholes' },
  // Johannesburg - Hillbrow
  { lat: -26.1875, lng: 28.0475, intensity: 8, category: 'electricity' },
  { lat: -26.1910, lng: 28.0510, intensity: 7, category: 'sewage' },
  // Johannesburg - Alexandra
  { lat: -26.1068, lng: 28.1092, intensity: 9, category: 'water' },
  { lat: -26.1030, lng: 28.1050, intensity: 7, category: 'potholes' },
  { lat: -26.1100, lng: 28.1120, intensity: 5, category: 'other' },
  // Johannesburg - CBD
  { lat: -26.2041, lng: 28.0473, intensity: 6, category: 'potholes' },
  // Cape Town - CBD
  { lat: -33.9249, lng: 18.4241, intensity: 5, category: 'electricity' },
  { lat: -33.9210, lng: 18.4280, intensity: 4, category: 'other' },
  // Cape Town - Khayelitsha
  { lat: -34.0388, lng: 18.6819, intensity: 9, category: 'water' },
  { lat: -34.0350, lng: 18.6780, intensity: 8, category: 'sewage' },
  { lat: -34.0420, lng: 18.6860, intensity: 7, category: 'electricity' },
  // Cape Town - Mitchells Plain
  { lat: -34.0468, lng: 18.6177, intensity: 7, category: 'potholes' },
  { lat: -34.0500, lng: 18.6210, intensity: 6, category: 'water' },
  // Cape Town - Nyanga
  { lat: -33.9870, lng: 18.5738, intensity: 8, category: 'sewage' },
  { lat: -33.9900, lng: 18.5770, intensity: 6, category: 'electricity' },
];
