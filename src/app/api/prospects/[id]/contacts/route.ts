import { getCurrentUser } from '@/lib/auth';
import {
  biimContactFieldsSchema,
  resolveBiimContactData,
  userBelongsToBiim,
} from '@/lib/biim-contact';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createContactSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    civility: z.string().optional(),
    jobTitle: z.string().optional(),
    decisionRole: z
      .enum([
        'DECIDEUR',
        'PRESCRIPTEUR',
        'INFLUENCEUR',
        'RELAI_INTERNE',
        'NON_DETERMINE',
      ])
      .optional(),
    negotiationStage: z
      .enum(['EN_PROSPECTION', 'VENTE_CONCLUE', 'VENTE_PERDUE'])
      .optional(),
    notes: z.string().optional(),
  })
  .merge(biimContactFieldsSchema);

/** POST /api/prospects/[id]/contacts — ajoute un contact (commerciale courante). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId } = await params;
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const body = createContactSchema.parse(await req.json());
    const isBiimUser = await userBelongsToBiim(user.companyId);
    const biimData = resolveBiimContactData(body, isBiimUser);
    const contact = await prisma.prospectContact.create({
      data: {
        prospectId,
        createdById: user.id,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        civility: body.civility?.trim() || null,
        jobTitle: body.jobTitle?.trim() || null,
        decisionRole: body.decisionRole ?? 'NON_DETERMINE',
        negotiationStage: body.negotiationStage ?? 'EN_PROSPECTION',
        notes: body.notes?.trim() || null,
        ...biimData,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await prisma.activity.create({
      data: {
        type: 'NOTE',
        relatedTo: prospectId,
        prospectId,
        contactId: contact.id,
        userId: user.id,
        content: `Contact ${contact.firstName} ${contact.lastName} ajouté sur « ${prospect.name} » par ${user.name}.`,
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_UPDATE,
      entityType: 'ProspectContact',
      entityId: contact.id,
      summary: `Ajout du contact ${contact.firstName} ${contact.lastName} sur ${prospect.name}`,
      metadata: { label: prospect.name, contactId: contact.id },
    });

    return NextResponse.json(
      { ...contact, canEdit: true, isMine: true },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('POST /api/prospects/[id]/contacts error', error);
    return NextResponse.json(
      { error: "Impossible d'ajouter le contact." },
      { status: 500 },
    );
  }
}
