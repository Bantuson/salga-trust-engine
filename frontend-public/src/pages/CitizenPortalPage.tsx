/**
 * SALGA Trust Engine — Citizen Portal Page
 * Tabbed page combining "My Reports" and "Personal Details"
 *
 * CRITICAL:
 * - Requires Supabase authentication
 * - Fetches real data from GET /api/v1/citizen/my-reports and GET /api/v1/citizen/stats
 * - GBV privacy enforced server-side (limited fields only)
 * - Shows demo mode if no auth session (for UI testing)
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedGradientBg } from '@shared/components/AnimatedGradientBg';
import { Button } from '@shared/components/ui/Button';
import { PersonalStats } from '../components/citizen/PersonalStats';
import { MyReportsList } from '../components/citizen/MyReportsList';
import { PersonalDetails } from '../components/citizen/PersonalDetails';
import { useCitizenReports } from '../hooks/useCitizenReports';

export const CitizenPortalPage: React.FC = () => {
  const { reports, stats, isLoading, isDemoMode } = useCitizenReports();
  const [activeTab, setActiveTab] = useState<'reports' | 'details'>('reports');

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      paddingTop: '120px',
      paddingBottom: '80px',
    }}>
      {/* Background */}
      <AnimatedGradientBg />

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 var(--spacing-lg)',
      }}>
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div style={{
            padding: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
            background: 'rgba(251, 191, 36, 0.2)',
            border: '2px solid rgba(251, 191, 36, 0.5)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              color: '#FBBF24',
            }}>
              Demo Mode - Sign in to see your real reports
            </div>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: 'var(--spacing-xs) 0 0',
            }}>
              You are viewing sample data for demonstration purposes.
            </p>
          </div>
        )}

        {/* Header — tabs left, button right */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '48px',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <button
              onClick={() => setActiveTab('reports')}
              className="filter-tab"
              style={{
                padding: '8px 16px',
                background: activeTab === 'reports' ? 'rgba(0, 217, 166, 0.2)' : 'transparent',
                color: activeTab === 'reports' ? 'var(--color-teal)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-base)',
              }}
            >
              My Reports
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className="filter-tab"
              style={{
                padding: '8px 16px',
                background: activeTab === 'details' ? 'rgba(0, 217, 166, 0.2)' : 'transparent',
                color: activeTab === 'details' ? 'var(--color-teal)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-base)',
              }}
            >
              Personal Details
            </button>
          </div>

          <Link to="/report" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Report New Issue
            </Button>
          </Link>
        </div>

        {/* Tab Content */}
        {activeTab === 'reports' ? (
          <>
            {/* Personal Stats */}
            <PersonalStats stats={stats} loading={isLoading} />

            {/* Reports List */}
            <div style={{ marginTop: 'var(--spacing-xl)' }}>
              <MyReportsList reports={reports} loading={isLoading} />
            </div>
          </>
        ) : (
          <PersonalDetails />
        )}
      </div>
    </div>
  );
};
