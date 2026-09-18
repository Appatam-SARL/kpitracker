import { getCurrentUser } from '@/lib/auth';
import { resolveDashboardContactWhere } from '@/lib/dashboard-company-scope';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const RECENT_CONTACTS_LIMIT = 10;

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

    const contacts = await prisma.prospectContact.findMany({
      where: {
        ...contactWhere,
        prospect: { deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_CONTACTS_LIMIT,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        negotiationStage: true,
        createdAt: true,
        prospectId: true,
        prospect: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const result = contacts.map((c) => {
      const contactName = [c.firstName, c.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      return {
        id: c.id,
        contactId: c.id,
        prospectId: c.prospectId,
        companyName: c.prospect.name,
        contactName: contactName || null,
        email: c.email,
        phone: c.phone,
        status: c.negotiationStage,
        createdAt: c.createdAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/dashboard/recent-contacts error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
