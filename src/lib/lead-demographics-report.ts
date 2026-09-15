import {
  type ResolvedGroupCompanyScope,
  prismaCompanyScopeFilter,
  userCompanyInScope,
} from '@/lib/group-scope-roles';
import {
  aggregateCompanyNames,
  aggregateNormalizedRows,
  aggregateTopLabels,
  normalizeActivitySector,
  normalizeCivility,
  normalizeDecisionRole,
  normalizeJobTitle,
  normalizeLeadSource,
  normalizeLeadType,
  normalizeLocation,
  sortDemographicRows,
} from '@/lib/lead-demographics';
import { prisma } from '@/lib/prisma';
import { activeOnlyWhere } from '@/lib/trash';
import type { Prisma } from '@prisma/client';

export type LeadDemographicsResponse = {
  total: number;
  byCivility: { label: string; count: number }[];
  byActivitySector: { label: string; count: number }[];
  /** Nom de l'entreprise prospectée. */
  byCompanyName: { label: string; count: number }[];
  /** Contacts par filiale CRM du créateur — périmètre holding uniquement. */
  byGroupCompany: { label: string; count: number }[];
  byLocation: { label: string; count: number }[];
  byJobTitle: { label: string; count: number }[];
  /** Type de client (LeadTypeClient) au niveau prospect. */
  byLeadType: { label: string; count: number }[];
  /** Source d'acquisition du lead. */
  bySource: { label: string; count: number }[];
  /** Rôle du contact dans la décision d'achat. */
  byDecisionRole: { label: string; count: number }[];
};

export async function buildLeadDemographicsReport(
  scope: ResolvedGroupCompanyScope,
  userId?: string,
): Promise<LeadDemographicsResponse> {
  const companyFilter = prismaCompanyScopeFilter(scope);

  if (userId?.trim()) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { companyId: true },
    });
    if (!targetUser || !userCompanyInScope(targetUser.companyId, scope)) {
      throw new Error('Commercial introuvable ou autre entreprise');
    }
  }

  const contactCreatorFilter: Prisma.ProspectContactWhereInput = {
    deletedAt: null,
    createdBy: companyFilter,
    ...(userId?.trim() ? { createdById: userId.trim() } : {}),
  };

  const prospectWhere: Prisma.ProspectWhereInput = {
    ...activeOnlyWhere,
    contacts: { some: contactCreatorFilter },
  };

  const contactWhere: Prisma.ProspectContactWhereInput = {
    ...contactCreatorFilter,
    prospect: activeOnlyWhere,
  };

  const [
    civilityGroup,
    sectorGroup,
    companyGroup,
    locationGroup,
    jobTitleGroup,
    leadTypeGroup,
    sourceGroup,
    decisionRoleGroup,
    total,
  ] = await Promise.all([
    prisma.prospectContact.groupBy({
      by: ['civility'],
      where: contactWhere,
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['activitySector'],
      where: prospectWhere,
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['name'],
      where: prospectWhere,
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['location'],
      where: prospectWhere,
      _count: { _all: true },
    }),
    prisma.prospectContact.groupBy({
      by: ['jobTitle'],
      where: contactWhere,
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['leadType'],
      where: prospectWhere,
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ['source'],
      where: prospectWhere,
      _count: { _all: true },
    }),
    prisma.prospectContact.groupBy({
      by: ['decisionRole'],
      where: contactWhere,
      _count: { _all: true },
    }),
    prisma.prospect.count({ where: prospectWhere }),
  ]);

  const byCivility = aggregateNormalizedRows(
    civilityGroup.map((row) => ({
      value: row.civility,
      count: row._count._all,
    })),
    normalizeCivility,
  );
  const byActivitySector = aggregateNormalizedRows(
    sectorGroup.map((row) => ({
      value: row.activitySector,
      count: row._count._all,
    })),
    normalizeActivitySector,
  );
  const byCompanyName = aggregateCompanyNames(
    companyGroup.map((row) => ({
      value: row.name,
      count: row._count._all,
    })),
    12,
  );
  const byLocation = aggregateTopLabels(
    locationGroup.map((row) => ({
      value: row.location,
      count: row._count._all,
    })),
    normalizeLocation,
    10,
  );
  const byJobTitle = aggregateTopLabels(
    jobTitleGroup.map((row) => ({
      value: row.jobTitle,
      count: row._count._all,
    })),
    normalizeJobTitle,
    10,
  );
  const byLeadType = aggregateNormalizedRows(
    leadTypeGroup.map((row) => ({
      value: row.leadType,
      count: row._count._all,
    })),
    normalizeLeadType,
  );
  const bySource = aggregateTopLabels(
    sourceGroup.map((row) => ({
      value: row.source,
      count: row._count._all,
    })),
    normalizeLeadSource,
    10,
  );
  const byDecisionRole = aggregateNormalizedRows(
    decisionRoleGroup.map((row) => ({
      value: row.decisionRole,
      count: row._count._all,
    })),
    normalizeDecisionRole,
  );

  let byGroupCompany: { label: string; count: number }[] = [];
  if (scope.mode === 'holding') {
    const contacts = await prisma.prospectContact.findMany({
      where: contactWhere,
      select: { createdBy: { select: { companyId: true } } },
    });
    const countByCompany = new Map<string, number>();
    for (const c of contacts) {
      const cid = c.createdBy.companyId;
      countByCompany.set(cid, (countByCompany.get(cid) ?? 0) + 1);
    }
    if (countByCompany.size > 0) {
      const companies = await prisma.company.findMany({
        where: { id: { in: [...countByCompany.keys()] } },
        select: { id: true, name: true },
      });
      const nameById = new Map(companies.map((c) => [c.id, c.name]));
      byGroupCompany = sortDemographicRows(
        [...countByCompany.entries()].map(([companyId, count]) => ({
          label: nameById.get(companyId) ?? 'Entreprise inconnue',
          count,
        })),
      );
    }
  }

  return {
    total,
    byCivility,
    byActivitySector,
    byCompanyName,
    byGroupCompany,
    byLocation,
    byJobTitle,
    byLeadType,
    bySource,
    byDecisionRole,
  };
}
