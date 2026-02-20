import { useMunicipalities } from '../hooks/usePublicStats';
import { CustomSelect } from './CustomSelect';

interface MunicipalitySelectorProps {
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function MunicipalitySelector({ selectedId, onChange }: MunicipalitySelectorProps) {
  const { municipalities, isLoading } = useMunicipalities();

  const options = municipalities.map((m) => ({
    value: m.id,
    label: `${m.name} (${m.code})`,
  }));

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
      <CustomSelect
        options={options}
        value={selectedId || ''}
        onChange={(val) => onChange(val === '' ? null : val)}
        placeholder="All Municipalities"
        disabled={isLoading}
      />
      {isLoading && <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>Loading...</span>}
    </div>
  );
}
