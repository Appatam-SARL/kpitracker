import { createHash, randomBytes } from 'crypto';
import { getBasePath } from '@/lib/api-url';
import { resolveAppUrl } from '@/lib/app-url';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buildPasswordResetUrl(token: string): string {
  const origin = resolveAppUrl().replace(/\/$/, '');
  const basePath = getBasePath();
  return `${origin}${basePath}/reset-password/confirm?token=${encodeURIComponent(token)}`;
}
