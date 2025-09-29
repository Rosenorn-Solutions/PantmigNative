// Web stub for react-native-maps. The web version of the meeting point screen uses Leaflet instead.
// Export a minimal component shape so accidental imports don't crash.
const React = require('react');

function StubMap(props) {
  return React.createElement('div', { style: Object.assign({ backgroundColor: '#f0f0f0', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center' }, props.style) }, 'react-native-maps stub (web)');
}

module.exports = Object.assign(StubMap, {
  __esModule: true,
  default: StubMap,
  Marker: (p) => React.createElement('div', { style: Object.assign({ width: 12, height: 12, borderRadius: 6, backgroundColor: 'red' }, p?.style) }),
  PROVIDER_GOOGLE: 'google'
});
