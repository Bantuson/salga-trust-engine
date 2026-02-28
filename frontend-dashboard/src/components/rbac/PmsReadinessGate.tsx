/**
 * PmsReadinessGate — checklist overlay shown when PMS is not configured.
 *
 * Displayed when the backend returns a 403 PMS_NOT_READY response, or when
 * proactively fetching the readiness status from GET /departments/pms-readiness.
 *
 * Shows a visual checklist with green/red indicators for each condition and
 * a "Configure Now" button that navigates to the PMS setup wizard.
 *
 * Usage:
 *   <PmsReadinessGate checklist={readinessData} onConfigureClick={() => navigate('/pms-setup')} />
 */

/** Matches PmsReadinessStatus from src/services/pms_readiness.py */
export interface PmsChecklist {
  is_ready: boolean;
  municipality_configured: boolean;
  all_departments_have_directors: boolean;
  pms_officer_assigned: boolean;
  department_count: number;
  departments_with_directors: number;
  missing_directors: string[];
}

interface PmsReadinessGateProps {
  /** Readiness checklist from the backend. */
  checklist: PmsChecklist;
  /** Called when the admin clicks "Configure Now" — navigate to /pms-setup. */
  onConfigureClick: () => void;
}

/**
 * PmsReadinessGate renders a centered card with a three-item checklist.
 *
 * Each item shows a green checkmark or red cross:
 * - Municipality settings configured (settings_locked=True)
 * - All departments have directors (N/M assigned)
 * - PMS officer assigned
 *
 * If any departments are missing directors, their names are listed in an
 * amber warning box below the checklist.
 */
export function PmsReadinessGate({ checklist, onConfigureClick }: PmsReadinessGateProps) {
  const items = [
    {
      label: 'Municipality settings configured',
      done: checklist.municipality_configured,
    },
    {
      label: `All departments have directors (${checklist.departments_with_directors}/${checklist.department_count})`,
      done: checklist.all_departments_have_directors,
    },
    {
      label: 'PMS officer assigned',
      done: checklist.pms_officer_assigned,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border border-gray-100">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            PMS Setup Required
          </h2>
          <p className="text-gray-500 text-sm">
            Complete the following steps to enable Performance Management System features.
          </p>
        </div>

        {/* Checklist */}
        <ul className="space-y-3 mb-6">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              {/* Status indicator */}
              <span
                className={`
                  flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
                  text-xs font-bold
                  ${item.done
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                  }
                `}
                aria-hidden="true"
              >
                {item.done ? '\u2713' : '\u2717'}
              </span>

              {/* Label */}
              <span
                className={`text-sm ${
                  item.done
                    ? 'text-gray-400 line-through'
                    : 'text-gray-800 font-medium'
                }`}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Missing directors warning */}
        {checklist.missing_directors.length > 0 && (
          <div className="mb-6 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-800 font-semibold mb-1">
              Departments missing directors:
            </p>
            <ul className="text-sm text-amber-700 space-y-0.5">
              {checklist.missing_directors.map((deptName) => (
                <li key={deptName} className="flex items-center gap-1">
                  <span aria-hidden="true">-</span>
                  <span>{deptName}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onConfigureClick}
          className="w-full py-2.5 px-4 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors font-medium text-sm"
        >
          Configure Now
        </button>
      </div>
    </div>
  );
}
