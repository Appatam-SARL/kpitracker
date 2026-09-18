import { getCurrentUser } from '@/lib/auth';
import { resolveDashboardContactWhere } from '@/lib/dashboard-company-scope';
import { NEGOTIATION_STAGE_ORDER } from '@/config/negotiation-stage';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type StatusKey = (typeof NEGOTIATION_STAGE_ORDER)[number];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get('companyId');
    const contactWhere = await resolveDashboardContactWhere(
      user,
      companyIdParam,
    );
    if (contactWhere instanceof NextResponse) return contactWhere;

    const group = await prisma.prospectContact.groupBy({
      by: ['negotiationStage'],
      where: contactWhere,
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      NEGOTIATION_STAGE_ORDER.map((status) => [status, 0]),
    ) as Record<StatusKey, number>;

    for (const row of group) {
      const key = row.negotiationStage as StatusKey;
      if (key in counts) {
        counts[key] = row._count._all;
      }
    }

    return NextResponse.json(
      NEGOTIATION_STAGE_ORDER.map((status) => ({
        status,
        count: counts[status],
      })),
    );
  } catch (error) {
    console.error('GET /api/dashboard/lead-status-distribution error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
