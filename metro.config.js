const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/**
 * Metro configuration (custom resolver hook)
 * -------------------------------------------------------------
 * Why override resolveRequest for react-native-maps on web?
 * The project uses react-native-maps only for native platforms. The web
 * variant of the meeting point screen is implemented with Leaflet, so web
 * never needs the native module. However, Metro / expo-router still attempts
 * to crawl the dependency graph deeply enough that it reaches
 * react-native-maps internal files (e.g. MapMarkerNativeComponent.js) which
 * reference native-only modules like 'react-native/Libraries/Utilities/codegenNativeCommands'.
 * That causes the web bundle to fail.
 *
 * This resolver intercepts requests for 'react-native-maps' when platform === 'web'
 * and returns a lightweight stub that preserves the component shape. This keeps the
 * bundler happy without affecting native behavior.
 *
 * If in the future you migrate to a map library that ships a safe web build (or
 * you remove the native map entirely), you can delete this block along with:
 *   - stubs/react-native-maps-web.js
 *
 * Validation: Removing this resolver reintroduces the error:
 *   "Importing native-only module codegenNativeCommands on web from react-native-maps"
 * so keep it unless you have replaced the dependency with a cross-platform alternative.
 */

module.exports = (async () => {
  const config = await getDefaultConfig(__dirname);

  const stubPath = path.join(__dirname, 'stubs', 'react-native-maps-web.js');
  config.resolver = config.resolver || {};
  const previousResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-maps') {
      return { type: 'sourceFile', filePath: stubPath };
    }
    if (previousResolveRequest) {
      return previousResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };

  return config;
})();
