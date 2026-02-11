/**
 * SALGA Trust Engine — Citizen Portal Page
 * Authenticated page for citizens to view their reports and personal analytics
 *
 * CRITICAL:
 * - Requires Supabase authentication
 * - Fetches real data from GET /api/v1/citizen/my-reports and GET /api/v1/citizen/stats
 * - GBV privacy enforced server-side (limited fields only)
 * - Shows demo mode if no auth session (for UI testing)
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AnimatedGradientBg } from '@shared/components/AnimatedGradientBg';
import { NdebelePattern } from '@shared/components/NdebelePattern';
import { Button } from '@shared/components/ui/Button';
import { PersonalStats } from '../components/citizen/PersonalStats';
import { MyReportsList } from '../components/citizen/MyReportsList';
import { useCitizenReports } from '../hooks/useCitizenReports';

export const CitizenPortalPage: React.FC = () => {
  const { reports, stats, isLoading, error, isDemoMode, refetch } = useCitizenReports();

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      paddingTop: '80px',
      paddingBottom: '80px',
    }}>
      {/* Background */}
      <AnimatedGradientBg />
      <NdebelePattern opacity={0.05} />

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

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-xl)',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)',
        }}>
          <h1 style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            fontFamily: 'var(--font-display)',
          }}>
            My Reports
          </h1>
          <Link to="/report" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="md">
              <svg
                width="20"
                height="20"
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

        {/* Error State */}
        {error && !isDemoMode && (
          <div style={{
            padding: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-lg)',
            background: 'rgba(255, 107, 74, 0.1)',
            border: '2px solid rgba(255, 107, 74, 0.3)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-coral)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: '0 auto var(--spacing-md)' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--color-coral)',
              margin: '0 0 var(--spacing-sm)',
            }}>
              Could not load reports
            </h3>
            <p style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: '0 0 var(--spacing-md)',
            }}>
              {error}
            </p>
            <Button variant="secondary" size="md" onClick={refetch}>
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
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Retry
            </Button>
          </div>
        )}

        {/* Personal Stats */}
        {!error && (
          <PersonalStats stats={stats} loading={isLoading} />
        )}

        {/* Reports List */}
        <div style={{ marginTop: 'var(--spacing-xl)' }}>
          <h2 style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)',
          }}>
            Your Reports
          </h2>
          <MyReportsList reports={reports} loading={isLoading} />
        </div>
      </div>
    </div>
  );
};
