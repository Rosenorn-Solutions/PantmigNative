import React from 'react';

type Props = any;

function MapView(props: Props) {
  return React.createElement('div', { style: props?.style }, props?.children);
}

function Marker(_props: Props) {
  return null;
}

// Mirror common API surface minimally
MapView.Marker = Marker as any;

export { Marker };
export default MapView as any;
