import React from 'react';

type MeetingPin = { latitude: number; longitude: number };

export default function NativeMap(_props: { readonly region: any; readonly pin: MeetingPin | null; readonly canEdit: boolean; readonly onPick: (lat: number, lon: number) => void; readonly setAnimateTo: (fn: ((lat: number, lon: number) => void) | null) => void }) {
  return <div style={{ display: 'none' }} />;
}
