import { useEffect, useState } from 'react';
import { getMunicipalities } from '../../services/publicApi';
import type { Municipality } from '../../types/public';

interface MunicipalitySelectorProps {
  selectedId: string | null;
  onChange: (id: string | null) => void;
}

export function MunicipalitySelector({ selectedId, onChange }: MunicipalitySelectorProps) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadMunicipalities() {
      setIsLoading(true);
      const data = await getMunicipalities();
      setMunicipalities(data);
      setIsLoading(false);
    }
    loadMunicipalities();
  }, []);

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
        color: '#374151'
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
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          backgroundColor: 'white',
          color: '#374151',
          cursor: 'pointer',
          minWidth: '250px',
        }}
      >
        <option value="">All Municipalities</option>
        {municipalities.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.code})
          </option>
        ))}
      </select>
      {isLoading && <span style={{ marginLeft: '12px', color: '#6b7280' }}>Loading...</span>}
    </div>
  );
}
