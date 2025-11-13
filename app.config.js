// Dynamic Expo config replacing static app.json. Reads env for secrets.
// Ensure you set GOOGLE_MAPS_API_KEY in your shell (or .env loaded via tools like dotenv-cli) before build.

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  name: 'PantmigNative',
  slug: 'pantmig-native',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'pantmignative',
  newArchEnabled: false,
  icon: './assets/images/logo-light.png', // square 524x524
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
    package: 'com.rosenornsolutions.pantmignative', // Final locked applicationId for Play Store
    versionCode: 2, // Aligned with previous static app.json
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/images/logo-light.png', // square
      backgroundColor: '#ffffff'
    },
    // Google Maps API key injected at build time (react-native-maps auto uses manifest entry via config plugin if added)
    config: GOOGLE_MAPS_API_KEY ? { googleMaps: { apiKey: GOOGLE_MAPS_API_KEY } } : {},
  },
  web: {
    favicon: './assets/images/logo-light.png'
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true
  },
  extra: {
    GOOGLE_MAPS_API_KEY,
    eas: { projectId: 'ed4b69d8-6c4e-4401-933e-8a87a8b10bbf' }, // Injected from npx eas init
  },
};
