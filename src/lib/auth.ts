import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GROUP_HOLDING_SCOPE_VALUE,
  hasGroupCompanyScope,
  userCompanyInScope,
  type ResolvedGroupCompanyScope,
} from "@/lib/group-scope-roles";
import { prisma } from "@/lib/prisma";

export type Role =
  | "ADMIN"
  | "MANAGER"
  | "DIRECTRICE_COMMERCIALE"
  | "PDG"
  | "DIRECTRICE_OPERATION"
  | "AGENT";

function effectiveRoleForPermissions(role: Role): Role {
  if (hasGroupCompanyScope(role)) return "MANAGER";
  return role;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string | null;
}

/**
 * Récupère l'utilisateur connecté à partir du cookie de session.
 * Retourne null si non authentifié ou utilisateur introuvable.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("auth_session")?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    companyId: user.companyId,
  };
}

/**
 * Vérifie si l'utilisateur a l'un des rôles autorisés.
 */
export function hasRole(user: AuthUser | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(effectiveRoleForPermissions(user.role));
}

/**
 * Vérifie l'authentification et le rôle côté API.
 * Retourne une NextResponse 401 si non authentifié, 403 si rôle insuffisant.
 * Sinon retourne null (l'appelant peut continuer).
 */
export async function requireRole(
  allowedRoles: Role[]
): Promise<{ user: AuthUser } | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Non authentifié" },
      { status: 401 }
    );
  }
  if (!allowedRoles.includes(effectiveRoleForPermissions(user.role))) {
    return NextResponse.json(
      { error: "Accès refusé" },
      { status: 403 }
    );
  }
  return { user };
}

/**
 * Périmètre entreprise pour rapports / objectifs : ADMIN & MANAGER restent sur leur société.
 * Rôles groupe (directrice, PDG, directrice opération) : sans companyId → société rattachée ;
 * avec companyId → entreprise ciblée si elle existe.
 */
export async function resolveGroupCompanyScope(
  user: AuthUser,
  companyIdParam: string | null,
): Promise<ResolvedGroupCompanyScope | NextResponse> {
  if (!user.companyId) {
    return NextResponse.json(
      { error: "Société non associée à l'utilisateur" },
      { status: 403 },
    );
  }
  if (!hasGroupCompanyScope(user.role)) {
    return { mode: "single", companyId: user.companyId };
  }
  const requested = companyIdParam?.trim() ?? "";
  if (!requested) {
    return { mode: "single", companyId: user.companyId };
  }
  if (requested === GROUP_HOLDING_SCOPE_VALUE) {
    const companies = await prisma.company.findMany({
      where: { kind: "GROUP" },
      select: { id: true },
    });
    return {
      mode: "holding",
      companyIds: companies.map((company) => company.id),
    };
  }
  const company = await prisma.company.findUnique({
    where: { id: requested },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json(
      { error: "Entreprise introuvable" },
      { status: 400 },
    );
  }
  return { mode: "single", companyId: company.id };
}

const GOAL_MUTATION_DENIED = NextResponse.json(
  { error: "Accès refusé" },
  { status: 403 },
);

/**
 * Vérifie si l'utilisateur peut créer/modifier/supprimer un objectif
 * pour une société cible (commercial rattaché à targetCompanyId).
 */
export async function canMutateGoalForTargetCompany(
  actor: AuthUser,
  targetCompanyId: string | null,
): Promise<true | NextResponse> {
  if (!actor.companyId) {
    return NextResponse.json(
      { error: "Utilisateur sans entreprise" },
      { status: 403 },
    );
  }
  if (!targetCompanyId) {
    return GOAL_MUTATION_DENIED;
  }

  if (actor.role === "PDG" || actor.role === "DIRECTRICE_OPERATION") {
    return GOAL_MUTATION_DENIED;
  }

  if (actor.role === "ADMIN" || actor.role === "MANAGER") {
    if (targetCompanyId !== actor.companyId) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé ou autre entreprise" },
        { status: 403 },
      );
    }
    return true;
  }

  if (actor.role === "DIRECTRICE_COMMERCIALE") {
    const scope = await resolveGroupCompanyScope(actor, targetCompanyId);
    if (scope instanceof NextResponse) return scope;
    if (!userCompanyInScope(targetCompanyId, scope)) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé ou autre entreprise" },
        { status: 403 },
      );
    }
    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { kind: true },
    });
    if (!company || company.kind !== "GROUP") {
      return GOAL_MUTATION_DENIED;
    }
    return true;
  }

  return GOAL_MUTATION_DENIED;
}

/** Même périmètre que les objectifs : admin/manager (leur société), directrice (filiales groupe). */
export async function canManageCatalogForTargetCompany(
  actor: AuthUser,
  targetCompanyId: string | null,
): Promise<true | NextResponse> {
  return canMutateGoalForTargetCompany(actor, targetCompanyId);
}

const VIEW_ACCESS_DENIED = NextResponse.json(
  { error: "Accès refusé" },
  { status: 403 },
);

/**
 * Vérifie si l'utilisateur peut consulter le profil d'un membre
 * rattaché à targetCompanyId (lecture seule, rôles groupe inclus).
 */
export async function canViewUserProfile(
  actor: AuthUser,
  targetCompanyId: string | null,
): Promise<true | NextResponse> {
  if (!actor.companyId) {
    return NextResponse.json(
      { error: "Utilisateur sans entreprise" },
      { status: 403 },
    );
  }
  if (!targetCompanyId) {
    return VIEW_ACCESS_DENIED;
  }

  if (actor.role === "ADMIN" || actor.role === "MANAGER") {
    if (targetCompanyId !== actor.companyId) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé ou autre entreprise" },
        { status: 403 },
      );
    }
    return true;
  }

  if (hasGroupCompanyScope(actor.role)) {
    const scope = await resolveGroupCompanyScope(actor, targetCompanyId);
    if (scope instanceof NextResponse) return scope;
    if (!userCompanyInScope(targetCompanyId, scope)) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé ou autre entreprise" },
        { status: 403 },
      );
    }
    const company = await prisma.company.findUnique({
      where: { id: targetCompanyId },
      select: { kind: true },
    });
    if (!company || company.kind !== "GROUP") {
      return VIEW_ACCESS_DENIED;
    }
    return true;
  }

  return VIEW_ACCESS_DENIED;
}

/**
 * Mise en corbeille d'un compte : admin/manager (leur société), rôles groupe (filiales GROUP).
 */
export async function canSoftDeleteUserAccount(
  actor: AuthUser,
  target: { id: string; companyId: string; role: Role },
): Promise<true | NextResponse> {
  if (!actor.companyId) {
    return NextResponse.json(
      { error: "Utilisateur sans entreprise" },
      { status: 403 },
    );
  }
  if (target.id === actor.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas mettre votre propre compte à la corbeille" },
      { status: 403 },
    );
  }
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (actor.role === "ADMIN" || actor.role === "MANAGER") {
    if (target.companyId !== actor.companyId) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé ou autre entreprise" },
        { status: 403 },
      );
    }
    return true;
  }

  if (hasGroupCompanyScope(actor.role)) {
    return canViewUserProfile(actor, target.companyId);
  }

  return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
}
