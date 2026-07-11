import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

/** PATCH /api/profile - Met à jour le profil de l'utilisateur connecté (nom/email uniquement). */
export async function PATCH(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const json = await req.json();
    const body = updateProfileSchema.parse(json);

    if (!body.name && !body.email) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: authUser.id },
      data: {
        name: body.name ?? undefined,
        email: body.email ?? undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company: {
          select: { id: true, name: true },
        },
      },
    });

    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.PROFILE_UPDATE,
      entityType: 'User',
      entityId: authUser.id,
      summary: 'Mise à jour du profil (nom ou email)',
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/profile error", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour le profil" },
      { status: 500 }
    );
  }
}

