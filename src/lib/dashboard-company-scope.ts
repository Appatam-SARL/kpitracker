import { resolveGroupCompanyScope, type AuthUser } from '@/lib/auth';
import {
  hasGroupCompanyScope,
  prismaCompanyScopeFilter,
} from '@/lib/group-scope-roles';
import { activeOnlyWhere } from '@/lib/trash';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

/** Filtre Prisma leads pour les KPIs dashboard (périmètre groupe via ?companyId=). */
export async function resolveDashboardLeadWhere(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<Prisma.LeadWhereInput | NextResponse> {
  if (hasGroupCompanyScope(user.role)) {
    const scope = await resolveGroupCompanyScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;
    return { ...prismaCompanyScopeFilter(scope), ...activeOnlyWhere };
  }

  if (!user.companyId) {
    return activeOnlyWhere;
  }

  return { companyId: user.companyId, ...activeOnlyWhere };
}
