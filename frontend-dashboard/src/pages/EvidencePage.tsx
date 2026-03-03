/**
 * Evidence Documents Page — upload and view portfolio of evidence.
 *
 * Shows evidence documents for a quarterly actual. Supports file upload
 * (drag-and-drop or file picker) and lists uploaded documents with scan status.
 *
 * Routes: /pms/actuals/:actualId/evidence
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '@shared/components/ui/GlassCard';
import { Button } from '@shared/components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { DEMO_MODE } from '../lib/demoMode';

interface EvidenceDocument {
  id: string;
  filename: string;
  content_type: string;
  file_size: number;
  scan_status: string;
  uploaded_by?: string;
  created_at: string;
}

interface ActualInfo {
  id: string;
  quarter: string;
  financial_year: string;
  actual_value: string;
}

const SCAN_STATUS_COLORS: Record<string, string> = {
  pending: 'var(--color-gold)',
  clean: 'var(--color-teal)',
  infected: 'var(--color-coral)',
  error: 'var(--color-coral)',
};

const SCAN_STATUS_LABELS: Record<string, string> = {
  pending: 'Scanning...',
  clean: 'Clean',
  infected: 'Infected — Quarantined',
  error: 'Scan Error',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -- Demo data for VITE_DEMO_MODE --
const DEMO_ACTUAL: ActualInfo = {
  id: 'demo-actual-1',
  quarter: 'Q1',
  financial_year: '2025/26',
  actual_value: '3.2',
};

const DEMO_DOCUMENTS: EvidenceDocument[] = [
  {
    id: 'demo-doc-1',
    filename: 'Q1_2025_Water_Loss_Audit_Report.pdf',
    content_type: 'application/pdf',
    file_size: 2457600,
    scan_status: 'clean',
    uploaded_by: 'demo-user',
    created_at: '2025-10-20T14:30:00Z',
  },
  {
    id: 'demo-doc-2',
    filename: 'Photo_Evidence_BSD001_Meter_Reading.jpg',
    content_type: 'image/jpeg',
    file_size: 845000,
    scan_status: 'clean',
    uploaded_by: 'demo-user',
    created_at: '2025-10-21T09:15:00Z',
  },
];

export function EvidencePage() {
  const { actualId } = useParams<{ actualId: string }>();
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [actual, setActual] = useState<ActualInfo | null>(null);
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!actualId) return;
    if (DEMO_MODE) {
      setActual(DEMO_ACTUAL);
      setDocuments(DEMO_DOCUMENTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [actualRes, docsRes] = await Promise.all([
        fetch(`/api/v1/sdbip/actuals/${actualId}`, { headers }),
        fetch(`/api/v1/sdbip/actuals/${actualId}/evidence`, { headers }),
      ]);

      if (!actualRes.ok) throw new Error(`Actual not found (${actualRes.status})`);
      if (!docsRes.ok) throw new Error(`Failed to load evidence (${docsRes.status})`);

      const actualData = await actualRes.json();
      const docsData = await docsRes.json();

      setActual(actualData);
      setDocuments(docsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evidence');
    } finally {
      setLoading(false);
    }
  }, [actualId, getAccessToken]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleUpload = async (file: File) => {
    if (DEMO_MODE) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const token = getAccessToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/v1/sdbip/actuals/${actualId}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Upload failed (${res.status})`);
      }
      setUploadSuccess(true);
      await fetchAll();
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDownload = async (docId: string, filename: string) => {
    if (DEMO_MODE) return;
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/v1/sdbip/evidence/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const pageStyles: React.CSSProperties = {
    padding: 'var(--space-xl)',
    maxWidth: '800px',
  };

  const dropZoneStyles: React.CSSProperties = {
    border: `2px dashed ${dragOver ? 'var(--color-teal)' : 'rgba(255,255,255,0.2)'}`,
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-3xl)',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    background: dragOver ? 'rgba(0, 191, 165, 0.05)' : 'transparent',
    marginBottom: 'var(--space-xl)',
  };

  const errorStyles: React.CSSProperties = {
    color: 'var(--color-coral)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-sm)',
    marginBottom: 'var(--space-md)',
  };

  const emptyStyles: React.CSSProperties = {
    textAlign: 'center',
    padding: 'var(--space-3xl)',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-body)',
  };

  const scanBadgeStyles = (status: string): React.CSSProperties => {
    const color = SCAN_STATUS_COLORS[status] || 'var(--text-secondary)';
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color,
      background: `${color}22`,
      border: `1px solid ${color}66`,
    };
  };

  if (loading) {
    return <div style={{ ...pageStyles, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Loading evidence documents...</div>;
  }

  if (error && !actual) {
    return (
      <div style={{ ...pageStyles, fontFamily: 'var(--font-body)' }}>
        <p style={{ color: 'var(--color-coral)' }}>{error}</p>
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div style={pageStyles}>
      {/* Breadcrumb */}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--color-teal)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}>
          Back to Actuals
        </button>
        {' / Evidence'}
      </div>

      {/* Actual Info */}
      {actual && (
        <GlassCard style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
            Portfolio of Evidence
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            {actual.quarter} / {actual.financial_year} — Actual Value: <strong style={{ color: 'var(--text-primary)' }}>{parseFloat(actual.actual_value).toLocaleString()}</strong>
          </p>
        </GlassCard>
      )}

      {/* Upload Zone */}
      <div
        style={dropZoneStyles}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        />
        {uploading ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-teal)', margin: 0 }}>
            Uploading and scanning...
          </p>
        ) : uploadSuccess ? (
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-teal)', margin: 0 }}>
            File uploaded successfully.
          </p>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)' }}>
              Drop a file here or click to upload
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              PDF, Word, Excel, or images. All files are virus-scanned.
            </p>
          </>
        )}
      </div>

      {uploadError && <p style={errorStyles}>{uploadError}</p>}
      {error && <p style={errorStyles}>{error}</p>}

      {/* Documents List */}
      {documents.length === 0 ? (
        <div style={emptyStyles}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-sm)' }}>No evidence documents yet</p>
          <p style={{ fontSize: 'var(--text-sm)' }}>Upload supporting documents to build your portfolio of evidence.</p>
        </div>
      ) : (
        <GlassCard>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-base)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-lg)' }}>
            Uploaded Documents ({documents.length})
          </h2>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md) 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 'var(--space-md)', flexWrap: 'wrap' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.filename}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {formatFileSize(doc.file_size)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {doc.content_type}
                  </span>
                  <span style={scanBadgeStyles(doc.scan_status)}>
                    {SCAN_STATUS_LABELS[doc.scan_status] || doc.scan_status}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {new Date(doc.created_at).toLocaleDateString('en-ZA')}
                  </span>
                </div>
              </div>
              {doc.scan_status === 'clean' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(doc.id, doc.filename)}
                >
                  Download
                </Button>
              )}
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
