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

## Quick start

Prerequisites

- Node.js LTS and npm
- Android Studio (for Android) and/or Xcode (for iOS)

Install dependencies

```powershell
npm install
```

Configure backend endpoints (optional now, required for real API calls)

- Edit `app/config.ts` and set the base URLs:
   - `API_BASE` (default: `http://localhost:5001`)
   - `AUTH_BASE` (default: `http://localhost:5002`)

Start the app

```powershell
npx expo start
```

Then choose a platform from the Expo dev tools (Android, iOS, or Web).

## Backend expectations

- Core API must run at `API_BASE` (default `:5001`)
- Auth API must run at `AUTH_BASE` (default `:5002`)

On emulators/devices, localhost rules apply:

- Android emulator: use `http://10.0.2.2:PORT`
- iOS simulator: `http://127.0.0.1:PORT`
- Physical devices: use your machine’s LAN IP and ensure the ports are reachable

Update `app/config.ts` accordingly when testing on different targets.

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

- 401 errors after login: confirm both services are running and base URLs are correct in `app/config.ts`.
- Refresh loop or sudden logout: your refresh token may be invalid/expired. The app proactively refreshes ~1 minute before access expiry and also on resume; on failure it logs you out and shows a toast. Log in again to continue.
- Android can’t reach localhost: use `10.0.2.2` instead of `localhost` in `app/config.ts`.
- CORS/network issues: check backend CORS and that device/emulator can reach the host/port.

## License

Private project. All rights reserved.
