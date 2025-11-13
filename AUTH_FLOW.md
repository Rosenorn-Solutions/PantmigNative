# Auth and Token Refresh Flow

This app integrates with AuthService endpoints using short-lived access tokens and rotating refresh tokens. The implementation follows best-practice guidance and supports multi-tab coordination on web.

## Endpoints
- POST /auth/register → AuthResponse
- POST /auth/login → AuthResponse
- GET /auth/me → Returns `UserInformationDTO` for current user
- POST /auth/refresh → body `{ accessToken, refreshToken }` → AuthResponse (rotates refresh token)

## Storage
- AsyncStorage keys: `token`, `refreshToken`, `tokenExpiresAt`, `user`
- Tokens are also mirrored in memory via `AuthContext` for UI convenience

## Middleware (`app/services/api.ts`)
- Automatically attaches `Authorization: Bearer <accessToken>` to all protected requests
- Proactive refresh when `accessTokenExpiration - now <= 60s`
- On 401 Unauthorized: runs one refresh cycle and retries the original request once
- On refresh success: tokens are stored, `AuthContext` is notified, and a cross-tab broadcast is sent
- On refresh failure (including 400 invalid or expired refresh token): tokens are cleared and a logout broadcast is sent

## Rotation Safety
- The server revokes the previous refresh token at each successful `/auth/refresh`
- We immediately replace the stored refresh token (rotation)

## Multi-Tab/Web Coordination (`app/services/authSync.ts`)
- BroadcastChannel `pantmig_auth` (web only) publishes:
  - `refresh-start` (advisory)
  - `tokens-updated` with the latest AuthResponse
  - `logout` with a simple reason tag
- Other tabs update their state on `tokens-updated` and stop attempting concurrent refreshes by waiting briefly for a broadcasted update
- On native (no BroadcastChannel), the module falls back to a no-op local bus (no multi-instance needed)

## AuthContext (`app/AuthContext.tsx`)
- Loads persisted tokens and user at startup
- If a token exists but no user cache is present, it calls `/auth/me` once to rehydrate basic user info
- Subscribes to broadcast events to update tokens or logout promptly when another tab rotates or invalidates tokens
- Schedules a proactive refresh ~60s before access token expiration

## Error Handling
- 401 on an API call → single refresh attempt → retry once
- 400 invalid/expired refresh token during refresh → tokens cleared → broadcast logout → UI redirects to login

## Notes
- Do not import or edit generated OpenAPI clients directly except through factories/config; follow repository conventions in `app/services/api.ts`
- Avoid logging sensitive values; HTTP logs omit tokens
