import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { prisma } from "@/lib/prisma";
import speakeasy from "speakeasy";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

/**
 * POST /api/profile/mfa/verify
 * Vérifie le code OTP saisi par l'utilisateur et active le MFA si le code est valide.
 */
export async function POST(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const json = await req.json();
    const body = verifySchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, mfaSecret: true, mfaEnabled: true },
    });

    if (!user?.mfaSecret) {
      return NextResponse.json(
        { error: "Aucune configuration MFA en attente. Lancez d'abord l'étape de configuration." },
        { status: 400 }
      );
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "Le MFA est déjà activé." },
        { status: 400 }
      );
    }

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token: body.code,
      window: 1,
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Code invalide ou expiré. Réessayez avec un code à 6 chiffres." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: authUser.id },
      data: { mfaEnabled: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        mfaEnabled: true,
        company: { select: { id: true, name: true } },
      },
    });

    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.AUTH_MFA_VERIFY,
      entityType: 'User',
      entityId: authUser.id,
      summary: 'Vérification et activation du MFA',
    });

    return NextResponse.json({
      ok: true,
      message: "MFA activé avec succès.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Le code doit être composé de 6 chiffres." },
        { status: 400 }
      );
    }
    console.error("POST /api/profile/mfa/verify error", error);
    return NextResponse.json(
      { error: "Impossible de vérifier le code" },
      { status: 500 }
    );
  }
}
