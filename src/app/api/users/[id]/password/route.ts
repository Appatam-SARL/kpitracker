import { canSetTeamMemberPassword, requireRole, type Role } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const setPasswordSchema = z.object({
  password: z.string().min(6),
});

/** PATCH /api/users/[id]/password — DG / admin : mot de passe d'un membre de l'équipe. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await params;
    const json = await req.json();
    const { password } = setPasswordSchema.parse(json);

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        companyId: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!target || target.deletedAt) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 },
      );
    }

    const allowed = canSetTeamMemberPassword(currentUser, {
      id: target.id,
      companyId: target.companyId,
      role: target.role as Role,
    });
    if (allowed !== true) return allowed;

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
        },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: target.id },
      }),
    ]);

    await logUserAction({
      user: currentUser,
      action: USER_ACTION_CODES.USER_PASSWORD_SET,
      entityType: 'User',
      entityId: target.id,
      summary: `Modification du mot de passe de ${target.name}`,
      metadata: { label: target.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            'Mot de passe invalide. Il doit contenir au moins 6 caractères.',
        },
        { status: 400 },
      );
    }

    console.error('PATCH /api/users/[id]/password error', error);
    return NextResponse.json(
      { error: 'Impossible de modifier le mot de passe.' },
      { status: 500 },
    );
  }
}
