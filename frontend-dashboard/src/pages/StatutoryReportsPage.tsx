/**
 * Statutory Reports Page — list, approve, generate, download Section 52/72/46/121 reports.
 *
 * Two-section layout:
 *  1. Report List — filterable by financial year and report type, with approval workflow buttons
 *  2. Deadline Calendar — 7 statutory deadlines with traffic-light urgency colors
 *
 * Routes: /pms?view=statutory-reports (embedded inside PmsHubPage)
 *
 * API: /api/v1/statutory-reports/*
 * Requirements: REPORT-05 (approval workflow UI), REPORT-07 (deadline calendar), REPORT-08 (downloads)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';
import { useAuth } from '../hooks/useAuth';
import { usePageHeader } from '../hooks/usePageHeader';
import { DEMO_MODE } from '../lib/demoMode';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatutoryReport {
  id: string;
  report_type: 'section_52' | 'section_72' | 'section_46' | 'section_121';
  financial_year: string;
  quarter: string | null;
  period_start: string;
  period_end: string;
  title: string;
  status: 'drafting' | 'internal_review' | 'mm_approved' | 'submitted' | 'tabled';
  generated_at: string | null;
  approved_at: string | null;
  pdf_storage_path: string | null;
  docx_storage_path: string | null;
  created_at: string;
}

interface StatutoryDeadline {
  id: string;
  report_type: string;
  financial_year: string;
  quarter: string | null;
  deadline_date: string;
  description: string;
  task_created: boolean;
  notification_30d_sent: boolean;
  notification_14d_sent: boolean;
  notification_7d_sent: boolean;
  notification_3d_sent: boolean;
  notification_overdue_sent: boolean;
}

interface CreateReportForm {
  report_type: StatutoryReport['report_type'];
  financial_year: string;
  quarter: string;
  title: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface StatutoryReportsPageProps {
  showForm?: boolean;
  onCloseForm?: () => void;
}

// ── Role-based transition gates ────────────────────────────────────────────────

const TRANSITION_ROLES: Record<string, string[]> = {
  submit_for_review: ['pms_officer', 'department_manager', 'cfo', 'admin', 'salga_admin', 'municipal_manager'],
  approve: ['municipal_manager', 'cfo', 'admin', 'salga_admin'],
  submit_external: ['municipal_manager', 'admin', 'salga_admin'],
  table: ['municipal_manager', 'speaker', 'admin', 'salga_admin'],
};

// ── Label helpers ──────────────────────────────────────────────────────────────

const REPORT_TYPE_LABELS: Record<string, string> = {
  section_52: 'Section 52',
  section_72: 'Section 72 Mid-Year',
  section_46: 'Section 46 Annual',
  section_121: 'Section 121 Annual Report',
};

const STATUS_LABELS: Record<string, string> = {
  drafting: 'Drafting',
  internal_review: 'Internal Review',
  mm_approved: 'MM Approved',
  submitted: 'Submitted',
  tabled: 'Tabled',
};

const STATUS_COLORS: Record<string, string> = {
  drafting: '#6b7280',
  internal_review: '#3b82f6',
  mm_approved: '#10b981',
  submitted: '#8b5cf6',
  tabled: '#047857',
};

// ── Demo data (fallback when API unavailable) ──────────────────────────────────

const DEMO_REPORTS: StatutoryReport[] = [
  {
    id: 'demo-sr-1',
    report_type: 'section_52',
    financial_year: '2025/26',
    quarter: 'Q1',
    period_start: '2025-07-01',
    period_end: '2025-09-30',
    title: 'Section 52 Report — Q1 2025/26',
    status: 'drafting',
    generated_at: null,
    approved_at: null,
    pdf_storage_path: null,
    docx_storage_path: null,
    created_at: '2025-10-01T08:00:00Z',
  },
  {
    id: 'demo-sr-2',
    report_type: 'section_72',
    financial_year: '2025/26',
    quarter: null,
    period_start: '2025-07-01',
    period_end: '2025-12-31',
    title: 'Section 72 Mid-Year Performance Report 2025/26',
    status: 'internal_review',
    generated_at: '2026-01-25T14:30:00Z',
    approved_at: null,
    pdf_storage_path: 'reports/section72-2025-26.pdf',
    docx_storage_path: 'reports/section72-2025-26.docx',
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'demo-sr-3',
    report_type: 'section_46',
    financial_year: '2024/25',
    quarter: null,
    period_start: '2024-07-01',
    period_end: '2025-06-30',
    title: 'Section 46 Annual Performance Report 2024/25',
    status: 'mm_approved',
    generated_at: '2025-08-20T10:00:00Z',
    approved_at: '2025-08-25T16:00:00Z',
    pdf_storage_path: 'reports/section46-2024-25.pdf',
    docx_storage_path: 'reports/section46-2024-25.docx',
    created_at: '2025-08-01T09:00:00Z',
  },
];

const DEMO_DEADLINES: StatutoryDeadline[] = [
  {
    id: 'dl-1',
    report_type: 'section_52',
    financial_year: '2025/26',
    quarter: 'Q1',
    deadline_date: '2025-10-31',
    description: 'Section 52 Monthly Budget Statement — Q1 due to Treasury',
    task_created: true,
    notification_30d_sent: true,
    notification_14d_sent: true,
    notification_7d_sent: true,
    notification_3d_sent: true,
    notification_overdue_sent: false,
  },
  {
    id: 'dl-2',
    report_type: 'section_72',
    financial_year: '2025/26',
    quarter: null,
    deadline_date: '2026-01-25',
    description: 'Section 72 Mid-Year Budget and Performance Assessment',
    task_created: true,
    notification_30d_sent: true,
    notification_14d_sent: false,
    notification_7d_sent: false,
    notification_3d_sent: false,
    notification_overdue_sent: false,
  },
  {
    id: 'dl-3',
    report_type: 'section_46',
    financial_year: '2025/26',
    quarter: null,
    deadline_date: '2026-08-31',
    description: 'Section 46 Annual Performance Report — submission to AG',
    task_created: false,
    notification_30d_sent: false,
    notification_14d_sent: false,
    notification_7d_sent: false,
    notification_3d_sent: false,
    notification_overdue_sent: false,
  },
  {
    id: 'dl-4',
    report_type: 'section_121',
    financial_year: '2025/26',
    quarter: null,
    deadline_date: '2026-11-30',
    description: 'Section 121 Annual Report — tabled to Council',
    task_created: false,
    notification_30d_sent: false,
    notification_14d_sent: false,
    notification_7d_sent: false,
    notification_3d_sent: false,
    notification_overdue_sent: false,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function currentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  // South African financial year: July 1 – June 30
  if (month >= 7) {
    return `${year}/${String(year + 1).slice(2)}`;
  }
  return `${year - 1}/${String(year).slice(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const deadline = new Date(dateStr);
  deadline.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): { dot: string; label: string; pulse: boolean } {
  if (days <= 0) return { dot: '#ef4444', label: 'OVERDUE', pulse: true };
  if (days <= 7) return { dot: '#ef4444', label: 'Critical', pulse: false };
  if (days <= 14) return { dot: '#f97316', label: 'Urgent', pulse: false };
  if (days <= 30) return { dot: '#f59e0b', label: 'Approaching', pulse: false };
  return { dot: '#10b981', label: 'Safe', pulse: false };
}

function reportTypeHumanLabel(type: string, quarter: string | null): string {
  const base = REPORT_TYPE_LABELS[type] || type;
  if (quarter) return `${base} ${quarter}`;
  return base;
}

function autoTitle(type: string, fy: string, quarter: string): string {
  const base = REPORT_TYPE_LABELS[type] || type;
  if (type === 'section_52' && quarter) return `${base} Report — ${quarter} ${fy}`;
  return `${base} ${fy}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function StatutoryReportsPage({ showForm = false, onCloseForm }: StatutoryReportsPageProps) {
  usePageHeader('Statutory Reports');
  const { session, getUserRole } = useAuth();
  const token = session?.access_token ?? null;
  const role = getUserRole();

  const [reports, setReports] = useState<StatutoryReport[]>([]);
  const [deadlines, setDeadlines] = useState<StatutoryDeadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFY, setSelectedFY] = useState(currentFinancialYear());
  const [filterType, setFilterType] = useState<string>('all');

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Create form state
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateReportForm>({
    report_type: 'section_52',
    financial_year: currentFinancialYear(),
    quarter: 'Q1',
    title: '',
  });

  // Auto-set title when form fields change
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      title: autoTitle(prev.report_type, prev.financial_year, prev.quarter),
    }));
  }, [form.report_type, form.financial_year, form.quarter]);

  // ── Fetch reports ────────────────────────────────────────────────────────────

  const fetchReports = useCallback(async () => {
    if (DEMO_MODE) {
      setReports(DEMO_REPORTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ financial_year: selectedFY });
      if (filterType !== 'all') params.set('report_type', filterType);
      const res = await fetch(`/api/v1/statutory-reports/?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      setReports(await res.json());
    } catch {
      // Fall back to demo data when API is unavailable
      setReports(DEMO_REPORTS);
    } finally {
      setLoading(false);
    }
  }, [token, selectedFY, filterType]);

  const fetchDeadlines = useCallback(async () => {
    if (DEMO_MODE) {
      setDeadlines(DEMO_DEADLINES);
      return;
    }
    try {
      const params = new URLSearchParams({ financial_year: selectedFY });
      const res = await fetch(`/api/v1/statutory-reports/deadlines?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API returns DeadlineCalendarResponse with a deadlines array
        setDeadlines(data.deadlines ?? data);
      }
    } catch {
      // Non-critical — fall back to demo deadlines
      setDeadlines(DEMO_DEADLINES);
    }
  }, [token, selectedFY]);

  useEffect(() => {
    fetchReports();
    fetchDeadlines();
  }, [fetchReports, fetchDeadlines]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerate = async (id: string) => {
    setGeneratingId(id);
    try {
      const res = await fetch(`/api/v1/statutory-reports/${id}/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      showToast('Report generation queued — check back in a few minutes.');
      await fetchReports();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to queue report generation');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleTransition = async (id: string, event: string) => {
    setTransitioningId(id);
    try {
      const res = await fetch(`/api/v1/statutory-reports/${id}/transitions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Error ${res.status}`);
      }
      showToast('Report status updated successfully.');
      await fetchReports();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update report status');
    } finally {
      setTransitioningId(null);
    }
  };

  const handleDownload = (id: string, format: 'pdf' | 'docx') => {
    const url = `/api/v1/statutory-reports/${id}/download/${format}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('Authorization', `Bearer ${token ?? ''}`);
    // Trigger download via fetch to include auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `report-${id}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => showToast('Failed to download file. Please try again.'));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        report_type: form.report_type,
        financial_year: form.financial_year,
        title: form.title,
      };
      if (form.report_type === 'section_52' && form.quarter) {
        body.quarter = form.quarter;
      }
      const res = await fetch('/api/v1/statutory-reports/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Error ${res.status}`);
      }
      if (onCloseForm) onCloseForm();
      showToast('Statutory report created successfully.');
      await fetchReports();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Role checks ──────────────────────────────────────────────────────────────

  const canDo = (action: string) => TRANSITION_ROLES[action]?.includes(role) ?? false;

  // ── Transition button for a report ──────────────────────────────────────────

  const renderTransitionButton = (report: StatutoryReport) => {
    const isTransitioning = transitioningId === report.id;

    switch (report.status) {
      case 'drafting':
        if (!canDo('submit_for_review')) return null;
        return (
          <Button
            size="sm"
            variant="secondary"
            loading={isTransitioning}
            onClick={() => handleTransition(report.id, 'submit_for_review')}
          >
            Submit for Review
          </Button>
        );
      case 'internal_review':
        if (!canDo('approve')) return null;
        return (
          <Button
            size="sm"
            variant="secondary"
            loading={isTransitioning}
            onClick={() => handleTransition(report.id, 'approve')}
          >
            Approve
          </Button>
        );
      case 'mm_approved':
        if (!canDo('submit_external')) return null;
        return (
          <Button
            size="sm"
            variant="secondary"
            loading={isTransitioning}
            onClick={() => handleTransition(report.id, 'submit_external')}
          >
            Submit to AG/Treasury
          </Button>
        );
      case 'submitted':
        if (!canDo('table')) return null;
        return (
          <Button
            size="sm"
            variant="secondary"
            loading={isTransitioning}
            onClick={() => handleTransition(report.id, 'table')}
          >
            Table to Council
          </Button>
        );
      default:
        return null;
    }
  };

  // ── Generate button visibility ───────────────────────────────────────────────

  const showGenerateButton = (report: StatutoryReport) =>
    report.status === 'drafting' || report.status === 'internal_review';

  // ── Sort deadlines by date ───────────────────────────────────────────────────

  const sortedDeadlines = [...deadlines].sort(
    (a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime()
  );

  // ── Filtered reports ─────────────────────────────────────────────────────────

  const filteredReports = reports.filter((r) => {
    if (r.financial_year !== selectedFY && selectedFY !== '') return false;
    if (filterType !== 'all' && r.report_type !== filterType) return false;
    return true;
  });

  // ── Styles ───────────────────────────────────────────────────────────────────

  const statusBadge = (status: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 'var(--radius-sm, 4px)',
    fontSize: 'var(--text-xs, 11px)',
    fontWeight: 600,
    color: STATUS_COLORS[status] || 'var(--text-secondary)',
    background: `${STATUS_COLORS[status] || 'rgba(255,255,255,0.1)'}22`,
    border: `1px solid ${STATUS_COLORS[status] || 'rgba(255,255,255,0.2)'}66`,
    whiteSpace: 'nowrap' as const,
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'var(--color-teal, #14b8a6)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 9999,
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            maxWidth: '360px',
          }}
        >
          {toast}
        </div>
      )}

      {/* ── Create Report Form ────────────────────────────────────────────── */}
      {showForm && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              color: 'var(--text-primary)',
              margin: 0,
              marginBottom: 'var(--space-lg)',
            }}
          >
            New Statutory Report
          </h2>
          {formError && (
            <p
              style={{
                color: 'var(--color-coral)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-md)',
              }}
            >
              {formError}
            </p>
          )}
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <Select
                label="Report Type *"
                options={[
                  { value: 'section_52', label: 'Section 52 (Quarterly)' },
                  { value: 'section_72', label: 'Section 72 (Mid-Year)' },
                  { value: 'section_46', label: 'Section 46 (Annual Performance)' },
                  { value: 'section_121', label: 'Section 121 (Annual Report)' },
                ]}
                value={form.report_type}
                onChange={(v) => setForm((prev) => ({ ...prev, report_type: v as StatutoryReport['report_type'] }))}
                required
              />
              <Input
                label="Financial Year *"
                value={form.financial_year}
                onChange={(e) => setForm((prev) => ({ ...prev, financial_year: e.target.value }))}
                placeholder="e.g., 2025/26"
                required
              />
            </div>
            {form.report_type === 'section_52' && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <Select
                  label="Quarter *"
                  options={[
                    { value: 'Q1', label: 'Q1 (July – September)' },
                    { value: 'Q2', label: 'Q2 (October – December)' },
                    { value: 'Q3', label: 'Q3 (January – March)' },
                    { value: 'Q4', label: 'Q4 (April – June)' },
                  ]}
                  value={form.quarter}
                  onChange={(v) => setForm((prev) => ({ ...prev, quarter: v }))}
                  required
                />
              </div>
            )}
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <Input
                label="Title *"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Auto-generated — edit if needed"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
              <Button type="submit" variant="primary" loading={submitting}>
                Create Report
              </Button>
              <Button type="button" variant="ghost" onClick={onCloseForm}>
                Cancel
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* ── Report List Section ───────────────────────────────────────────── */}
      <GlassCard style={{ marginBottom: 'var(--space-xl)', padding: 'var(--space-xl)' }}>
        {/* Header + Filters */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap' as const,
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-h4)',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Statutory Reports
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <Input
              label=""
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              placeholder="Financial Year (e.g. 2025/26)"
              style={{ width: '180px' }}
            />
            <Select
              label=""
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'section_52', label: 'Section 52' },
                { value: 'section_72', label: 'Section 72' },
                { value: 'section_46', label: 'Section 46' },
                { value: 'section_121', label: 'Section 121' },
              ]}
              value={filterType}
              onChange={setFilterType}
            />
            <Button size="sm" variant="secondary" onClick={fetchReports}>
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-3xl)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            Loading statutory reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-3xl)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>
              No statutory reports found
            </p>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Create your first report using the "Create Report" button above.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <thead>
                <tr>
                  {['Report', 'Financial Year', 'Status', 'Generated', 'Actions'].map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: 'var(--text-xs)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => {
                  const isExpanded = expandedReportId === report.id;
                  return (
                    <React.Fragment key={report.id}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                      >
                        {/* Report type + title */}
                        <td style={{ padding: '12px', maxWidth: '280px' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap' as const,
                            }}
                          >
                            {reportTypeHumanLabel(report.report_type, report.quarter)}
                          </div>
                          <div
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap' as const,
                              maxWidth: '260px',
                            }}
                          >
                            {report.title}
                          </div>
                        </td>

                        {/* Financial year */}
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}>
                          {report.financial_year}
                        </td>

                        {/* Status badge */}
                        <td style={{ padding: '12px' }}>
                          <span style={statusBadge(report.status)}>
                            {STATUS_LABELS[report.status] || report.status}
                          </span>
                        </td>

                        {/* Generated timestamp */}
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' as const }}>
                          {report.generated_at ? formatShortDate(report.generated_at) : 'Not generated'}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' as const, alignItems: 'center' }}>
                            {/* Generate button */}
                            {showGenerateButton(report) && (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={generatingId === report.id}
                                onClick={() => handleGenerate(report.id)}
                                style={{
                                  background: 'var(--color-coral, #f97316)',
                                  borderColor: 'var(--color-coral, #f97316)',
                                }}
                              >
                                {report.pdf_storage_path ? 'Regenerate' : 'Generate'}
                              </Button>
                            )}

                            {/* Transition button */}
                            {renderTransitionButton(report)}

                            {/* Download buttons */}
                            {report.pdf_storage_path && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(report.id, 'pdf')}
                              >
                                PDF
                              </Button>
                            )}
                            {report.docx_storage_path && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(report.id, 'docx')}
                              >
                                DOCX
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td
                            colSpan={5}
                            style={{
                              padding: '16px 20px',
                              background: 'rgba(255, 255, 255, 0.03)',
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', maxWidth: '600px' }}>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px' }}>Title</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{report.title}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px' }}>Period</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                  {formatDate(report.period_start)} &ndash; {formatDate(report.period_end)}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px' }}>Approved</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                  {report.approved_at ? formatDate(report.approved_at) : 'Not yet approved'}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: '4px' }}>Status Timeline</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                                  Created {formatShortDate(report.created_at)}
                                  {report.generated_at && <> &rarr; Generated {formatShortDate(report.generated_at)}</>}
                                  {report.approved_at && <> &rarr; Approved {formatShortDate(report.approved_at)}</>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ── Deadline Calendar Section ─────────────────────────────────────── */}
      <GlassCard style={{ padding: 'var(--space-xl)' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-h4)',
            color: 'var(--text-primary)',
            margin: 0,
            marginBottom: 'var(--space-lg)',
          }}
        >
          Statutory Deadline Calendar — {selectedFY}
        </h2>

        {sortedDeadlines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--space-2xl)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}
          >
            No deadlines found for {selectedFY}. Deadlines are auto-created when the system starts.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <thead>
                <tr>
                  {['Report', 'Deadline Date', 'Days Remaining', 'Urgency', 'Auto Task'].map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: 'var(--text-xs)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedDeadlines.map((deadline) => {
                  const days = daysUntil(deadline.deadline_date);
                  const urgency = urgencyColor(days);
                  return (
                    <tr
                      key={deadline.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      {/* Description */}
                      <td style={{ padding: '12px', maxWidth: '300px' }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {deadline.description}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {REPORT_TYPE_LABELS[deadline.report_type] || deadline.report_type}
                          {deadline.quarter ? ` — ${deadline.quarter}` : ''}
                        </div>
                      </td>

                      {/* Deadline date */}
                      <td style={{ padding: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' as const }}>
                        {formatDate(deadline.deadline_date)}
                      </td>

                      {/* Days remaining */}
                      <td style={{ padding: '12px', whiteSpace: 'nowrap' as const }}>
                        <span
                          style={{
                            color: urgency.dot,
                            fontWeight: 700,
                            fontSize: 'var(--text-base)',
                          }}
                        >
                          {days <= 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                        </span>
                      </td>

                      {/* Urgency indicator */}
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              background: urgency.dot,
                              display: 'inline-block',
                              flexShrink: 0,
                              animation: urgency.pulse ? 'pulse 1.5s infinite' : undefined,
                            }}
                          />
                          <span style={{ color: urgency.dot, fontWeight: 600, fontSize: 'var(--text-xs)' }}>
                            {urgency.label}
                          </span>
                          {days <= 0 && (
                            <span
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Auto task created */}
                      <td style={{ padding: '12px', textAlign: 'center' as const }}>
                        {deadline.task_created ? (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-label="Task created"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pulse animation */}
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
          }
        `}</style>
      </GlassCard>
    </div>
  );
}
