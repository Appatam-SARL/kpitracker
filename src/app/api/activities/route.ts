import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { parseMeetingTitle } from "@/lib/meeting-content";

const ACTIVITY_TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "NOTE"] as const;

const createActivitySchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES),
  content: z.string().min(1),
  // Optionnel : pour les rendez-vous, permet de fixer la date/heure
  // On accepte ici n'importe quelle chaîne (ex: valeur de <input type=\"datetime-local\" />)
  // et on la convertit ensuite en Date côté serveur.
  date: z.string().optional(),
});

/** GET /api/activities?leadId=xxx - Liste les activités d'un lead */
export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "MANAGER", "AGENT"]);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json({ error: "leadId requis" }, { status: 400 });
    }

    // Multi-tenant: on vérifie que le lead appartient à l'entreprise de l'utilisateur.
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, companyId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }
    if (!user.companyId || lead.companyId !== user.companyId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const activities = await prisma.activity.findMany({
      where: { leadId },
      orderBy: { date: "desc" },
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("GET /api/activities error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les activités" },
      { status: 500 }
    );
  }
}

/** POST /api/activities - Crée une interaction */
export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "MANAGER", "AGENT"]);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  try {
    const json = await req.json();
    const body = createActivitySchema.parse(json);

    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      select: { id: true, companyId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    if (!user.companyId || lead.companyId !== user.companyId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const meetingDate = body.date ? new Date(body.date) : undefined;
    if (
      body.type === "MEETING" &&
      meetingDate &&
      Number.isNaN(meetingDate.getTime())
    ) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }

    const activity = await prisma.activity.create({
      data: {
        type: body.type,
        relatedTo: "LEAD",
        leadId: body.leadId,
        userId: user.id,
        content: body.content,
        date: meetingDate,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    // Synchronise le calendrier agenda pour chaque rendez-vous
    if (body.type === "MEETING") {
      const dueDate = meetingDate ?? activity.date;
      const title = parseMeetingTitle(body.content);
      try {
        const agendaItem = await prisma.agendaItem.create({
          data: {
            leadId: body.leadId,
            createdById: user.id,
            activityId: activity.id,
            title: `RDV : ${title}`,
            description: body.content,
            dueDate,
            status: "TODO",
          },
        });
        await logUserAction({
          user,
          action: USER_ACTION_CODES.AGENDA_CREATE,
          entityType: "AgendaItem",
          entityId: agendaItem.id,
          summary: `Création agenda liée au rendez-vous : ${title}`,
          metadata: {
            label: title,
            leadId: body.leadId,
            activityId: activity.id,
          },
        });
      } catch (e) {
        console.error("Erreur création AgendaItem pour rendez-vous", e);
      }
    }

    await logUserAction({
      user,
      action: USER_ACTION_CODES.ACTIVITY_CREATE,
      entityType: "Activity",
      entityId: activity.id,
      summary: `Ajout d'une interaction (${body.type}) sur un prospect`,
      metadata: { label: body.type, leadId: body.leadId },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("POST /api/activities error", error);
    return NextResponse.json(
      { error: "Impossible de créer l'activité" },
      { status: error instanceof z.ZodError ? 400 : 500 }
    );
  }
}
