import React, { useEffect, useRef } from 'react';

type MeetingPin = { latitude: number; longitude: number };

export default function NativeMap({ region, pin, canEdit, onPick, setAnimateTo }: { readonly region: any; readonly pin: MeetingPin | null; readonly canEdit: boolean; readonly onPick: (lat: number, lon: number) => void; readonly setAnimateTo: (fn: ((lat: number, lon: number) => void) | null) => void }) {
  // Avoid static string require to keep Metro web from resolving this
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const moduleName = 'react-native-maps';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Maps = require(moduleName);
  const MapComponent = Maps.default ?? Maps;
  const MarkerComponent = Maps.Marker;
  const mapRef = useRef<any>(null);
  useEffect(() => {
    setAnimateTo(() => (lat: number, lon: number) => {
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    });
    return () => setAnimateTo(null);
  }, [setAnimateTo]);
  return (
    <MapComponent
      style={{ flex: 1 }}
      initialRegion={region}
      ref={mapRef}
      onPress={canEdit ? (e: any) => {
        const { coordinate } = e?.nativeEvent || {};
        if (!coordinate) return;
        onPick(coordinate.latitude, coordinate.longitude);
      } : undefined}
      pitchEnabled
      rotateEnabled={false}
    >
      {pin && MarkerComponent ? (
        <MarkerComponent
          coordinate={pin}
          draggable={canEdit}
          onDragEnd={(e: any) => {
            const { coordinate } = e?.nativeEvent || {};
            if (!coordinate) return;
            onPick(coordinate.latitude, coordinate.longitude);
          }}
        />
      ) : null}
    </MapComponent>
  );
}
