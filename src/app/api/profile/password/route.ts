import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

/** PATCH /api/profile/password - Change le mot de passe de l'utilisateur connecté. */
export async function PATCH(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const json = await req.json();
    const body = changePasswordSchema.parse(json);

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (!(await verifyPassword(body.currentPassword, user.password))) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(body.newPassword);

    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    });
    const res = NextResponse.json({ ok: true });
    res.cookies.set("must_change_password", "0", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.AUTH_PASSWORD_CHANGE,
      entityType: 'User',
      entityId: authUser.id,
      summary: 'Modification du mot de passe',
    });
    return res;
  } catch (error) {
    console.error("PATCH /api/profile/password error", error);
    return NextResponse.json(
      { error: "Impossible de changer le mot de passe" },
      { status: 500 }
    );
  }
}

