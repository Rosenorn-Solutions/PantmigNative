// Dynamic Expo config replacing static app.json. Reads env for secrets.
// Ensure you set GOOGLE_MAPS_API_KEY in your shell (or .env loaded via tools like dotenv-cli) before build.

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  name: 'PantmigNative',
  slug: 'pantmig-native',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.nightfrost.pantmignative',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    // Google Maps API key injected at build time (react-native-maps auto uses manifest entry via config plugin if added)
    config: GOOGLE_MAPS_API_KEY ? { googleMaps: { apiKey: GOOGLE_MAPS_API_KEY } } : {},
  },
  web: {
    favicon: './assets/images/favicon.png'
  },
  experiments: {
    typedRoutes: true
  },
  extra: {
    GOOGLE_MAPS_API_KEY,
    eas: {
      projectId: 'placeholder-project-id'
    }
  },
};
