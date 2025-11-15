import { normalizePhoneDK } from '../utils/phone';
import { authApi } from './api';

/** Check if email is already taken. Returns true if taken, false otherwise. Swallows network errors (treat as not taken). */
export async function isEmailTaken(email: string): Promise<boolean> {
  const trimmed = email.trim();
  if (!trimmed) return false;
  try {
    const { taken } = await authApi.authCheckEmail({ email: trimmed });
    return !!taken;
  } catch {
    return false;
  }
}

/** Check if phone is already taken. Returns true if taken, false otherwise. Swallows network errors (treat as not taken). */
export async function isPhoneTaken(phone: string): Promise<boolean> {
  const normalized = normalizePhoneDK(phone);
  if (!normalized) return false;
  try {
    const { taken } = await authApi.authCheckPhone({ phone: normalized });
    return !!taken;
  } catch {
    return false;
  }
}
