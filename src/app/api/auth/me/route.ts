import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/** GET /api/auth/me - Retourne les infos de l'utilisateur connecté */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("auth_session")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            plan: true,
            kind: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const u = user as { mfaEnabled?: boolean; mfaSecret?: string | null };
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: u.mfaEnabled ?? false,
      mfaSetupPending: !!u.mfaSecret && !u.mfaEnabled,  
      company: user.company,
    });
  } catch (error) {
    console.error("GET /api/auth/me error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
