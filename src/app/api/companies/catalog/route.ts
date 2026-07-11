import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const companies = await prisma.company.findMany({
      where: { kind: 'GROUP' },
      orderBy: { name: 'asc' },
      include: {
        products: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
        services: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error('GET /api/companies/catalog error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer le catalogue des entreprises' },
      { status: 500 },
    );
  }
}
