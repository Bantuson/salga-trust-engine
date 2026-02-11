/**
 * GeolocationCapture component for GPS location or manual address input.
 *
 * Uses useGeolocation hook to request GPS coordinates with high accuracy.
 * Falls back to manual address input if GPS unavailable or permission denied.
 */

import React, { useState, useEffect } from 'react';
import { useGeolocation } from '../hooks/useGeolocation';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: string;
}

interface GeolocationCaptureProps {
  onLocationCaptured?: (location: LocationData) => void;
  onAddressEntered?: (address: string) => void;
}

export function GeolocationCapture({
  onLocationCaptured,
  onAddressEntered,
}: GeolocationCaptureProps) {
  const { coordinates, error, loading } = useGeolocation();
  const [manualAddress, setManualAddress] = useState('');

  // Notify parent when GPS coordinates are captured
  useEffect(() => {
    if (coordinates && onLocationCaptured) {
      onLocationCaptured({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy,
        source: 'gps',
      });
    }
  }, [coordinates, onLocationCaptured]);

  // Notify parent when manual address is entered
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value;
    setManualAddress(address);

    if (onAddressEntered) {
      onAddressEntered(address);
    }
  };

  return (
    <div>
      <h3>Location</h3>

      {/* Loading state */}
      {loading && (
        <div>
          <p>Requesting location access...</p>
        </div>
      )}

      {/* Success: GPS coordinates captured */}
      {coordinates && !loading && (
        <div style={{ padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
          <p style={{ margin: 0 }}>
            Location captured (accuracy: {Math.round(coordinates.accuracy)}m)
          </p>
          <small>
            Lat: {coordinates.latitude.toFixed(6)}, Lng: {coordinates.longitude.toFixed(6)}
          </small>
        </div>
      )}

      {/* Error: GPS unavailable, show manual address input */}
      {error && !loading && (
        <div>
          <div style={{ padding: '8px', backgroundColor: '#fff3e0', borderRadius: '4px', marginBottom: '8px' }}>
            <p style={{ margin: 0, color: '#f57c00' }}>{error}</p>
          </div>

          <div>
            <label htmlFor="manual-address" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
              Manual Address (required):
            </label>
            <input
              id="manual-address"
              type="text"
              value={manualAddress}
              onChange={handleAddressChange}
              placeholder="Enter street address, suburb, city"
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
