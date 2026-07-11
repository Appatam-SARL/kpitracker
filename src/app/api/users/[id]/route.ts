import { canViewUserProfile, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** GET : fiche utilisateur par id — admin/manager (même société) ou rôles groupe (sociétés du groupe). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await params;

    if (id === currentUser.id) {
      const self = await prisma.user.findUnique({
        where: { id },
        include: { company: { select: { id: true, name: true } } },
      });
      if (!self) {
        return NextResponse.json(
          { error: 'Utilisateur introuvable' },
          { status: 404 },
        );
      }
      return NextResponse.json(self);
    }

    const target = await prisma.user.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 },
      );
    }

    const viewAllowed = await canViewUserProfile(currentUser, target.companyId);
    if (viewAllowed !== true) return viewAllowed;

    return NextResponse.json(target);
  } catch (error) {
    console.error('GET /api/users/[id] error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer l\'utilisateur' },
      { status: 500 },
    );
  }
}
