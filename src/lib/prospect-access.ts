import type { AuthUser } from '@/lib/auth';
import { hasGroupCompanyScope } from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Accès au pool de prospects entreprise partagés :
 * - société kind GROUP, ou
 * - rôles périmètre groupe (directrice, PDG, …), ou
 * - ADMIN
 */
export async function canAccessGroupProspects(
  user: AuthUser,
): Promise<boolean> {
  if (!user.companyId) return false;
  if (user.role === 'ADMIN') return true;
  if (hasGroupCompanyScope(user.role)) return true;

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { kind: true },
  });
  return company?.kind === 'GROUP';
}

export async function requireGroupProspectsAccess(
  user: AuthUser,
): Promise<true | NextResponse> {
  const ok = await canAccessGroupProspects(user);
  if (!ok) {
    return NextResponse.json(
      {
        error:
          'Accès réservé aux sociétés du groupe (YEFIEN, APPATAM, SOCOPI, DJELA, SUZANG GROUP, BIIM).',
      },
      { status: 403 },
    );
  }
  return true;
}

type ContactOwner = {
  createdById: string;
  createdBy?: { companyId: string | null } | null;
};

/** Directrice commerciale, directrice des opérations, PDG, et ADMIN (accès complet). */
export function canViewAllProspectContacts(user: AuthUser): boolean {
  if (user.role === 'ADMIN') return true;
  return hasGroupCompanyScope(user.role);
}

/** DG (MANAGER) : consultation des fiches de sa société uniquement. */
export function canViewCompanyProspectContacts(user: AuthUser): boolean {
  return user.role === 'MANAGER' && Boolean(user.companyId);
}

/**
 * Fiche contact :
 * - commerciale : uniquement les siennes ;
 * - DG : celles des commerciales de sa société ;
 * - rôles groupe et ADMIN : toutes.
 */
export function canViewContactFiche(
  user: AuthUser,
  contact: ContactOwner,
): boolean {
  if (canViewAllProspectContacts(user)) return true;
  if (contact.createdById === user.id) return true;
  if (
    canViewCompanyProspectContacts(user) &&
    contact.createdBy?.companyId &&
    contact.createdBy.companyId === user.companyId
  ) {
    return true;
  }
  return false;
}

/** Modification / suppression : propriétaire, rôles groupe ou ADMIN (pas le DG en simple consultation). */
export function canManageContact(
  user: AuthUser,
  contact: { createdById: string },
): boolean {
  if (user.role === 'ADMIN' || hasGroupCompanyScope(user.role)) return true;
  return contact.createdById === user.id;
}
