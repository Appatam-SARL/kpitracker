import { resolveGroupCompanyScope, type AuthUser } from '@/lib/auth';
import {
  hasGroupCompanyScope,
  prismaCompanyScopeFilter,
} from '@/lib/group-scope-roles';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { activeOnlyWhere } from '@/lib/trash';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

export type DashboardScopeFilters = {
  /** Contacts visibles selon le rôle (source de vérité commerciale). */
  contactWhere: Prisma.ProspectContactWhereInput;
  /** Entreprises liées à au moins un contact du périmètre. */
  prospectWhere: Prisma.ProspectWhereInput;
};

/**
 * Périmètre dashboard commercial :
 * - AGENT : ses contacts uniquement
 * - MANAGER (DG) : contacts des commerciales de sa société
 * - PDG / DIRECTRICE_* : contacts du GROUP (filtre ?companyId= filiale ou holding)
 * - ADMIN : tous les contacts actifs
 */
export async function resolveDashboardScope(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<DashboardScopeFilters | NextResponse> {
  const access = await requireGroupProspectsAccess(user);
  if (access !== true) return access;

  let contactWhere: Prisma.ProspectContactWhereInput = { deletedAt: null };

  if (user.role === 'ADMIN') {
    contactWhere = { deletedAt: null };
  } else if (user.role === 'AGENT') {
    contactWhere = { deletedAt: null, createdById: user.id };
  } else if (user.role === 'MANAGER') {
    if (!user.companyId) {
      return NextResponse.json(
        { error: 'Société non associée à l’utilisateur' },
        { status: 403 },
      );
    }
    contactWhere = {
      deletedAt: null,
      createdBy: { companyId: user.companyId },
    };
  } else if (hasGroupCompanyScope(user.role)) {
    const scope = await resolveGroupCompanyScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;
    contactWhere = {
      deletedAt: null,
      createdBy: prismaCompanyScopeFilter(scope),
    };
  } else {
    contactWhere = { deletedAt: null, createdById: user.id };
  }

  const prospectWhere: Prisma.ProspectWhereInput = {
    ...activeOnlyWhere,
    contacts: { some: contactWhere },
  };

  return { contactWhere, prospectWhere };
}

/** Filtre prospects (KPIs / listes entreprises / charts source). */
export async function resolveDashboardLeadWhere(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<Prisma.ProspectWhereInput | NextResponse> {
  const scope = await resolveDashboardScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;
  return scope.prospectWhere;
}

/** Filtre contacts (listes / charts stades / compteurs). */
export async function resolveDashboardContactWhere(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<Prisma.ProspectContactWhereInput | NextResponse> {
  const scope = await resolveDashboardScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;
  return scope.contactWhere;
}
