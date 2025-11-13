// Web shadow for react-native-maps so Metro doesn't traverse native internals on web.
// The app uses Leaflet-based implementation in platform-specific screens; this is a safety shim.
import * as React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

export interface MapViewProps extends ViewProps {
  initialRegion?: any;
  region?: any;
  provider?: any;
}

const MapView: React.FC<MapViewProps> = ({ style, children, ...rest }) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[react-native-maps.web] MapView rendered on web shadow – ensure web screen uses Leaflet variant.');
  }
  const flat = StyleSheet.flatten(style) as any || {};
  const needsMinHeight = flat?.height == null && flat?.flex == null && flat?.minHeight == null;
  const base = {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    overflow: 'hidden' as const,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  };
  const dynamicSize = needsMinHeight ? { minHeight: 240, width: '100%' as const } : null;
  return React.createElement(View as any, { ...(rest as any), style: [base, dynamicSize, style] }, children as any);
};

export const Marker: React.FC<{ coordinate?: any } & ViewProps> = () => null;
export const PROVIDER_GOOGLE = 'google';

export default MapView;
