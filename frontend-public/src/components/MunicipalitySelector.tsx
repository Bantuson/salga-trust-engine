import { useMunicipalities } from '../hooks/usePublicStats';

interface MunicipalitySelectorProps {
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function MunicipalitySelector({ selectedId, onChange }: MunicipalitySelectorProps) {
  const { municipalities, isLoading } = useMunicipalities();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onChange(value === '' ? null : value);
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <label htmlFor="municipality-select" style={{
        display: 'block',
        marginBottom: '8px',
        fontWeight: '500',
        color: 'var(--text-primary)'
      }}>
        Filter by Municipality:
      </label>
      <select
        id="municipality-select"
        value={selectedId || ''}
        onChange={handleChange}
        disabled={isLoading}
        style={{
          padding: '10px 2.5rem 10px 16px',
          fontSize: '0.875rem',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          minWidth: '250px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          appearance: 'none' as React.CSSProperties['appearance'],
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23ffd54f' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        <option value="">All Municipalities</option>
        {municipalities.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.code})
          </option>
        ))}
      </select>
      {isLoading && <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>Loading...</span>}
    </div>
  );
}
