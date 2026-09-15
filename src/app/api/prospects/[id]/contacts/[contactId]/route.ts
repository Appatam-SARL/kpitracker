import { getCurrentUser } from '@/lib/auth';
import {
  biimContactFieldsSchema,
  resolveBiimContactData,
  userBelongsToBiim,
} from '@/lib/biim-contact';
import { normalizeBiimDocuments } from '@/config/biim-contact-fields';
import {
  canManageContact,
  canViewContactFiche,
  requireGroupProspectsAccess,
} from '@/lib/prospect-access';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateContactSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    civility: z.string().optional().nullable(),
    jobTitle: z.string().optional().nullable(),
    decisionRole: z
      .enum([
        'DECIDEUR',
        'PRESCRIPTEUR',
        'INFLUENCEUR',
        'RELAI_INTERNE',
        'NON_DETERMINE',
      ])
      .optional()
      .nullable(),
    notes: z.string().optional().nullable(),
    negotiationStage: z
      .enum(['EN_PROSPECTION', 'VENTE_CONCLUE', 'VENTE_PERDUE'])
      .optional(),
  })
  .merge(biimContactFieldsSchema);

/**
 * GET — fiche de prospection d'un contact (forme compatible ancien détail lead).
 * Intérêts = ceux du commercial propriétaire du contact (soi-même si c'est le sien).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId, contactId } = await params;
    const contact = await prisma.prospectContact.findFirst({
      where: { id: contactId, prospectId, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, companyId: true },
        },
        prospect: {
          include: {
            activityDomains: { orderBy: { domain: 'asc' } },
          },
        },
      },
    });

    if (!contact || contact.prospect.deletedAt) {
      return NextResponse.json(
        { error: 'Contact introuvable' },
        { status: 404 },
      );
    }
    if (!canViewContactFiche(user, contact)) {
      return NextResponse.json(
        { error: 'Accès refusé à cette fiche contact.' },
        { status: 403 },
      );
    }

    const ownerUserId = contact.createdById;

    const [productInterests, serviceInterests, activities, company] =
      await Promise.all([
        prisma.prospectProductInterest.findMany({
          where: { contactId, userId: ownerUserId },
          include: { product: { select: { id: true, name: true } } },
        }),
        prisma.prospectServiceInterest.findMany({
          where: { contactId, userId: ownerUserId },
          include: { service: { select: { id: true, name: true } } },
        }),
        prisma.activity.findMany({
          where: {
            prospectId,
            OR: [{ contactId }, { contactId: null, userId: user.id }],
          },
          orderBy: { date: 'desc' },
          take: 40,
          include: { user: { select: { name: true } } },
        }),
        user.companyId
          ? prisma.company.findUnique({
              where: { id: user.companyId },
              select: { id: true, name: true },
            })
          : Promise.resolve(null),
      ]);

    const totalActivities = await prisma.activity.count({
      where: {
        prospectId,
        OR: [{ contactId }, { contactId: null, userId: user.id }],
      },
    });

    const prospect = contact.prospect;
    const canEdit = canManageContact(user, contact);
    const isMine = contact.createdById === user.id;

    return NextResponse.json({
      id: contact.id,
      contactId: contact.id,
      prospectId: prospect.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      civility: contact.civility,
      jobTitle: contact.jobTitle,
      decisionRole: contact.decisionRole,
      notes: contact.notes ?? prospect.notes,
      source: prospect.source,
      companyName: prospect.name,
      location: prospect.location,
      geographicSituation: prospect.geographicSituation,
      activitySector: prospect.activitySector,
      activityDomains: prospect.activityDomains.map((d) => d.domain),
      leadType: prospect.leadType,
      negotiationStage: contact.negotiationStage,
      /** Alias UI historique (fiche / cards) = stade du contact */
      status: contact.negotiationStage,
      biimDocuments: normalizeBiimDocuments(contact.biimDocuments),
      biimRegistered: contact.biimRegistered,
      biimVisited: contact.biimVisited,
      biimApproved: contact.biimApproved,
      companyId: company?.id ?? user.companyId ?? '',
      company: company ?? { id: '', name: prospect.name },
      createdBy: contact.createdBy,
      canEdit,
      isMine,
      productInterests,
      serviceInterests,
      activities,
      totalActivities,
      hasMoreActivities: totalActivities > activities.length,
    });
  } catch (error) {
    console.error('GET contact detail error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId, contactId } = await params;
    const contact = await prisma.prospectContact.findFirst({
      where: { id: contactId, prospectId, deletedAt: null },
    });
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact introuvable' },
        { status: 404 },
      );
    }
    if (!canManageContact(user, contact)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = updateContactSchema.parse(await req.json());
    const isBiimUser = await userBelongsToBiim(user.companyId);
    const biimData = resolveBiimContactData(body, isBiimUser, 'update');
    const updated = await prisma.$transaction(async (tx) => {
      const contactUpdated = await tx.prospectContact.update({
        where: { id: contactId },
        data: {
          firstName: body.firstName?.trim(),
          lastName: body.lastName?.trim(),
          email:
            body.email === undefined
              ? undefined
              : body.email?.trim() || null,
          phone:
            body.phone === undefined
              ? undefined
              : body.phone?.trim() || null,
          civility:
            body.civility === undefined
              ? undefined
              : body.civility?.trim() || null,
          jobTitle:
            body.jobTitle === undefined
              ? undefined
              : body.jobTitle?.trim() || null,
          decisionRole:
            body.decisionRole === undefined
              ? undefined
              : body.decisionRole ?? 'NON_DETERMINE',
          notes:
            body.notes === undefined ? undefined : body.notes?.trim() || null,
          negotiationStage: body.negotiationStage,
          ...biimData,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      if (body.negotiationStage) {
        await tx.prospect.update({
          where: { id: prospectId },
          data: { status: body.negotiationStage },
        });
      }

      return contactUpdated;
    });

    return NextResponse.json({
      ...updated,
      status: updated.negotiationStage,
      canEdit: true,
      isMine: updated.createdById === user.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('PATCH contact error', error);
    return NextResponse.json(
      { error: 'Impossible de modifier le contact.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId, contactId } = await params;
    const contact = await prisma.prospectContact.findFirst({
      where: { id: contactId, prospectId, deletedAt: null },
      include: { prospect: { select: { name: true } } },
    });
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact introuvable' },
        { status: 404 },
      );
    }
    if (!canManageContact(user, contact)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    await prisma.prospectContact.update({
      where: { id: contactId },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_UPDATE,
      entityType: 'ProspectContact',
      entityId: contactId,
      summary: `Suppression du contact ${contact.firstName} ${contact.lastName} sur ${contact.prospect.name}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE contact error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer le contact.' },
      { status: 500 },
    );
  }
}
