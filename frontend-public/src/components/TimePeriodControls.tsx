import { getSAFinancialYear, getCurrentSAQuarter } from '../utils/saFinancialYear';
import { CustomSelect } from './CustomSelect';

interface TimePeriodControlsProps {
  financialYear: string;
  quarter: 1 | 2 | 3 | 4;
  onYearChange: (year: string) => void;
  onQuarterChange: (quarter: 1 | 2 | 3 | 4) => void;
}

const quarterOptions = [
  { value: '1', label: 'Q1 (Apr-Jun)' },
  { value: '2', label: 'Q2 (Jul-Sep)' },
  { value: '3', label: 'Q3 (Oct-Dec)' },
  { value: '4', label: 'Q4 (Jan-Mar)' },
];

/**
 * Financial year + quarter selector for the public dashboard.
 * Shows 2 options for financial year (current and previous) and 4 quarters.
 * Uses the SA financial year convention: April–March.
 */
export function TimePeriodControls({
  financialYear,
  quarter,
  onYearChange,
  onQuarterChange,
}: TimePeriodControlsProps) {
  // Compute available financial years: current FY and previous FY
  const now = new Date();
  const currentFY = getSAFinancialYear(now);
  const currentFYStartYear = parseInt(currentFY.split('/')[0], 10);
  const previousFYStartYear = currentFYStartYear - 1;
  const previousFY = `${previousFYStartYear}/${String(previousFYStartYear + 1).slice(-2)}`;

  const yearOptions = [
    { value: currentFY, label: `FY ${currentFY}` },
    { value: previousFY, label: `FY ${previousFY}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Reporting Period
      </span>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Financial Year</span>
          <CustomSelect
            options={yearOptions}
            value={financialYear}
            onChange={onYearChange}
            placeholder="Select year"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quarter</span>
          <CustomSelect
            options={quarterOptions}
            value={String(quarter)}
            onChange={(value) => onQuarterChange(parseInt(value, 10) as 1 | 2 | 3 | 4)}
            placeholder="Select quarter"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Returns the default financial year and quarter for the current date.
 * Useful for initializing TimePeriodControls state.
 */
export function getDefaultTimePeriod(): { financialYear: string; quarter: 1 | 2 | 3 | 4 } {
  const now = new Date();
  return {
    financialYear: getSAFinancialYear(now),
    quarter: getCurrentSAQuarter(now),
  };
}
