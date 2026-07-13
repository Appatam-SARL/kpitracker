import type { AuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const USER_ACTION_CODES = {
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_PASSWORD_CHANGE: 'AUTH_PASSWORD_CHANGE',
  AUTH_MFA_ENABLE: 'AUTH_MFA_ENABLE',
  AUTH_MFA_DISABLE: 'AUTH_MFA_DISABLE',
  AUTH_MFA_VERIFY: 'AUTH_MFA_VERIFY',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  PROFILE_SIGNATURE_UPDATE: 'PROFILE_SIGNATURE_UPDATE',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  LEAD_CREATE: 'LEAD_CREATE',
  LEAD_UPDATE: 'LEAD_UPDATE',
  LEAD_DELETE: 'LEAD_DELETE',
  LEAD_IMPORT: 'LEAD_IMPORT',
  LEAD_EXPORT: 'LEAD_EXPORT',
  LEAD_INTERESTS_UPDATE: 'LEAD_INTERESTS_UPDATE',
  LEAD_ATTACHMENT_CREATE: 'LEAD_ATTACHMENT_CREATE',
  LEAD_ATTACHMENT_DELETE: 'LEAD_ATTACHMENT_DELETE',
  CLIENT_CREATE: 'CLIENT_CREATE',
  CLIENT_UPDATE: 'CLIENT_UPDATE',
  CLIENT_INTERESTS_UPDATE: 'CLIENT_INTERESTS_UPDATE',
  ACTIVITY_CREATE: 'ACTIVITY_CREATE',
  ACTIVITY_RESCHEDULE: 'ACTIVITY_RESCHEDULE',
  ACTIVITY_UPDATE: 'ACTIVITY_UPDATE',
  ACTIVITY_REPORT: 'ACTIVITY_REPORT',
  AGENDA_CREATE: 'AGENDA_CREATE',
  AGENDA_UPDATE: 'AGENDA_UPDATE',
  AGENDA_DELETE: 'AGENDA_DELETE',
  GOAL_CREATE: 'GOAL_CREATE',
  GOAL_UPDATE: 'GOAL_UPDATE',
  GOAL_DELETE: 'GOAL_DELETE',
  GOAL_RENEW: 'GOAL_RENEW',
  TRASH_RESTORE: 'TRASH_RESTORE',
  TRASH_PURGE: 'TRASH_PURGE',
  PRODUCT_CREATE: 'PRODUCT_CREATE',
  SERVICE_CREATE: 'SERVICE_CREATE',
  SALE_CREATE: 'SALE_CREATE',
  EMAIL_SEND: 'EMAIL_SEND',
  REPORT_EXPORT: 'REPORT_EXPORT',
} as const;

export type UserActionCode =
  (typeof USER_ACTION_CODES)[keyof typeof USER_ACTION_CODES];

export type LogUserActionInput = {
  user: Pick<AuthUser, 'id' | 'companyId'>;
  action: UserActionCode | string;
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export function formatLeadName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function logUserAction(input: LogUserActionInput): Promise<void> {
  const { user, action, summary, entityType, entityId, metadata } = input;
  if (!user.companyId) return;

  try {
    await prisma.userActionLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        action,
        summary,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error('logUserAction failed', { action, userId: user.id, error });
  }
}
