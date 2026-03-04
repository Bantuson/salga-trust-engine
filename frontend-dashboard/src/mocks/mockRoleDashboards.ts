/**
 * mockRoleDashboards.ts — Mock data for all 9 role-specific dashboard pages.
 *
 * Used as catch-block fallback in each role dashboard page when the FastAPI
 * backend is unavailable. Data shapes match the API responses each page expects.
 *
 * Municipality context: eThekwini Metropolitan Municipality (demo tenant)
 * Financial year: 2025/2026
 */

// ---------------------------------------------------------------------------
// CFO Dashboard Mock
// ---------------------------------------------------------------------------

export const mockCFODashboard = {
  sdbip_achievement_summary: {
    total: 24,
    green: 14,
    amber: 7,
    red: 3,
    overall_pct: 72.5,
  },
  budget_execution: [
    {
      vote_name: 'Water Services',
      annual_target: 8500000,
      ytd_actual: 6120000,
      achievement_pct: 72.0,
      variance_alert: false,
    },
    {
      vote_name: 'Electricity Services',
      annual_target: 12400000,
      ytd_actual: 9734000,
      achievement_pct: 78.5,
      variance_alert: false,
    },
    {
      vote_name: 'Roads & Stormwater',
      annual_target: 6200000,
      ytd_actual: 2046000,
      achievement_pct: 33.0,
      variance_alert: true,
    },
    {
      vote_name: 'Community Services',
      annual_target: 3800000,
      ytd_actual: 3572000,
      achievement_pct: 94.0,
      variance_alert: false,
    },
    {
      vote_name: 'Waste Management',
      annual_target: 4100000,
      ytd_actual: 1394000,
      achievement_pct: 34.0,
      variance_alert: true,
    },
    {
      vote_name: 'Corporate Services',
      annual_target: 2900000,
      ytd_actual: 2494000,
      achievement_pct: 86.0,
      variance_alert: false,
    },
    {
      vote_name: 'Finance & Revenue',
      annual_target: 1800000,
      ytd_actual: 1476000,
      achievement_pct: 82.0,
      variance_alert: false,
    },
  ],
  service_delivery_correlation: [
    {
      kpi_name: 'Water service interruptions resolved within 48h',
      kpi_achievement_pct: 78.3,
      tickets_resolved: 412,
      resolution_rate_pct: 81.2,
    },
    {
      kpi_name: 'Electricity fault response time < 4h',
      kpi_achievement_pct: 85.1,
      tickets_resolved: 637,
      resolution_rate_pct: 88.6,
    },
    {
      kpi_name: 'Pothole repair within 21 days',
      kpi_achievement_pct: 44.7,
      tickets_resolved: 198,
      resolution_rate_pct: 47.3,
    },
    {
      kpi_name: 'Refuse collection adherence',
      kpi_achievement_pct: 91.2,
      tickets_resolved: 89,
      resolution_rate_pct: 93.8,
    },
    {
      kpi_name: 'Parks & recreation maintenance',
      kpi_achievement_pct: 67.4,
      tickets_resolved: 143,
      resolution_rate_pct: 69.1,
    },
  ],
  statutory_deadlines: [
    {
      report_type: 'Section 52 Q3 Report',
      due_date: '2026-04-30T00:00:00Z',
      status: 'in_progress',
    },
    {
      report_type: 'Section 72 Mid-Year Assessment',
      due_date: '2026-01-31T00:00:00Z',
      status: 'submitted',
    },
    {
      report_type: 'Section 46 Annual Performance Report',
      due_date: '2026-08-31T00:00:00Z',
      status: 'due',
    },
    {
      report_type: 'MFMA Section 121 Annual Financial Statements',
      due_date: '2025-08-31T00:00:00Z',
      status: 'tabled',
    },
    {
      report_type: 'Section 52 Q2 Report',
      due_date: '2025-11-30T00:00:00Z',
      status: 'submitted',
    },
  ],
};

// ---------------------------------------------------------------------------
// Municipal Manager Dashboard Mock
// ---------------------------------------------------------------------------

export const mockMMDashboard = {
  departments: [
    {
      department_id: 'mock-dept-001',
      dept_id: 'mock-dept-001',
      department_name: 'Roads & Infrastructure',
      total_kpis: 6,
      kpi_count: 6,
      green: 1,
      amber: 2,
      red: 3,
      avg_achievement_pct: 38.4,
    },
    {
      department_id: 'mock-dept-002',
      dept_id: 'mock-dept-002',
      department_name: 'Waste Management',
      total_kpis: 4,
      kpi_count: 4,
      green: 1,
      amber: 2,
      red: 1,
      avg_achievement_pct: 54.7,
    },
    {
      department_id: 'mock-dept-003',
      dept_id: 'mock-dept-003',
      department_name: 'Water & Sanitation',
      total_kpis: 5,
      kpi_count: 5,
      green: 2,
      amber: 2,
      red: 1,
      avg_achievement_pct: 67.2,
    },
    {
      department_id: 'mock-dept-004',
      dept_id: 'mock-dept-004',
      department_name: 'Electricity',
      total_kpis: 4,
      kpi_count: 4,
      green: 3,
      amber: 1,
      red: 0,
      avg_achievement_pct: 83.5,
    },
    {
      department_id: 'mock-dept-005',
      dept_id: 'mock-dept-005',
      department_name: 'Community Services',
      total_kpis: 3,
      kpi_count: 3,
      green: 2,
      amber: 1,
      red: 0,
      avg_achievement_pct: 86.1,
    },
    {
      department_id: 'mock-dept-006',
      dept_id: 'mock-dept-006',
      department_name: 'Corporate Services',
      total_kpis: 2,
      kpi_count: 2,
      green: 2,
      amber: 0,
      red: 0,
      avg_achievement_pct: 91.3,
    },
  ],
};

// ---------------------------------------------------------------------------
// Executive Mayor Dashboard Mock
// ---------------------------------------------------------------------------

export const mockMayorDashboard = {
  organizational_scorecard: {
    overall_achievement_pct: 71.3,
    total_kpis: 24,
    green: 14,
    amber: 7,
    red: 3,
  },
  sdbip_scorecards: [
    {
      id: 'mock-sdbip-001',
      scorecard_id: 'mock-sdbip-001',
      financial_year: '2025/2026',
      layer: 'municipal',
      status: 'draft',
      kpi_count: 24,
      achievement_pct: 71.3,
    },
    {
      id: 'mock-sdbip-002',
      scorecard_id: 'mock-sdbip-002',
      financial_year: '2024/2025',
      layer: 'municipal',
      status: 'approved',
      kpi_count: 22,
      achievement_pct: 68.9,
    },
    {
      id: 'mock-sdbip-003',
      scorecard_id: 'mock-sdbip-003',
      financial_year: '2023/2024',
      layer: 'municipal',
      status: 'tabled',
      kpi_count: 20,
      achievement_pct: 74.5,
    },
  ],
};

// ---------------------------------------------------------------------------
// Ward Councillor Dashboard Mock
// ---------------------------------------------------------------------------

export const mockCouncillorDashboard = {
  sdbip_summary: [
    {
      kpi_id: 'mock-kpi-001',
      description: 'Water service interruptions resolved within 48h',
      annual_target: 95,
      latest_actual: 78,
      achievement_pct: 82.1,
      traffic_light: 'green',
    },
    {
      kpi_id: 'mock-kpi-002',
      description: 'Electricity fault response time under 4 hours',
      annual_target: 90,
      latest_actual: 77,
      achievement_pct: 85.6,
      traffic_light: 'green',
    },
    {
      kpi_id: 'mock-kpi-003',
      description: 'Pothole repair within 21 calendar days',
      annual_target: 85,
      latest_actual: 38,
      achievement_pct: 44.7,
      traffic_light: 'red',
    },
    {
      kpi_id: 'mock-kpi-004',
      description: 'Refuse collection adherence to schedule',
      annual_target: 98,
      latest_actual: 91,
      achievement_pct: 92.9,
      traffic_light: 'green',
    },
    {
      kpi_id: 'mock-kpi-005',
      description: 'Building plan approval turnaround ≤ 30 days',
      annual_target: 80,
      latest_actual: 54,
      achievement_pct: 67.5,
      traffic_light: 'amber',
    },
    {
      kpi_id: 'mock-kpi-006',
      description: 'Parks & recreation facilities maintained to standard',
      annual_target: 90,
      latest_actual: 63,
      achievement_pct: 70.0,
      traffic_light: 'amber',
    },
    {
      kpi_id: 'mock-kpi-007',
      description: 'Environmental health inspections completed',
      annual_target: 200,
      latest_actual: 174,
      achievement_pct: 87.0,
      traffic_light: 'green',
    },
    {
      kpi_id: 'mock-kpi-008',
      description: 'Community facility bookings processed within 5 days',
      annual_target: 95,
      latest_actual: 48,
      achievement_pct: 50.5,
      traffic_light: 'amber',
    },
    {
      kpi_id: 'mock-kpi-009',
      description: 'Indigent household registrations processed',
      annual_target: 500,
      latest_actual: 423,
      achievement_pct: 84.6,
      traffic_light: 'green',
    },
    {
      kpi_id: 'mock-kpi-010',
      description: 'Stormwater infrastructure maintenance completed',
      annual_target: 60,
      latest_actual: 19,
      achievement_pct: 31.7,
      traffic_light: 'red',
    },
  ],
  statutory_reports: [
    {
      report_id: 'mock-report-001',
      report_type: 'Section 52 Q3 Report',
      financial_year: '2025/2026',
      status: 'in_progress',
      due_date: '2026-04-30T00:00:00Z',
    },
    {
      report_id: 'mock-report-002',
      report_type: 'Section 72 Mid-Year Assessment',
      financial_year: '2025/2026',
      status: 'submitted',
      due_date: '2026-01-31T00:00:00Z',
    },
    {
      report_id: 'mock-report-003',
      report_type: 'Section 52 Q2 Report',
      financial_year: '2025/2026',
      status: 'tabled',
      due_date: '2025-11-30T00:00:00Z',
    },
    {
      report_id: 'mock-report-004',
      report_type: 'Section 46 Annual Performance Report',
      financial_year: '2024/2025',
      status: 'tabled',
      due_date: '2025-08-31T00:00:00Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// Audit Committee Dashboard Mock
// ---------------------------------------------------------------------------

export const mockAuditCommitteeDashboard = {
  performance_reports: [
    {
      report_id: 'mock-rpt-ac-001',
      report_type: 'Section 72 Mid-Year Assessment',
      period: 'Q2 2025/2026',
      status: 'tabled',
      generated_date: '2026-01-28T09:15:00Z',
    },
    {
      report_id: 'mock-rpt-ac-002',
      report_type: 'Section 52 Q1 Report',
      period: 'Q1 2025/2026',
      status: 'tabled',
      generated_date: '2025-10-12T14:30:00Z',
    },
    {
      report_id: 'mock-rpt-ac-003',
      report_type: 'Section 46 Annual Performance Report',
      period: '2024/2025',
      status: 'tabled',
      generated_date: '2025-08-25T11:00:00Z',
    },
    {
      report_id: 'mock-rpt-ac-004',
      report_type: 'Section 52 Q3 Report',
      period: 'Q3 2025/2026',
      status: 'in_progress',
      generated_date: null,
    },
    {
      report_id: 'mock-rpt-ac-005',
      report_type: 'MFMA Section 121 Annual Financial Statements',
      period: '2024/2025',
      status: 'tabled',
      generated_date: '2025-08-29T16:45:00Z',
    },
  ],
  audit_trail: [
    {
      id: 'mock-audit-001',
      action: 'sdbip_approved',
      table_name: 'sdbip_scorecards',
      user_email: 'mayor@ethekwini.gov.za',
      timestamp: '2026-02-14T10:22:00Z',
      details: 'SDBIP 2025/2026 approved by Executive Mayor',
    },
    {
      id: 'mock-audit-002',
      action: 'actual_submitted',
      table_name: 'sdbip_actuals',
      user_email: 'director.water@ethekwini.gov.za',
      timestamp: '2026-02-10T08:45:00Z',
      details: 'Q3 actuals submitted for Water Services KPIs (5 items)',
    },
    {
      id: 'mock-audit-003',
      action: 'evidence_uploaded',
      table_name: 'evidence_documents',
      user_email: 'director.roads@ethekwini.gov.za',
      timestamp: '2026-02-08T15:30:00Z',
      details: 'Evidence uploaded: pothole_repair_Q3_report.pdf',
    },
    {
      id: 'mock-audit-004',
      action: 'actual_validated',
      table_name: 'sdbip_actuals',
      user_email: 'pms.officer@ethekwini.gov.za',
      timestamp: '2026-02-07T11:10:00Z',
      details: 'Q3 actuals validated for Electricity Services (verified against invoice)',
    },
    {
      id: 'mock-audit-005',
      action: 'report_mm_approved',
      table_name: 'statutory_reports',
      user_email: 'mm@ethekwini.gov.za',
      timestamp: '2026-01-30T09:00:00Z',
      details: 'Section 72 Mid-Year Assessment approved by Municipal Manager',
    },
    {
      id: 'mock-audit-006',
      action: 'sdbip_created',
      table_name: 'sdbip_scorecards',
      user_email: 'pms.officer@ethekwini.gov.za',
      timestamp: '2025-07-03T08:00:00Z',
      details: 'SDBIP scorecard created for 2025/2026 financial year',
    },
    {
      id: 'mock-audit-007',
      action: 'correction_submitted',
      table_name: 'sdbip_actuals',
      user_email: 'director.community@ethekwini.gov.za',
      timestamp: '2026-01-22T14:15:00Z',
      details: 'Correction submitted for Q2 Community Services actual (data entry error)',
    },
    {
      id: 'mock-audit-008',
      action: 'pa_signed',
      table_name: 'performance_agreements',
      user_email: 'mm@ethekwini.gov.za',
      timestamp: '2025-08-05T10:00:00Z',
      details: 'Performance agreement signed by Municipal Manager for 2025/2026',
    },
  ],
};

// ---------------------------------------------------------------------------
// Internal Auditor Dashboard Mock
// ---------------------------------------------------------------------------

export const mockInternalAuditorDashboard = {
  verification_queue: [
    {
      kpi_id: 'mock-kpi-003',
      kpi_description: 'Pothole repair within 21 calendar days',
      department_name: 'Roads & Infrastructure',
      evidence_items: [
        {
          evidence_id: 'mock-ev-001',
          filename: 'pothole_repair_Q3_progress_report.pdf',
          uploaded_at: '2026-02-08T15:30:00Z',
          verification_status: 'unverified',
        },
        {
          evidence_id: 'mock-ev-002',
          filename: 'job_cards_jan_feb_2026.xlsx',
          uploaded_at: '2026-02-09T09:15:00Z',
          verification_status: 'insufficient',
        },
      ],
    },
    {
      kpi_id: 'mock-kpi-010',
      kpi_description: 'Stormwater infrastructure maintenance completed',
      department_name: 'Roads & Infrastructure',
      evidence_items: [
        {
          evidence_id: 'mock-ev-003',
          filename: 'stormwater_maintenance_log_Q3.pdf',
          uploaded_at: '2026-02-11T11:00:00Z',
          verification_status: 'unverified',
        },
      ],
    },
    {
      kpi_id: 'mock-kpi-001',
      kpi_description: 'Water service interruptions resolved within 48h',
      department_name: 'Water & Sanitation',
      evidence_items: [
        {
          evidence_id: 'mock-ev-004',
          filename: 'helpdesk_resolution_report_Q3.pdf',
          uploaded_at: '2026-02-10T08:45:00Z',
          verification_status: 'verified',
        },
        {
          evidence_id: 'mock-ev-005',
          filename: 'CRM_ticket_export_Q3.csv',
          uploaded_at: '2026-02-10T08:50:00Z',
          verification_status: 'verified',
        },
      ],
    },
    {
      kpi_id: 'mock-kpi-005',
      kpi_description: 'Building plan approval turnaround ≤ 30 days',
      department_name: 'Community Services',
      evidence_items: [
        {
          evidence_id: 'mock-ev-006',
          filename: 'building_plan_register_Q3_2026.xlsx',
          uploaded_at: '2026-02-12T14:00:00Z',
          verification_status: 'unverified',
        },
      ],
    },
    {
      kpi_id: 'mock-kpi-008',
      kpi_description: 'Community facility bookings processed within 5 days',
      department_name: 'Community Services',
      evidence_items: [
        {
          evidence_id: 'mock-ev-007',
          filename: 'facilities_booking_register_Q3.pdf',
          uploaded_at: '2026-02-13T10:30:00Z',
          verification_status: 'insufficient',
        },
      ],
    },
    {
      kpi_id: 'mock-kpi-006',
      kpi_description: 'Parks & recreation facilities maintained to standard',
      department_name: 'Community Services',
      evidence_items: [
        {
          evidence_id: 'mock-ev-008',
          filename: 'parks_inspection_checklist_Q3.pdf',
          uploaded_at: '2026-02-14T09:00:00Z',
          verification_status: 'verified',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// MPAC Dashboard Mock
// ---------------------------------------------------------------------------

export const mockMPACDashboard = {
  statutory_reports: [
    {
      report_id: 'mock-rpt-mpac-001',
      report_type: 'Section 72 Mid-Year Assessment',
      period: 'Q2 2025/2026',
      status: 'tabled',
      generated_date: '2026-01-28T09:15:00Z',
    },
    {
      report_id: 'mock-rpt-mpac-002',
      report_type: 'Section 52 Q1 Report',
      period: 'Q1 2025/2026',
      status: 'tabled',
      generated_date: '2025-10-12T14:30:00Z',
    },
    {
      report_id: 'mock-rpt-mpac-003',
      report_type: 'Section 46 Annual Performance Report',
      period: '2024/2025',
      status: 'tabled',
      generated_date: '2025-08-25T11:00:00Z',
    },
    {
      report_id: 'mock-rpt-mpac-004',
      report_type: 'Section 52 Q3 Report',
      period: 'Q3 2025/2026',
      status: 'in_progress',
      generated_date: null,
    },
    {
      report_id: 'mock-rpt-mpac-005',
      report_type: 'Section 52 Q2 Report',
      period: 'Q2 2025/2026',
      status: 'submitted',
      generated_date: '2026-01-15T16:00:00Z',
    },
  ],
  investigation_flags: [
    {
      id: 'mock-flag-001',
      report_type: 'Section 52 Q2 Report',
      reason: 'Significant variance between Roads & Infrastructure targets and actuals (33% achievement vs 80% target)',
      notes: 'Request written explanation from Director: Roads & Infrastructure within 14 days',
      status: 'pending',
      flagged_at: '2026-01-20T10:00:00Z',
    },
    {
      id: 'mock-flag-002',
      report_type: 'Section 46 Annual Performance Report',
      reason: 'Waste Management KPI evidence documents not independently verified',
      notes: 'Internal Auditor to confirm verification status before Council tabling',
      status: 'acknowledged',
      flagged_at: '2025-09-05T14:30:00Z',
    },
    {
      id: 'mock-flag-003',
      report_type: 'Section 52 Q1 Report',
      reason: 'Stormwater maintenance Q1 actuals corrected twice — original figures suspect',
      notes: 'MPAC requests audit trail for all corrections made to stormwater KPI actuals',
      status: 'resolved',
      flagged_at: '2025-10-18T09:00:00Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// SALGA Admin Dashboard Mock
// ---------------------------------------------------------------------------

export const mockSALGAAdminDashboard = {
  municipalities: [
    {
      municipality_id: 'mock-muni-001',
      name: 'eThekwini Metropolitan Municipality',
      province: 'KwaZulu-Natal',
      category: 'Metro',
      kpi_achievement_pct: 71.3,
      ticket_resolution_pct: 78.4,
      sla_compliance_pct: 83.2,
      detail: {
        department_scores: [
          { department_name: 'Water & Sanitation', avg_achievement_pct: 67.2 },
          { department_name: 'Electricity', avg_achievement_pct: 83.5 },
          { department_name: 'Roads & Infrastructure', avg_achievement_pct: 38.4 },
          { department_name: 'Community Services', avg_achievement_pct: 86.1 },
        ],
        recent_reports: [
          { report_type: 'Section 72 Mid-Year Assessment', status: 'submitted', period: 'Q2 2025/2026' },
          { report_type: 'Section 52 Q1 Report', status: 'tabled', period: 'Q1 2025/2026' },
        ],
      },
    },
    {
      municipality_id: 'mock-muni-002',
      name: 'City of Tshwane Metropolitan Municipality',
      province: 'Gauteng',
      category: 'Metro',
      kpi_achievement_pct: 65.8,
      ticket_resolution_pct: 71.2,
      sla_compliance_pct: 79.5,
      detail: {
        department_scores: [
          { department_name: 'Water & Sanitation', avg_achievement_pct: 61.4 },
          { department_name: 'Electricity', avg_achievement_pct: 74.1 },
          { department_name: 'Roads & Infrastructure', avg_achievement_pct: 52.3 },
          { department_name: 'Waste Management', avg_achievement_pct: 75.6 },
        ],
        recent_reports: [
          { report_type: 'Section 52 Q3 Report', status: 'in_progress', period: 'Q3 2025/2026' },
          { report_type: 'Section 72 Mid-Year Assessment', status: 'tabled', period: 'Q2 2025/2026' },
        ],
      },
    },
    {
      municipality_id: 'mock-muni-003',
      name: 'Mangaung Metropolitan Municipality',
      province: 'Free State',
      category: 'Metro',
      kpi_achievement_pct: 58.4,
      ticket_resolution_pct: 64.7,
      sla_compliance_pct: 72.1,
      detail: {
        department_scores: [
          { department_name: 'Water & Sanitation', avg_achievement_pct: 54.2 },
          { department_name: 'Electricity', avg_achievement_pct: 68.9 },
          { department_name: 'Roads & Infrastructure', avg_achievement_pct: 41.5 },
          { department_name: 'Community Services', avg_achievement_pct: 72.4 },
        ],
        recent_reports: [
          { report_type: 'Section 72 Mid-Year Assessment', status: 'submitted', period: 'Q2 2025/2026' },
        ],
      },
    },
    {
      municipality_id: 'mock-muni-004',
      name: 'Nelson Mandela Bay Metropolitan Municipality',
      province: 'Eastern Cape',
      category: 'Metro',
      kpi_achievement_pct: 62.1,
      ticket_resolution_pct: 68.3,
      sla_compliance_pct: 77.4,
      detail: {
        department_scores: [
          { department_name: 'Water & Sanitation', avg_achievement_pct: 58.6 },
          { department_name: 'Electricity', avg_achievement_pct: 71.2 },
          { department_name: 'Roads & Infrastructure', avg_achievement_pct: 48.7 },
          { department_name: 'Community Services', avg_achievement_pct: 80.3 },
        ],
        recent_reports: [
          { report_type: 'Section 52 Q3 Report', status: 'in_progress', period: 'Q3 2025/2026' },
          { report_type: 'Section 72 Mid-Year Assessment', status: 'tabled', period: 'Q2 2025/2026' },
        ],
      },
    },
    {
      municipality_id: 'mock-muni-005',
      name: 'Buffalo City Metropolitan Municipality',
      province: 'Eastern Cape',
      category: 'Metro',
      kpi_achievement_pct: 74.6,
      ticket_resolution_pct: 80.1,
      sla_compliance_pct: 85.7,
      detail: {
        department_scores: [
          { department_name: 'Water & Sanitation', avg_achievement_pct: 71.3 },
          { department_name: 'Electricity', avg_achievement_pct: 82.4 },
          { department_name: 'Roads & Infrastructure', avg_achievement_pct: 63.8 },
          { department_name: 'Community Services', avg_achievement_pct: 88.7 },
        ],
        recent_reports: [
          { report_type: 'Section 72 Mid-Year Assessment', status: 'submitted', period: 'Q2 2025/2026' },
          { report_type: 'Section 52 Q1 Report', status: 'tabled', period: 'Q1 2025/2026' },
        ],
      },
    },
  ],
  summary: {
    total_municipalities: 5,
    avg_kpi_achievement: 66.4,
    avg_ticket_resolution: 72.5,
    avg_sla_compliance: 79.6,
  },
};

// ---------------------------------------------------------------------------
// Section 56 Director Dashboard Mock
// ---------------------------------------------------------------------------

export const mockSection56Dashboard = {
  empty_state: false,
  department_name: 'Technical Services Department',
  kpi_count: 8,
  green_count: 4,
  amber_count: 3,
  red_count: 1,
  total_achievement_pct: 68.7,
  kpi_details: [
    {
      kpi_id: 'mock-kpi-s56-001',
      description: 'Stormwater infrastructure maintenance completed',
      annual_target: 60,
      latest_actual: 19,
      achievement_pct: 31.7,
      traffic_light: 'red',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-002',
      description: 'Water main leaks repaired within 72 hours',
      annual_target: 90,
      latest_actual: 54,
      achievement_pct: 60.0,
      traffic_light: 'amber',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-003',
      description: 'Building plan approval turnaround within 30 days',
      annual_target: 80,
      latest_actual: 54,
      achievement_pct: 67.5,
      traffic_light: 'amber',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-004',
      description: 'Unaccounted water losses below 15%',
      annual_target: 15,
      latest_actual: 18.3,
      achievement_pct: 70.8,
      traffic_light: 'amber',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-005',
      description: 'Water quality compliance with SANS 241',
      annual_target: 99,
      latest_actual: 74,
      achievement_pct: 74.7,
      traffic_light: 'green',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-006',
      description: 'Water service interruptions resolved within 48h',
      annual_target: 95,
      latest_actual: 78,
      achievement_pct: 82.1,
      traffic_light: 'green',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-007',
      description: 'Households with access to reliable water supply',
      annual_target: 340000,
      latest_actual: 297000,
      achievement_pct: 87.4,
      traffic_light: 'green',
      quarter: 'Q3',
    },
    {
      kpi_id: 'mock-kpi-s56-008',
      description: 'Sanitation backlogs cleared in informal settlements',
      annual_target: 1200,
      latest_actual: 1086,
      achievement_pct: 90.5,
      traffic_light: 'green',
      quarter: 'Q3',
    },
  ],
  recent_activity: [
    { id: 'act-001', action: 'KPI actual submitted', detail: 'Q3 actual for stormwater maintenance — 19 of 60 target', timestamp: '2026-02-28T14:30:00Z' },
    { id: 'act-002', action: 'Evidence uploaded', detail: 'water_quality_lab_results_Q3.pdf attached to KPI-BSD-005', timestamp: '2026-02-27T10:15:00Z' },
    { id: 'act-003', action: 'Scorecard approved', detail: 'Departmental SDBIP scorecard 2025/2026 approved by Municipal Manager', timestamp: '2026-02-20T09:00:00Z' },
    { id: 'act-004', action: 'KPI target revised', detail: 'Water main repair target adjusted from 85% to 90% per Council resolution', timestamp: '2026-02-15T11:45:00Z' },
    { id: 'act-005', action: 'Quarterly review meeting', detail: 'Q2 performance review completed — 3 corrective actions issued', timestamp: '2026-01-31T16:00:00Z' },
  ],
  team_members: [
    { id: 'tm-001', name: 'Sibongile Nkosi', role: 'Director: Technical Services', email: 'sibongile.nkosi@ethekwini.gov.za' },
    { id: 'tm-002', name: 'Johan van der Merwe', role: 'Deputy Director: Water & Sanitation', email: 'johan.vdm@ethekwini.gov.za' },
    { id: 'tm-003', name: 'Ayanda Mthembu', role: 'Manager: Infrastructure Planning', email: 'ayanda.m@ethekwini.gov.za' },
    { id: 'tm-004', name: 'Fatima Osman', role: 'PMS Officer: Technical Services', email: 'fatima.o@ethekwini.gov.za' },
  ],
};

// ---------------------------------------------------------------------------
// Convenience map for OversightDashboardPage (ROLE_CONFIG mock fallback)
// ---------------------------------------------------------------------------

export const mockOversightData: Record<string, any> = {
  councillor: mockCouncillorDashboard,
  audit_committee: mockAuditCommitteeDashboard,
  internal_auditor: mockInternalAuditorDashboard,
  mpac: mockMPACDashboard,
};

// ---------------------------------------------------------------------------
// Risk Register Mock (Phase 32)
// ---------------------------------------------------------------------------

export const mockRiskRegister = [
  {
    id: 'risk-001',
    kpi_id: 'kpi-001',
    department_id: 'dept-001',
    title: 'Water infrastructure failure risk',
    description: 'Aging water pipes in Ward 12 may cause service interruptions',
    likelihood: 4,
    impact: 5,
    risk_rating: 'critical',
    responsible_person_id: 'user-001',
    is_auto_flagged: true,
    auto_flagged_at: '2026-02-28T10:00:00Z',
    mitigations: [
      {
        id: 'mit-001',
        risk_item_id: 'risk-001',
        strategy: 'Emergency pipe replacement programme — R2.5M allocated from MIG',
        responsible_person_id: 'user-002',
        target_date: '2026-06-30',
        status: 'in_progress',
        created_at: '2026-02-15T08:00:00Z',
      },
    ],
    created_at: '2026-02-10T09:00:00Z',
    updated_at: '2026-02-28T10:00:00Z',
  },
  {
    id: 'risk-002',
    kpi_id: 'kpi-003',
    department_id: 'dept-002',
    title: 'Revenue collection below target',
    description: 'Property rates collection at 42% — below 80% green threshold',
    likelihood: 3,
    impact: 4,
    risk_rating: 'high',
    responsible_person_id: 'user-003',
    is_auto_flagged: true,
    auto_flagged_at: '2026-03-01T07:00:00Z',
    mitigations: [
      {
        id: 'mit-002',
        risk_item_id: 'risk-002',
        strategy: 'Engage debt collection agency for accounts >90 days overdue',
        responsible_person_id: 'user-004',
        target_date: '2026-04-15',
        status: 'open',
        created_at: '2026-03-01T09:00:00Z',
      },
    ],
    created_at: '2026-03-01T07:00:00Z',
    updated_at: null,
  },
  {
    id: 'risk-003',
    kpi_id: 'kpi-005',
    department_id: 'dept-001',
    title: 'Electricity distribution losses',
    description: 'Technical and non-technical losses exceed 15% tolerance',
    likelihood: 3,
    impact: 3,
    risk_rating: 'high',
    responsible_person_id: null,
    is_auto_flagged: false,
    auto_flagged_at: null,
    mitigations: [],
    created_at: '2026-02-20T14:00:00Z',
    updated_at: null,
  },
  {
    id: 'risk-004',
    kpi_id: 'kpi-008',
    department_id: 'dept-003',
    title: 'Staff vacancy rate in community services',
    description: 'Vacancy rate at 28% affecting service delivery capacity',
    likelihood: 2,
    impact: 3,
    risk_rating: 'medium',
    responsible_person_id: 'user-005',
    is_auto_flagged: false,
    auto_flagged_at: null,
    mitigations: [
      {
        id: 'mit-003',
        risk_item_id: 'risk-004',
        strategy: 'Fast-track recruitment for 12 critical posts approved in organogram',
        responsible_person_id: 'user-005',
        target_date: '2026-05-31',
        status: 'in_progress',
        created_at: '2026-02-25T10:00:00Z',
      },
    ],
    created_at: '2026-02-25T10:00:00Z',
    updated_at: null,
  },
];
