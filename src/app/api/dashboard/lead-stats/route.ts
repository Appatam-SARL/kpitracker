import { getCurrentUser } from '@/lib/auth';
import { resolveDashboardScope } from '@/lib/dashboard-company-scope';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get('companyId');
    const scope = await resolveDashboardScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;

    const [total, converted, contacts] = await Promise.all([
      prisma.prospect.count({ where: scope.prospectWhere }),
      prisma.prospectContact.count({
        where: {
          ...scope.contactWhere,
          negotiationStage: 'VENTE_CONCLUE',
        },
      }),
      prisma.prospectContact.count({ where: scope.contactWhere }),
    ]);

    const conversionRate =
      contacts > 0 ? Math.round((converted / contacts) * 1000) / 10 : 0;

    return NextResponse.json({
      total,
      converted,
      conversionRate,
      contacts,
    });
  } catch (error) {
    console.error('GET /api/dashboard/lead-stats error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
