// Central app configuration for base URLs
// Adjust these to your local/dev/prod endpoints as needed.
// On Android emulator, use 10.0.2.2 to reach the host machine.
import { Platform } from 'react-native';

const envHost = process.env.EXPO_PUBLIC_HOST;
const protocol = process.env.EXPO_PUBLIC_PROTOCOL || 'http';
const apiPort = process.env.EXPO_PUBLIC_API_PORT || '5001';
const authPort = process.env.EXPO_PUBLIC_AUTH_PORT || '5002';
const host = envHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const API_BASE = `${protocol}://${host}:${apiPort}`;
export const AUTH_BASE = `${protocol}://${host}:${authPort}`;
