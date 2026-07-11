import type { FrontendRole } from "@/contexts/AuthContext";

export const GROUP_SCOPE_FRONTEND_ROLES = [
  "directrice_commerciale",
  "pdg",
  "directrice_operation",
] as const satisfies readonly FrontendRole[];

/** Rôles avec accès navigation / pages équivalent directrice (stats, users, filtre entreprise). */
export const GROUP_NAV_ROLES = [
  "admin",
  "manager",
  ...GROUP_SCOPE_FRONTEND_ROLES,
] as const satisfies readonly FrontendRole[];

const FRONTEND_ROLE_MAP: Record<string, FrontendRole> = {
  admin: "admin",
  manager: "manager",
  agent: "agent",
  directrice_commerciale: "directrice_commerciale",
  pdg: "pdg",
  directrice_operation: "directrice_operation",
};

export function normalizeFrontendRole(raw: string | undefined | null): FrontendRole {
  const key = (raw ?? "agent").toLowerCase().replace(/-/g, "_");
  return FRONTEND_ROLE_MAP[key] ?? "agent";
}

export function hasGroupCompanyScopeFrontend(
  role: FrontendRole | null | undefined,
): boolean {
  if (!role) return false;
  return (GROUP_SCOPE_FRONTEND_ROLES as readonly string[]).includes(role);
}

export function isManagerLike(role: FrontendRole | null | undefined): boolean {
  return role === "manager" || hasGroupCompanyScopeFrontend(role);
}

export function isAdminOrManagerLike(
  role: FrontendRole | null | undefined,
): boolean {
  return role === "admin" || isManagerLike(role);
}

/** Directrice commerciale : catalogue produits/services sur toutes les sociétés du groupe. */
export function canManageCrossCompanyCatalog(
  role: FrontendRole | null | undefined,
): boolean {
  return role === "directrice_commerciale";
}

export function canManageCatalog(
  role: FrontendRole | null | undefined,
): boolean {
  return (
    role === "admin" ||
    role === "manager" ||
    canManageCrossCompanyCatalog(role)
  );
}

/** Directrice commerciale : objectifs sur toutes les sociétés du groupe. */
export function canManageCrossCompanyGoals(
  role: FrontendRole | null | undefined,
): boolean {
  return role === "directrice_commerciale";
}

/** PDG et directrice opération : consultation des commerciales sans gestion d'objectifs. */
export function isGroupCommercialsViewOnly(
  role: FrontendRole | null | undefined,
): boolean {
  return role === "pdg" || role === "directrice_operation";
}

export function canManageUserAccounts(
  role: FrontendRole | null | undefined,
): boolean {
  return role === "admin" || role === "manager";
}

/** Mise en corbeille d'un utilisateur : managers/admins + rôles périmètre groupe. */
export function canTrashUserAccounts(
  role: FrontendRole | null | undefined,
): boolean {
  return canManageUserAccounts(role) || hasGroupCompanyScopeFrontend(role);
}

export function canSetAgentGoal(
  role: FrontendRole | null | undefined,
): boolean {
  return canManageUserAccounts(role) || canManageCrossCompanyGoals(role);
}

/** Corbeille CRM : managers, admins et rôles groupe uniquement. */
export function canAccessTrash(
  role: FrontendRole | null | undefined,
): boolean {
  return isAdminOrManagerLike(role);
}

/** Historique d'actions : même périmètre que la consultation de profil (canViewUserProfile côté API). */
export function canViewUserActionHistory(
  role: FrontendRole | null | undefined,
): boolean {
  return isAdminOrManagerLike(role);
}

/** Options pour les formulaires de création / édition d’utilisateur. */
export const USER_ROLE_FORM_OPTIONS: ReadonlyArray<
  readonly [FrontendRole, string]
> = [
  ["agent", "Commercial"],
  ["manager", "DG"],
  ["directrice_commerciale", "Directrice commerciale"],
  ["pdg", "PDG"],
  ["directrice_operation", "Directrice opération"],
  ["admin", "Admin"],
];

export const USER_ROLE_FILTER_OPTIONS: ReadonlyArray<
  readonly [FrontendRole | "all", string]
> = [["all", "Tous"], ...USER_ROLE_FORM_OPTIONS];

export function frontendRoleToApi(role: FrontendRole): string {
  return role.toUpperCase();
}

export function getRoleLabel(role: FrontendRole): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "DG";
    case "directrice_commerciale":
      return "Directrice commerciale";
    case "pdg":
      return "PDG";
    case "directrice_operation":
      return "Directrice opération";
    default:
      return "Commercial";
  }
}
