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
  normalizeJobTitle,
  normalizeLocation,
  sortDemographicRows,
  sumDemographicRows,
} from '@/lib/lead-demographics';
import { prisma } from '@/lib/prisma';
import { activeOnlyWhere } from '@/lib/trash';
import type { Prisma } from '@prisma/client';

export type LeadDemographicsResponse = {
  total: number;
  byCivility: { label: string; count: number }[];
  byActivitySector: { label: string; count: number }[];
  /** Nom de la société du prospect (champ lead.companyName). */
  byCompanyName: { label: string; count: number }[];
  /** Prospects par filiale CRM (lead.companyId) — périmètre holding uniquement. */
  byGroupCompany: { label: string; count: number }[];
  byLocation: { label: string; count: number }[];
  byJobTitle: { label: string; count: number }[];
};

export async function buildLeadDemographicsReport(
  scope: ResolvedGroupCompanyScope,
  userId?: string,
): Promise<LeadDemographicsResponse> {
  let where: Prisma.LeadWhereInput = {
    ...prismaCompanyScopeFilter(scope),
    ...activeOnlyWhere,
  };

  if (userId?.trim()) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { companyId: true },
    });
    if (!targetUser || !userCompanyInScope(targetUser.companyId, scope)) {
      throw new Error('Commercial introuvable ou autre entreprise');
    }
    where.assignedTo = userId.trim();
  }

  const [
    civilityGroup,
    sectorGroup,
    companyGroup,
    locationGroup,
    jobTitleGroup,
    total,
  ] = await Promise.all([
    prisma.lead.groupBy({
      by: ['civility'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['activitySector'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['companyName'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['location'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ['jobTitle'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.count({ where }),
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
      value: row.companyName,
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

  let byGroupCompany: { label: string; count: number }[] = [];
  if (scope.mode === 'holding') {
    const filialeGroup = await prisma.lead.groupBy({
      by: ['companyId'],
      where,
      _count: { _all: true },
    });
    if (filialeGroup.length > 0) {
      const companies = await prisma.company.findMany({
        where: { id: { in: filialeGroup.map((row) => row.companyId) } },
        select: { id: true, name: true },
      });
      const nameById = new Map(companies.map((c) => [c.id, c.name]));
      byGroupCompany = sortDemographicRows(
        filialeGroup.map((row) => ({
          label: nameById.get(row.companyId) ?? 'Entreprise inconnue',
          count: row._count._all,
        })),
      );
    }
  }

  const payload: LeadDemographicsResponse = {
    total,
    byCivility: sortDemographicRows(byCivility),
    byActivitySector: sortDemographicRows(byActivitySector),
    byCompanyName: sortDemographicRows(byCompanyName),
    byGroupCompany,
    byLocation: sortDemographicRows(byLocation),
    byJobTitle: sortDemographicRows(byJobTitle),
  };

  if (total > 0) {
    const sumCiv = sumDemographicRows(payload.byCivility);
    const sumSector = sumDemographicRows(payload.byActivitySector);
    const sumCo = sumDemographicRows(payload.byCompanyName);
    const sumLoc = sumDemographicRows(payload.byLocation);
    const sumJob = sumDemographicRows(payload.byJobTitle);
    if (
      sumCiv !== total ||
      sumSector !== total ||
      sumCo !== total ||
      sumLoc !== total ||
      sumJob !== total
    ) {
      console.warn('lead-demographics: sum mismatch', {
        total,
        sumCiv,
        sumSector,
        sumCo,
        sumLoc,
        sumJob,
      });
    }
  }

  return payload;
}
