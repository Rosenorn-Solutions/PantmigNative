# Copilot Instructions: Pantmig Native (Expo)

Concise, project-specific guidance for AI coding agents contributing to this repository. Focus on THESE patterns; avoid generic boilerplate.

## 1. Architecture & Data Flow
- Expo Router app (`app/`) with stacked screens defined in `_layout.tsx`; `AuthProvider` and `ToastProvider` wrap the entire navigation tree.
- Two backend services: Core API (`API_BASE`) and Auth API (`AUTH_BASE`) configured in `app/config.ts`. Defaults assume localhost ports 5001/5002; on Android emulator replace host with `10.0.2.2` when needed.
- Generated OpenAPI TypeScript Fetch clients live in `app/apis/pantmig-api` and `app/apis/pantmig-auth`. Do NOT hand-edit generated files—regenerate via npm scripts.
- Authentication tokens persist in `AsyncStorage` (`token`, `refreshToken`, `user`). Middleware in `app/services/api.ts` injects Authorization header and transparently refreshes on 401.
- Auth refresh success triggers a sync callback (`setAuthSyncListener`) so `AuthContext` can update state without manual re-login.
- Domain API usage pattern: import factory or shared config (`createRecycleListingsApi`, `pantmigApiConfig`) rather than instantiating raw generated classes with ad-hoc base paths.
- Simple in-memory cross-session cache for user meta (`userCache.ts`) keyed by user ID; store `userName` and `rating`. Use provided merge helpers instead of custom maps.

## 2. Key Files & Their Responsibilities
- `app/_layout.tsx`: Composition root (providers + screen options + custom web header max width constraint).
- `app/AuthContext.tsx`: Central auth state (user info enrichment + login/logout + token/refresh persistence + role derivation from `userType`).
- `app/services/api.ts`: Base paths resolution (config > env) + auth middleware + shared API instances + token refresh retry logic.
- `app/config.ts`: Single source of truth for base URLs; adjust here for environment targeting instead of scattering constants.
- `app/Toast.tsx`: Lightweight toast notification provider (use for UX feedback rather than `alert`).
- Screen components (`app/*.tsx` excluding providers): UI + direct calls into OpenAPI clients or helper factories.

## 3. Conventions & Patterns
- Do not import generated API runtime types from relative deep paths outside their package folders—reference via existing barrel (`models/index.ts`, `apis/*.ts` re-exports) where available.
- Keep network mutations inside event handlers; derive minimal local component state. Prefer pulling token via `useAuth()` instead of re-reading `AsyncStorage`.
- Token / user state changes must go through `AuthContext` helpers (`login`, `logout`, `setAuthFromResponse`, `updateTokens`). Avoid ad-hoc `AsyncStorage.setItem` for these keys outside `services/api.ts` & `AuthContext`.
- When adding new API endpoints: regenerate clients rather than manually writing fetch code. If backend spec adds a path, run `npm run generate-api` or `npm run generate-auth`.
- If you add a domain API abstraction, mirror existing pattern: lightweight factory returning an instance with shared `pantmigApiConfig` so middleware applies.
- For role logic, derive display role from `ApiUserType` numeric enum mapping already in `AuthContext` (0 → Donator, 1 → Recycler). Do not duplicate mapping.
- Avoid spreading `Authorization` headers manually; rely on middleware unless a truly unauthenticated standalone request is required.

## 4. Environment & Configuration
- Runtime host override precedence: `app/config.ts` constants > `EXPO_PUBLIC_*` env vars > hard-coded defaults in `services/api.ts`.
- For emulator/device discrepancies, change ONLY `app/config.ts` (commit or document local override accordingly).
- No secret management in-repo; tokens are short-lived and stored client-side only.

## 5. Auth & Token Refresh Flow
1. User logs in via `authApi.authLogin` (email or username unified as `emailOrUsername`).
2. Response persisted + user object normalized in `setAuthFromResponse`.
3. Subsequent requests auto-attach `Bearer <access>` via `authMiddleware.pre`.
4. On 401, `authMiddleware.onError` attempts a refresh (`authRefresh`); if successful updates storage + notifies `AuthContext` via `authSyncListener` then retries original request once.
5. If refresh fails, request propagates error (UI may inspect and force logout).

## 6. Adding Features Safely
- New screen: create `app/<name>.tsx` and register implicitly (Expo Router) or add explicit `<Stack.Screen>` if you need custom `options` (update `_layout.tsx`).
- New API usage: import `createRecycleListingsApi()`; do not instantiate config manually unless adding distinct middleware.
- New auth-derived fields: extend `AuthUser` in `AuthContext.tsx` and populate inside `setAuthFromResponse`—keep backward compatibility with existing persisted JSON.
- Extend user caching: add properties to `CachedUserInfo` and update `mergeBatchIntoCache` & `getMissingIds` logic accordingly.

## 7. Regenerating Clients
- Ensure backend(s) running with Swagger at `/swagger/v1/swagger.json`.
- Commands:
  - Core: `npm run generate-api`
  - Auth: `npm run generate-auth`
- After regeneration: verify no manual edits were lost (manual edits are discouraged). Commit the whole regenerated directory if meaningful changes occurred.

## 8. Common Pitfalls
- Forgetting to adjust `config.ts` for Android emulator host → leads to silent network failures / timeouts.
- Manually persisting tokens causing desync with refresh middleware; always route through context helpers.
- Editing generated OpenAPI code—will be overwritten; create wrappers instead.
- Adding headers without preserving existing ones in middleware; rely on merge pattern used in `api.ts`.

## 9. Testing & Linting
- Start dev server: `npx expo start` (or script aliases `npm run android`, `npm run ios`, `npm run web`).
- Lint: `npm run lint` (configured via `eslint-config-expo`). Keep diffs small; follow existing formatting.
- No unit test harness present—when adding, colocate under `__tests__` and avoid blocking CI assumptions (none currently defined).

## 10. When Unsure
- Prefer reading `AuthContext.tsx` & `services/api.ts` before touching auth flows.
- Provide minimal vertical slice (screen + API call + toast) rather than broad refactors.
- Ask before introducing state libraries (Redux, Zustand)—current approach favors lean React state + context.

---
Refinements welcome: highlight unclear areas or desired additions (e.g., error handling strategy, navigation guards) and this guide can be iterated.
