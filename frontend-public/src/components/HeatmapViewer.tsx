import { MapContainer, TileLayer } from 'react-leaflet';
import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';
import { useHeatmapData } from '../hooks/usePublicStats';
import type { HeatmapPoint } from '../types/public';

interface HeatmapViewerProps {
  municipalityId?: string;
}

export function HeatmapViewer({ municipalityId }: HeatmapViewerProps) {
  const { data: points, isLoading } = useHeatmapData(municipalityId);

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: 'white',
      position: 'relative'
    }}>
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#111827'
      }}>
        Geographic Distribution of Reports
      </h3>

      <div style={{ height: '500px', position: 'relative', borderRadius: '6px', overflow: 'hidden' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            color: '#6b7280'
          }}>
            Loading heatmap data...
          </div>
        )}

        {!isLoading && points.length === 0 && (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px'
          }}>
            No heatmap data available
          </div>
        )}

        {!isLoading && points.length > 0 && (
          <MapContainer
            center={[-29.0, 24.0]}
            zoom={6}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatmapLayer
              points={points}
              longitudeExtractor={(p: HeatmapPoint) => p.lng}
              latitudeExtractor={(p: HeatmapPoint) => p.lat}
              intensityExtractor={(p: HeatmapPoint) => p.intensity}
              radius={25}
              blur={15}
              max={10}
              gradient={{
                0.0: 'blue',
                0.5: 'lime',
                0.7: 'yellow',
                1.0: 'red'
              }}
            />
          </MapContainer>
        )}
      </div>

      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Heatmap shows aggregated report density (k-anonymity ≥3). Individual addresses are not displayed to protect privacy.
      </div>
    </div>
  );
}
