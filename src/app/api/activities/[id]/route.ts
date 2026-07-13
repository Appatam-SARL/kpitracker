import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import {
  appendMeetingReport,
  buildMeetingContent,
  parseMeetingContent,
  parseMeetingTitle,
} from "@/lib/meeting-content";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("reschedule"),
    date: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    title: z.string().min(1),
    location: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("add_report"),
    report: z.string().min(1),
  }),
]);

/** Compat : ancien body `{ date, reason? }` sans `action` = report. */
function normalizePatchBody(json: unknown) {
  if (
    json &&
    typeof json === "object" &&
    !("action" in json) &&
    "date" in json &&
    typeof (json as { date: unknown }).date === "string"
  ) {
    return {
      action: "reschedule" as const,
      date: (json as { date: string }).date,
      reason: (json as { reason?: string }).reason,
    };
  }
  return json;
}

async function loadMeetingForUser(
  id: string,
  companyId: string | null | undefined,
) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, companyId: true } },
      agendaItem: { select: { id: true } },
    },
  });

  if (!activity) {
    return { error: NextResponse.json({ error: "Activité introuvable" }, { status: 404 }) };
  }
  if (activity.type !== "MEETING") {
    return {
      error: NextResponse.json(
        { error: "Action réservée aux rendez-vous" },
        { status: 400 },
      ),
    };
  }
  if (!activity.lead) {
    return {
      error: NextResponse.json(
        { error: "Prospect associé introuvable" },
        { status: 404 },
      ),
    };
  }
  if (!companyId || activity.lead.companyId !== companyId) {
    return {
      error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    };
  }
  return { activity };
}

/** PATCH /api/activities/[id] - Report, modification ou rapport d'échange (MEETING) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(["ADMIN", "MANAGER", "AGENT"]);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  try {
    const { id } = await params;
    const json = normalizePatchBody(await req.json());
    const body = patchSchema.parse(json);

    const loaded = await loadMeetingForUser(id, user.companyId);
    if ("error" in loaded) return loaded.error;
    const { activity } = loaded;

    if (body.action === "reschedule") {
      return handleReschedule(id, activity, user, body.date, body.reason);
    }
    if (body.action === "update") {
      return handleUpdate(id, activity, user, body);
    }
    return handleAddReport(id, activity, user, body.report);
  } catch (error) {
    console.error("PATCH /api/activities/[id] error", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour le rendez-vous" },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

type AuthUserLite = { id: string; companyId: string | null; name?: string };
type MeetingActivity = NonNullable<
  Awaited<ReturnType<typeof loadMeetingForUser>>["activity"]
>;

async function handleReschedule(
  id: string,
  activity: MeetingActivity,
  user: AuthUserLite,
  dateStr: string,
  reasonRaw?: string,
) {
  const newDate = new Date(dateStr);
  if (Number.isNaN(newDate.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  if (activity.date.getTime() === newDate.getTime()) {
    return NextResponse.json(
      { error: "La nouvelle date doit être différente de la date actuelle" },
      { status: 400 },
    );
  }

  const reason = reasonRaw?.trim() || null;
  const previousDate = activity.date;
  const meetingTitle = parseMeetingTitle(activity.content);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.meetingReschedule.create({
      data: {
        activityId: id,
        previousDate,
        newDate,
        reason,
        changedById: user.id,
      },
    });

    const nextActivity = await tx.activity.update({
      where: { id },
      data: { date: newDate },
      include: {
        user: { select: { name: true } },
        _count: { select: { reschedules: true } },
      },
    });

    if (activity.agendaItem) {
      await tx.agendaItem.update({
        where: { id: activity.agendaItem.id },
        data: {
          dueDate: newDate,
          ...(reason
            ? {
                description: [activity.content, `Reporté : ${reason}`].join(
                  "\n\n",
                ),
              }
            : {}),
        },
      });
    } else if (activity.leadId) {
      await tx.agendaItem.create({
        data: {
          leadId: activity.leadId,
          createdById: user.id,
          activityId: id,
          title: `RDV : ${meetingTitle}`,
          description: reason
            ? `${activity.content}\n\nReporté : ${reason}`
            : activity.content,
          dueDate: newDate,
          status: "TODO",
        },
      });
    }

    return nextActivity;
  });

  await logUserAction({
    user,
    action: USER_ACTION_CODES.ACTIVITY_RESCHEDULE,
    entityType: "Activity",
    entityId: updated.id,
    summary: `Report d'un rendez-vous`,
    metadata: {
      leadId: activity.leadId,
      previousDate: previousDate.toISOString(),
      newDate: newDate.toISOString(),
      reason,
    },
  });

  const { _count, ...activityPayload } = updated;
  return NextResponse.json({
    ...activityPayload,
    rescheduleCount: _count?.reschedules ?? 1,
  });
}

async function handleUpdate(
  id: string,
  activity: MeetingActivity,
  user: AuthUserLite,
  body: { title: string; location?: string; notes?: string },
) {
  const parsed = parseMeetingContent(activity.content);
  const content = buildMeetingContent({
    title: body.title.trim(),
    location: body.location?.trim() || "",
    notes: body.notes?.trim() || "",
    reports: parsed.reports,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const nextActivity = await tx.activity.update({
      where: { id },
      data: { content },
      include: {
        user: { select: { name: true } },
        _count: { select: { reschedules: true } },
      },
    });

    if (activity.agendaItem) {
      await tx.agendaItem.update({
        where: { id: activity.agendaItem.id },
        data: {
          title: `RDV : ${body.title.trim()}`,
          description: content,
        },
      });
    }

    return nextActivity;
  });

  await logUserAction({
    user,
    action: USER_ACTION_CODES.ACTIVITY_UPDATE,
    entityType: "Activity",
    entityId: updated.id,
    summary: `Modification d'un rendez-vous`,
    metadata: { leadId: activity.leadId, title: body.title.trim() },
  });

  const { _count, ...activityPayload } = updated;
  return NextResponse.json({
    ...activityPayload,
    rescheduleCount: _count?.reschedules ?? 0,
  });
}

async function handleAddReport(
  id: string,
  activity: MeetingActivity,
  user: AuthUserLite & { name: string },
  report: string,
) {
  const content = appendMeetingReport(activity.content, report, user.name);

  const updated = await prisma.$transaction(async (tx) => {
    const nextActivity = await tx.activity.update({
      where: { id },
      data: { content },
      include: {
        user: { select: { name: true } },
        _count: { select: { reschedules: true } },
      },
    });

    if (activity.agendaItem) {
      await tx.agendaItem.update({
        where: { id: activity.agendaItem.id },
        data: { description: content },
      });
    }

    return nextActivity;
  });

  await logUserAction({
    user,
    action: USER_ACTION_CODES.ACTIVITY_REPORT,
    entityType: "Activity",
    entityId: updated.id,
    summary: `Ajout d'un rapport d'échange sur un rendez-vous`,
    metadata: { leadId: activity.leadId },
  });

  const { _count, ...activityPayload } = updated;
  return NextResponse.json({
    ...activityPayload,
    rescheduleCount: _count?.reschedules ?? 0,
  });
}
