/**
 * Custom hook for HTML5 Geolocation API.
 *
 * Requests user's current GPS coordinates with high accuracy.
 * Returns coordinates, error state, and loading state.
 */

import { useState, useEffect } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeolocationState {
  coordinates: Coordinates | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setState({
        coordinates: null,
        error: 'Geolocation not supported by your browser. Please enter address manually.',
        loading: false,
      });
      return;
    }

    // Request current position with high accuracy
    navigator.geolocation.getCurrentPosition(
      // Success callback
      (position) => {
        setState({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
          error: null,
          loading: false,
        });
      },
      // Error callback
      (error) => {
        let errorMessage: string;

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enter address manually.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Please enter address manually.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please enter address manually.';
            break;
          default:
            errorMessage = 'Unknown geolocation error. Please enter address manually.';
        }

        setState({
          coordinates: null,
          error: errorMessage,
          loading: false,
        });
      },
      // Options
      {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds
        maximumAge: 0,
      }
    );
  }, []);

  return state;
}
