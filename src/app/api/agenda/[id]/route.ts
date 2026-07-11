import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { z } from "zod";

const agendaStatusValues = ["TODO", "IN_PROGRESS", "DONE"] as const;

const updateSchema = z.object({
  status: z.enum(agendaStatusValues),
});

/** PATCH /api/agenda/[id] - Met à jour le statut d'un élément d'agenda */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;
    const json = await req.json();
    const body = updateSchema.parse(json);

    const existing = await prisma.agendaItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Élément d'agenda introuvable" },
        { status: 404 },
      );
    }

    const updated = await prisma.agendaItem.update({
      where: { id },
      data: { status: body.status },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.AGENDA_UPDATE,
      entityType: 'AgendaItem',
      entityId: updated.id,
      summary: `Mise à jour agenda : ${updated.title} (${body.status})`,
      metadata: { label: updated.title, status: body.status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/agenda/[id] error", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour l'agenda" },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

