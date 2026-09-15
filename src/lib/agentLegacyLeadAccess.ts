import { prisma } from '@/lib/prisma';
import { activeOnlyWhere } from '@/lib/trash';

/**
 * Accès legacy agents — le pool Prospect GROUP est partagé.
 * Les helpers historiques basés sur Lead.assignedTo restent en stubs compatibles.
 */

export async function getLegacyUnassignedLeadIdsForAgent(
  _companyId: string,
  _agentUserId: string,
): Promise<string[]> {
  return [];
}

export async function agentCanAccessUnassignedLegacyLead(
  _leadId: string,
  _companyId: string,
  _agentUserId: string,
): Promise<boolean> {
  return false;
}

/** Prospects ayant au moins une activité depuis cutoff. */
export async function getLeadIdsWithActivitySinceInCompany(
  _companyId: string | { in: string[] },
  cutoff: Date,
): Promise<string[]> {
  const rows = await prisma.activity.findMany({
    where: {
      date: { gte: cutoff },
      prospectId: { not: null },
    },
    select: { prospectId: true },
    distinct: ['prospectId'],
  });
  return rows
    .map((r) => r.prospectId)
    .filter((id): id is string => Boolean(id));
}

/** PATCH/DELETE: tout AGENT GROUP peut intervenir sur un prospect actif. */
export async function agentCanModifyLead(
  prospectId: string,
  _companyId: string,
  _agentUserId: string,
): Promise<boolean> {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, ...activeOnlyWhere },
    select: { id: true },
  });
  return Boolean(prospect);
}
