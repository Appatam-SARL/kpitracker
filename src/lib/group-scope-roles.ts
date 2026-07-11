/** Rôles avec vision multi-entreprises (même périmètre que la directrice commerciale). */
export const GROUP_SCOPE_ROLES = [
  "DIRECTRICE_COMMERCIALE",
  "PDG",
  "DIRECTRICE_OPERATION",
] as const;

export type GroupScopeRole = (typeof GROUP_SCOPE_ROLES)[number];

/** Valeur du select entreprise : stats agrégées sur toutes les sociétés kind GROUP. */
export const GROUP_HOLDING_SCOPE_VALUE = "holding";

export type ResolvedGroupCompanyScope =
  | { mode: "single"; companyId: string }
  | { mode: "holding"; companyIds: string[] };

export function hasGroupCompanyScope(role: string): boolean {
  return (GROUP_SCOPE_ROLES as readonly string[]).includes(role);
}

export function isGroupHoldingScopeValue(
  value: string | null | undefined,
): boolean {
  return value?.trim() === GROUP_HOLDING_SCOPE_VALUE;
}

export function prismaCompanyScopeFilter(scope: ResolvedGroupCompanyScope): {
  companyId: string | { in: string[] };
} {
  if (scope.mode === "holding") {
    return { companyId: { in: scope.companyIds } };
  }
  return { companyId: scope.companyId };
}

export function userCompanyInScope(
  userCompanyId: string,
  scope: ResolvedGroupCompanyScope,
): boolean {
  if (scope.mode === "holding") {
    return scope.companyIds.includes(userCompanyId);
  }
  return userCompanyId === scope.companyId;
}
