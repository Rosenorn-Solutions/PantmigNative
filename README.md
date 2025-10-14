## Pantmig Native (Expo)

Mobile app built with Expo Router for the Pantmig platform. Users can register, log in, browse active recycle listings, and donors can create new listings. The app uses generated OpenAPI clients for both the core API and the auth service.

### Key features

- Authentication (login/register) with token storage in AsyncStorage
- Automatic token refresh via middleware and transparent retry
- Proactive token refresh before expiry and on app resume
- Role-aware UI: Donator can create listings; Recycler can browse
- Screens: Home, Login, Register, Listings, Create Listing
- Toast notifications for success/errors
- Expo Router with typed routes and simple, clean UI

## Backend endpoints

Public production endpoints are now live:

- Core API: https://api.pantmig.dk
- Auth API: https://auth.pantmig.dk

You usually do NOT need to edit config for production usage. For local development you can still override via environment variables or by editing `app/config.ts`.

Override order (highest to lowest):
1. `EXPO_PUBLIC_API_BASE` / `EXPO_PUBLIC_AUTH_BASE`
2. Host/port reconstruction using `EXPO_PUBLIC_HOST` (+ optional protocol & ports)
3. Built-in production domains (default)
4. Legacy localhost fallbacks inside `services/api.ts`

> Note: Automatic Android emulator substitution to `10.0.2.2` has been removed. To use a local backend now you must explicitly set `EXPO_PUBLIC_HOST` (e.g. `localhost` or your LAN IP) or supply full bases (`EXPO_PUBLIC_API_BASE`). This prevents unintentionally hitting a non-production host on Android when no overrides are intended.

## Quick start

Prerequisites

- Node.js LTS and npm
- Android Studio (for Android) and/or Xcode (for iOS)

Install dependencies

```powershell
npm install
```

Optional local backend config

If you run services locally instead of using production:

```powershell
# Example (PowerShell) - start with local core on 5001 & auth on 5002
$env:EXPO_PUBLIC_HOST = "localhost"
$env:EXPO_PUBLIC_API_PORT = "5001"
$env:EXPO_PUBLIC_AUTH_PORT = "5002"
# (Optionally) protocol override
$env:EXPO_PUBLIC_PROTOCOL = "http"
```

Or provide full bases:

```powershell
$env:EXPO_PUBLIC_API_BASE = "http://localhost:5001"
$env:EXPO_PUBLIC_AUTH_BASE = "http://localhost:5002"
```

Start the app

```powershell
npx expo start
```

Then choose a platform from the Expo dev tools (Android, iOS, or Web).

## Backend expectations (local dev)

- Core API must run at your chosen `API_BASE`
- Auth API must run at your chosen `AUTH_BASE`

On emulators/devices, localhost rules apply:

- Android emulator: use `http://10.0.2.2:PORT`
- iOS simulator: `http://127.0.0.1:PORT`
- Physical devices: use your machine’s LAN IP and ensure the ports are reachable

Update env vars or `app/config.ts` accordingly when testing on different targets.

## API clients (OpenAPI)

This project uses generated TypeScript Fetch clients for both services:

- Core API: `app/apis/pantmig-api`
- Auth API: `app/apis/pantmig-auth`

Available scripts

```powershell
# Generate clients from running backends (Swagger at /swagger/v1/swagger.json)
npm run generate-api
npm run generate-auth
```

Note: If the OpenAPI generator CLI isn’t installed, add it as a dev dependency first:

```powershell
npm i -D @openapitools/openapi-generator-cli
```

## Code pointers

- Routing/layout: `app/_layout.tsx`
- Auth context and token handling: `app/AuthContext.tsx`, `app/services/api.ts`
- Screens: `app/index.tsx`, `app/login.tsx`, `app/register.tsx`, `app/listings.tsx`, `app/create-listing.tsx`
- Toast system: `app/Toast.tsx`
- Config: `app/config.ts`

## Troubleshooting

- 401 errors after login: confirm both services are reachable (local or production). If local, verify env vars and that swagger endpoints respond.
- Refresh loop or sudden logout: refresh token may be invalid/expired. Log in again.
- Android can’t reach localhost: use `10.0.2.2` instead of `localhost`.
- CORS/network issues: check backend CORS and that device/emulator can reach the host/port (or that production domains are not blocked/firewalled on your network).

### Web bundling error with react-native-maps

If you ever see during a web build:

```
Error: Importing native-only module "react-native/Libraries/Utilities/codegenNativeCommands" on web from: .../node_modules/react-native-maps/lib/MapMarkerNativeComponent.js
```

That means the native internals of `react-native-maps` were traversed on web. The app intentionally uses **Leaflet on web** (see the `meeting-point/[listingId].web.tsx` screen) and should never load `react-native-maps` there.

To prevent this, `metro.config.js` contains a resolver override that, on web only, redirects the module name `react-native-maps` to a lightweight stub in `stubs/react-native-maps-web.js`. This keeps Metro from walking into native-only files.

You can safely remove that override (and the stub) only if:

1. You adopt a map library that provides a proper web build, or
2. You stop using `react-native-maps` entirely.

If you remove it prematurely, the error above will return and block the web bundle.

Quick reference:
- Resolver location: `metro.config.js` (search for `react-native-maps` comment block)
- Stub file: `stubs/react-native-maps-web.js`
- Native screen using the real map: `app/meeting-point/[listingId].native.tsx`
- Web screen using Leaflet: `app/meeting-point/[listingId].web.tsx`

This approach avoids forking the library and keeps the platform split explicit.

## License

Private project. All rights reserved.

## Recent API & Client Updates (Oct 2025)

### Registration Additions
The backend now requires `gender` and `birthDate` on registration:

| Field | Type | Notes |
|-------|------|-------|
| gender | int enum | 0 = Unknown / "Ønsker ikke at oplyse", 1 = Male, 2 = Female |
| birthDate | date (YYYY-MM-DD) | User must be at least 13 years old |

Auth responses (login + refresh) include these fields; `AuthContext` stores them (birthDate as date-only string) so app state stays in sync.

### Listing Creation Images
`POST /listings` now accepts JSON or `multipart/form-data` with optional `images`.

Client behavior:
1. If no images chosen → send JSON body using generated `listingsCreate({ createRecycleListingRequest })`.
2. If images chosen → build `FormData` with same fields + each image under key `images` (manual fetch until a generator multipart path is emitted).

### Future Enhancements Suggested
- Provide structured validation error payloads to surface per-field errors in UI.
- Add config endpoint for max images / size to adapt UI hints.
- Add structured `items` editing UI (model already exposes `items`).

