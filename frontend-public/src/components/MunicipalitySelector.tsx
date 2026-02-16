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
          padding: '8px 12px',
          fontSize: '14px',
          border: '1px solid var(--glass-border)',
          borderRadius: '6px',
          backgroundColor: 'var(--glass-white-frost)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          minWidth: '250px',
          backdropFilter: 'blur(10px)',
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
