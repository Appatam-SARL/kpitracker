import { buildLeadsExportBuffer } from '@/lib/lead-import-excel';
import { formatLeadTypeLabel } from '@/lib/lead-type';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, resolveGroupCompanyScope } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { hasGroupCompanyScope, prismaCompanyScopeFilter } from '@/lib/group-scope-roles';
import { activeOnlyWhere } from '@/lib/trash';
import { getLegacyUnassignedLeadIdsForAgent } from '@/lib/agentLegacyLeadAccess';
import type { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('companyId');

    let companyScope: { companyId: string | { in: string[] } } = {
      companyId: user.companyId,
    };
    if (hasGroupCompanyScope(user.role)) {
      const scope = await resolveGroupCompanyScope(user, companyIdParam);
      if (scope instanceof NextResponse) return scope;
      companyScope = prismaCompanyScopeFilter(scope);
    }

    const where: Prisma.LeadWhereInput = { ...companyScope, ...activeOnlyWhere };
    if (user.role === 'AGENT') {
      const legacyIds = await getLegacyUnassignedLeadIdsForAgent(
        user.companyId,
        user.id,
      );
      where.OR = [
        { assignedTo: user.id },
        ...(legacyIds.length ? [{ id: { in: legacyIds } }] : []),
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        source: true,
        companyName: true,
        jobTitle: true,
        activitySector: true,
        leadType: true,
        activityDomains: {
          select: { domain: true },
          orderBy: { domain: 'asc' },
        },
        location: true,
        civility: true,
        notes: true,
      },
    });

    const buffer = await buildLeadsExportBuffer(
      leads.map((lead) => ({
        ...lead,
        leadType: formatLeadTypeLabel(lead.leadType),
        activityDomains: lead.activityDomains.map((d) => d.domain),
      })),
    );
    const dateStr = new Date().toISOString().slice(0, 10);

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_EXPORT,
      summary: `Export Excel de ${leads.length} prospect(s)`,
      metadata: { count: leads.length },
    });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="leads-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/leads/export error', error);
    return NextResponse.json(
      { error: "Impossible d'exporter les leads" },
      { status: 500 },
    );
  }
}
