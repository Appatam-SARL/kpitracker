import { resolveGroupCompanyScope, type AuthUser } from '@/lib/auth';
import {
  hasGroupCompanyScope,
  prismaCompanyScopeFilter,
} from '@/lib/group-scope-roles';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { activeOnlyWhere } from '@/lib/trash';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

/**
 * Filtre Prisma prospects pour les KPIs dashboard (pool GROUP partagé).
 * Les rôles groupe peuvent restreindre via `companyId` (filiale ou holding)
 * aux entreprises dont un contact a été créé par un commercial de ce périmètre.
 */
export async function resolveDashboardLeadWhere(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<Prisma.ProspectWhereInput | NextResponse> {
  const access = await requireGroupProspectsAccess(user);
  if (access !== true) return access;

  if (!hasGroupCompanyScope(user.role)) {
    return { ...activeOnlyWhere };
  }

  const scope = await resolveGroupCompanyScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;

  // Holding = pool GROUP complet ; filiale = prospects liés à un contact de cette société.
  if (scope.mode === 'holding') {
    return { ...activeOnlyWhere };
  }

  const companyFilter = prismaCompanyScopeFilter(scope);

  return {
    ...activeOnlyWhere,
    contacts: {
      some: {
        deletedAt: null,
        createdBy: companyFilter,
      },
    },
  };
}
