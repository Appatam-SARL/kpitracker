import { getCurrentUser } from '@/lib/auth';
import { hasGroupCompanyScope } from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** GET : entreprises du groupe (kind GROUP) — rôles périmètre groupe uniquement. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!hasGroupCompanyScope(user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const companies = await prisma.company.findMany({
      where: { kind: 'GROUP' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('GET /api/companies/group error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les entreprises du groupe' },
      { status: 500 },
    );
  }
}
