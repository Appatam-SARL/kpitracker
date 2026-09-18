import { getCurrentUser } from '@/lib/auth';
import { resolveDashboardScope } from '@/lib/dashboard-company-scope';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RECENT_LEADS_LIMIT = 8;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get('companyId');
    const scope = await resolveDashboardScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;

    const leads = await prisma.prospect.findMany({
      where: scope.prospectWhere,
      orderBy: { createdAt: 'desc' },
      take: RECENT_LEADS_LIMIT,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        leadType: true,
        activitySector: true,
        location: true,
        websiteUrl: true,
        createdAt: true,
        _count: {
          select: {
            contacts: { where: scope.contactWhere },
          },
        },
      },
    });

    const result = leads.map((l) => ({
      id: l.id,
      companyName: l.name,
      logoUrl: l.logoUrl,
      leadType: l.leadType,
      activitySector: l.activitySector,
      location: l.location,
      websiteUrl: l.websiteUrl,
      contactsCount: l._count.contacts,
      createdAt: l.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/dashboard/recent-leads error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
