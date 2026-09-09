import {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_TTL_MS,
} from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { sendResetPasswordEmail } from '@/lib/reset-password-email';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const GENERIC_OK = {
  ok: true,
  message:
    "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.",
};

/** POST /api/forgot-password - Envoie un lien de réinitialisation si le compte existe. */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { email } = forgotPasswordSchema.parse(json);

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: { select: { name: true } },
      },
    });

    if (!user) {
      return NextResponse.json(GENERIC_OK);
    }

    const recent = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS) },
      },
      select: { id: true },
    });

    if (recent) {
      return NextResponse.json(GENERIC_OK);
    }

    const token = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    try {
      await sendResetPasswordEmail({
        recipientName: user.name,
        recipientEmail: user.email,
        companyName: user.company?.name,
        resetUrl: buildPasswordResetUrl(token),
      });
    } catch (emailError) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
      throw emailError;
    }

    return NextResponse.json(GENERIC_OK);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 },
      );
    }

    console.error('POST /api/forgot-password error', error);
    const smtpMissing =
      error instanceof Error && error.message.includes('SMTP');
    return NextResponse.json(
      {
        error: smtpMissing
          ? "L'envoi d'e-mails n'est pas configuré. Contactez l'administrateur."
          : "Impossible d'envoyer le lien de réinitialisation.",
      },
      { status: 500 },
    );
  }
}
