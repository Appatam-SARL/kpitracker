import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { normalizeProspectName } from '@/lib/prospect-name';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/prospects/search?q= — recherche anti-doublon obligatoire. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    if (q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const normalized = normalizeProspectName(q);
    const items = await prisma.prospect.findMany({
      where: {
        deletedAt: null,
        OR: [
          { nameNormalized: { contains: normalized } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20,
      select: {
        id: true,
        name: true,
        nameNormalized: true,
        leadType: true,
        activitySector: true,
        status: true,
        location: true,
        _count: {
          select: { contacts: { where: { deletedAt: null } } },
        },
      },
    });

    const exact = items.find((i) => i.nameNormalized === normalized);
    return NextResponse.json({
      items: items.map(({ _count, nameNormalized: _n, ...rest }) => ({
        ...rest,
        contactsCount: _count.contacts,
      })),
      exactMatch: exact
        ? {
            id: exact.id,
            name: exact.name,
            contactsCount: exact._count.contacts,
          }
        : null,
    });
  } catch (error) {
    console.error('GET /api/prospects/search error', error);
    return NextResponse.json(
      { error: 'Impossible de rechercher les prospects.' },
      { status: 500 },
    );
  }
}
