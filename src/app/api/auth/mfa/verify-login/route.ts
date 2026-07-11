import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import speakeasy from "speakeasy";
import { z } from "zod";

const verifySchema = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

/**
 * POST /api/auth/mfa/verify-login
 * Vérifie le code OTP après login (cookie mfa_pending).
 * Si valide : pose auth_session + auth_role, supprime mfa_pending, retourne { ok: true }.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("mfa_pending")?.value;

    if (!userId) {
      return NextResponse.json(
        { error: "Session MFA expirée. Reconnectez-vous." },
        { status: 401 }
      );
    }

    const json = await req.json();
    const body = verifySchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        mfaEnabled: true,
        mfaSecret: true,
        mustChangePassword: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(
        { error: "Session MFA expirée. Reconnectez-vous." },
        { status: 401 }
      );
    }

    const u = user as { mfaSecret?: string | null };
    if (!u.mfaSecret || !user.mfaEnabled) {
      return NextResponse.json(
        { error: "Configuration MFA invalide." },
        { status: 400 }
      );
    }

    const valid = speakeasy.totp.verify({
      secret: u.mfaSecret,
      encoding: "base32",
      token: body.code,
      window: 1,
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Code invalide ou expiré. Réessayez." },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set("mfa_pending", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    res.cookies.set("auth_session", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    res.cookies.set("auth_role", user.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("must_change_password", user.mustChangePassword ? "1" : "0", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    await logUserAction({
      user: { id: user.id, companyId: user.companyId },
      action: USER_ACTION_CODES.AUTH_LOGIN,
      summary: 'Connexion au CRM (MFA validé)',
    });

    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Le code doit être composé de 6 chiffres." },
        { status: 400 }
      );
    }
    console.error("POST /api/auth/mfa/verify-login error", error);
    return NextResponse.json(
      { error: "Impossible de vérifier le code" },
      { status: 500 }
    );
  }
}
