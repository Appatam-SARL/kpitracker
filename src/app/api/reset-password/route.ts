import { hashPassword } from '@/lib/password';
import { hashPasswordResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { sessionCookieOptions } from '@/lib/session-cookies';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(6),
});

async function findValidResetToken(rawToken: string) {
  const tokenHash = hashPasswordResetToken(rawToken);
  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
      user: { deletedAt: null },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: { id: true, companyId: true },
      },
    },
  });
}

/** GET /api/reset-password?token= - Vérifie qu'un jeton est encore valide. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  try {
    const record = await findValidResetToken(token);
    return NextResponse.json({ valid: Boolean(record) });
  } catch (error) {
    console.error('GET /api/reset-password error', error);
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}

/** POST /api/reset-password - Définit le nouveau mot de passe via le jeton e-mail. */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { token, password } = resetPasswordSchema.parse(json);

    const record = await findValidResetToken(token);
    if (!record) {
      return NextResponse.json(
        { error: 'Lien invalide ou expiré. Demandez un nouveau lien.' },
        { status: 400 },
      );
    }

    const hashedPassword = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          mustChangePassword: false,
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: record.userId,
          usedAt: null,
          id: { not: record.id },
        },
      }),
    ]);

    await logUserAction({
      user: { id: record.user.id, companyId: record.user.companyId },
      action: USER_ACTION_CODES.AUTH_PASSWORD_RESET,
      entityType: 'User',
      entityId: record.user.id,
      summary: 'Réinitialisation du mot de passe',
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(
      'must_change_password',
      '0',
      sessionCookieOptions(60 * 60 * 24 * 7),
    );
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides. Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 },
      );
    }

    console.error('POST /api/reset-password error', error);
    return NextResponse.json(
      { error: 'Impossible de réinitialiser le mot de passe.' },
      { status: 500 },
    );
  }
}
