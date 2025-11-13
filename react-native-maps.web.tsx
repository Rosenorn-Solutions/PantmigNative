// Web shadow for react-native-maps so Metro doesn't traverse native internals on web.
// The app uses Leaflet-based implementation in platform-specific screens; this is a safety shim.
import * as React from 'react';
import { View, ViewProps } from 'react-native';

export type MapViewProps = ViewProps & Record<string, any>;

const MapView: React.FC<MapViewProps> = ({ style, children }) => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[react-native-maps.web] MapView rendered on web shadow – ensure web screen uses Leaflet variant.');
  }
  return (
    <View style={[{ backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' }, style]}>
      {children}
    </View>
  );
};

export const Marker: React.FC<{ coordinate?: any } & ViewProps> = () => null;
export const PROVIDER_GOOGLE = 'google';

export default MapView;
