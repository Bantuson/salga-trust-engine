declare module 'react-leaflet-heatmap-layer-v3' {
  import { LayerProps } from 'react-leaflet';

  export interface HeatmapLayerProps<T = any> extends LayerProps {
    points: T[];
    longitudeExtractor: (point: T) => number;
    latitudeExtractor: (point: T) => number;
    intensityExtractor: (point: T) => number;
    radius?: number;
    blur?: number;
    max?: number;
    gradient?: Record<number, string>;
  }

  export function HeatmapLayer<T = any>(props: HeatmapLayerProps<T>): JSX.Element;
}
