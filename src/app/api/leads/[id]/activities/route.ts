import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id } = await params;
    const activities = await prisma.activity.findMany({
      where: { prospectId: id },
      orderBy: { date: 'desc' },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json(activities);
  } catch (error) {
    console.error('GET lead activities error', error);
    return NextResponse.json({ error: 'Erreur' }, { status: 500 });
  }
}
