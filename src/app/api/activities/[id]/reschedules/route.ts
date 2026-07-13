import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/** GET /api/activities/[id]/reschedules - Historique des reports d'un rendez-vous */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "MANAGER", "AGENT"]);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  try {
    const { id } = await params;

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, companyId: true } },
      },
    });

    if (!activity) {
      return NextResponse.json(
        { error: "Activité introuvable" },
        { status: 404 },
      );
    }

    if (activity.type !== "MEETING") {
      return NextResponse.json(
        { error: "Historique disponible uniquement pour les rendez-vous" },
        { status: 400 },
      );
    }

    if (!activity.lead) {
      return NextResponse.json(
        { error: "Prospect associé introuvable" },
        { status: 404 },
      );
    }

    if (!user.companyId || activity.lead.companyId !== user.companyId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const reschedules = await prisma.meetingReschedule.findMany({
      where: { activityId: id },
      orderBy: { createdAt: "desc" },
      include: {
        changedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(reschedules);
  } catch (error) {
    console.error("GET /api/activities/[id]/reschedules error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer l'historique des reports" },
      { status: 500 },
    );
  }
}
