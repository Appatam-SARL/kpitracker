import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { z } from 'zod';

const agendaStatusValues = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

const createAgendaSchema = z.object({
  prospectId: z.string().min(1).optional(),
  /** Alias rétrocompatibilité */
  leadId: z.string().min(1).optional(),
  contactId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().min(1),
  status: z.enum(agendaStatusValues).optional(),
}).refine((v) => Boolean(v.prospectId || v.leadId), {
  message: 'prospectId requis',
});

/** GET /api/agenda?prospectId= ou ?leadId= */
export async function GET(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(authUser);
    if (access !== true) return access;

    const url = new URL(req.url);
    const prospectId =
      url.searchParams.get('prospectId') || url.searchParams.get('leadId');

    if (!prospectId) {
      return NextResponse.json(
        { error: 'prospectId requis' },
        { status: 400 },
      );
    }

    const items = await prisma.agendaItem.findMany({
      where: { prospectId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/agenda error', error);
    return NextResponse.json(
      { error: "Impossible de récupérer l'agenda" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(authUser);
    if (access !== true) return access;

    const body = createAgendaSchema.parse(await req.json());
    const prospectId = body.prospectId || body.leadId!;

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, deletedAt: null },
      select: { id: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const item = await prisma.agendaItem.create({
      data: {
        prospectId,
        contactId: body.contactId || null,
        createdById: authUser.id,
        title: body.title,
        description: body.description,
        dueDate: new Date(body.dueDate),
        status: body.status ?? 'TODO',
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.AGENDA_CREATE,
      entityType: 'AgendaItem',
      entityId: item.id,
      summary: `Création agenda : ${item.title}`,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('POST /api/agenda error', error);
    return NextResponse.json(
      { error: "Impossible de créer l'élément d'agenda" },
      { status: 500 },
    );
  }
}
