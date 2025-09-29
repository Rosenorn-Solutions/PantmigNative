// Central app configuration for base URLs
// Adjust these to your local/dev/prod endpoints as needed.
// On Android emulator, use 10.0.2.2 to reach the host machine.
import { Platform } from 'react-native';

// New public production domains
const PROD_API = 'https://api.pantmig.dk';
const PROD_AUTH = 'https://auth.pantmig.dk';

// Environment overrides (use these for local dev / staging)
// If EXPO_PUBLIC_HOST is set we reconstruct host:port style URLs (legacy pattern)
const envHost = process.env.EXPO_PUBLIC_HOST; // optional host override (only if set we use host:port style)
const protocol = process.env.EXPO_PUBLIC_PROTOCOL || 'http';
const apiPort = process.env.EXPO_PUBLIC_API_PORT || '5001';
const authPort = process.env.EXPO_PUBLIC_AUTH_PORT || '5002';
// We no longer automatically swap to 10.0.2.2; local dev must explicitly set EXPO_PUBLIC_HOST to avoid accidentally overriding production on Android.
const reconstructedHostBase = envHost ? `${protocol}://${envHost}:${apiPort}` : null;
const reconstructedAuthBase = envHost ? `${protocol}://${envHost}:${authPort}` : null;

// If explicit EXPO_PUBLIC_API_BASE / AUTH_BASE are provided, prefer them (future flexibility)
const explicitApiBase = process.env.EXPO_PUBLIC_API_BASE;
const explicitAuthBase = process.env.EXPO_PUBLIC_AUTH_BASE;

// Final resolution order (no implicit emulator override):
// 1. Explicit base (EXPO_PUBLIC_API_BASE / AUTH_BASE)
// 2. Host/port reconstruction IF EXPO_PUBLIC_HOST provided
// 3. Production domain (default)
export const API_BASE = explicitApiBase || reconstructedHostBase || PROD_API;
export const AUTH_BASE = explicitAuthBase || reconstructedAuthBase || PROD_AUTH;

// For clarity export also the production constants (may help conditional logic elsewhere if needed)
export const PROD_API_BASE = PROD_API;
export const PROD_AUTH_BASE = PROD_AUTH;
