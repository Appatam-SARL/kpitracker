import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'NOTE'] as const;

const createActivitySchema = z
  .object({
    prospectId: z.string().min(1).optional(),
    leadId: z.string().min(1).optional(),
    contactId: z.string().optional(),
    type: z.enum(ACTIVITY_TYPES),
    content: z.string().min(1),
    date: z.string().optional(),
  })
  .refine((v) => Boolean(v.prospectId || v.leadId), {
    message: 'prospectId requis',
  });

export async function GET(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER', 'AGENT']);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  try {
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const url = new URL(req.url);
    const prospectId =
      url.searchParams.get('prospectId') || url.searchParams.get('leadId');
    const contactId = url.searchParams.get('contactId');

    if (!prospectId) {
      return NextResponse.json(
        { error: 'prospectId requis' },
        { status: 400 },
      );
    }

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

    const activities = await prisma.activity.findMany({
      where: {
        prospectId,
        ...(contactId
          ? {
              OR: [
                { contactId },
                { contactId: null, userId: user.id },
              ],
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error('GET /api/activities error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les activités' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER', 'AGENT']);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  try {
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const body = createActivitySchema.parse(await req.json());
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

    const activity = await prisma.activity.create({
      data: {
        type: body.type,
        relatedTo: prospectId,
        prospectId,
        contactId: body.contactId || null,
        userId: user.id,
        content: body.content,
        date: body.date ? new Date(body.date) : undefined,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.ACTIVITY_CREATE,
      entityType: 'Activity',
      entityId: activity.id,
      summary: `Activité ${body.type} sur prospect`,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('POST /api/activities error', error);
    return NextResponse.json(
      { error: "Impossible de créer l'activité" },
      { status: 500 },
    );
  }
}
