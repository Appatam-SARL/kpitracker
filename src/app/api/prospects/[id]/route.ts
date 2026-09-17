import { getCurrentUser } from '@/lib/auth';
import { leadTypeEnumValues } from '@/lib/lead-type-values';
import {
  canManageContact,
  canViewAllProspectContacts,
  canViewContactFiche,
  requireGroupProspectsAccess,
} from '@/lib/prospect-access';
import {
  displayProspectName,
  normalizeProspectName,
} from '@/lib/prospect-name';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { normalizeProspectSocialLinks } from '@/config/prospect-socials';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const socialLinkSchema = z.object({
  network: z.string().min(1),
  url: z.string().min(1),
});

const updateProspectSchema = z.object({
  name: z.string().min(1).optional(),
  leadType: z.enum(leadTypeEnumValues).optional(),
  activitySector: z.string().optional().nullable(),
  activityDomains: z.array(z.string()).optional(),
  location: z.string().optional().nullable(),
  geographicSituation: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  socialLinks: z.array(socialLinkSchema).optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z
    .enum(['EN_PROSPECTION', 'VENTE_CONCLUE', 'VENTE_PERDUE'])
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id } = await params;
    const prospect = await prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true } },
        activityDomains: { orderBy: { domain: 'asc' } },
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, companyId: true },
            },
            productInterests: {
              include: { product: { select: { id: true, name: true } } },
            },
            serviceInterests: {
              include: { service: { select: { id: true, name: true } } },
            },
          },
        },
        attachments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const visibleContacts = canViewAllProspectContacts(user)
      ? prospect.contacts
      : prospect.contacts.filter((c) => canViewContactFiche(user, c));

    return NextResponse.json({
      ...prospect,
      createdBy: prospect.createdBy
        ? { id: prospect.createdBy.id, name: prospect.createdBy.name }
        : null,
      activityDomains: prospect.activityDomains.map((d) => d.domain),
      socialLinks: normalizeProspectSocialLinks(
        prospect.socialLinks as
          | Array<{ network?: string; url?: string }>
          | null,
      ),
      contacts: visibleContacts.map((c) => ({
        ...c,
        canEdit: canManageContact(user, c),
        canViewFiche: canViewContactFiche(user, c),
        isMine: c.createdById === user.id,
      })),
    });
  } catch (error) {
    console.error('GET /api/prospects/[id] error', error);
    return NextResponse.json(
      { error: 'Impossible de charger le prospect.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
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

    const { id } = await params;
    const body = updateProspectSchema.parse(await req.json());

    const existing = await prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    let nameNormalized: string | undefined;
    let name: string | undefined;
    if (body.name !== undefined) {
      name = displayProspectName(body.name);
      nameNormalized = normalizeProspectName(name);
      const clash = await prisma.prospect.findFirst({
        where: {
          nameNormalized,
          deletedAt: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: 'Une autre entreprise porte déjà ce nom.' },
          { status: 409 },
        );
      }
    }

    const domains =
      body.activityDomains !== undefined
        ? body.activityDomains.map((d) => d.trim()).filter(Boolean)
        : undefined;
    const socialLinks =
      body.socialLinks !== undefined
        ? normalizeProspectSocialLinks(body.socialLinks ?? [])
        : undefined;

    const prospect = await prisma.$transaction(async (tx) => {
      const updated = await tx.prospect.update({
        where: { id },
        data: {
          name,
          nameNormalized,
          leadType: body.leadType,
          activitySector: body.activitySector,
          location: body.location,
          geographicSituation: body.geographicSituation,
          websiteUrl:
            body.websiteUrl !== undefined
              ? body.websiteUrl?.trim() || null
              : undefined,
          socialLinks:
            socialLinks !== undefined
              ? socialLinks.length > 0
                ? socialLinks
                : []
              : undefined,
          source: body.source,
          notes: body.notes,
          status: body.status,
          activityDomains:
            domains !== undefined
              ? {
                  deleteMany: {},
                  create: domains.map((domain) => ({ domain })),
                }
              : undefined,
        },
        include: {
          activityDomains: true,
          contacts: {
            where: { deletedAt: null },
            include: {
              createdBy: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (body.status) {
        await tx.prospectContact.updateMany({
          where: {
            prospectId: id,
            createdById: user.id,
            deletedAt: null,
          },
          data: { negotiationStage: body.status },
        });
      }

      return updated;
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_UPDATE,
      entityType: 'Prospect',
      entityId: prospect.id,
      summary: `Modification du prospect entreprise ${prospect.name}`,
      metadata: { label: prospect.name },
    });

    return NextResponse.json({
      ...prospect,
      activityDomains: prospect.activityDomains.map((d) => d.domain),
      socialLinks: normalizeProspectSocialLinks(
        prospect.socialLinks as
          | Array<{ network?: string; url?: string }>
          | null,
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('PATCH /api/prospects/[id] error', error);
    return NextResponse.json(
      { error: 'Impossible de modifier le prospect.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    if (user.role === 'AGENT') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await prisma.prospect.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    await prisma.prospect.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_DELETE,
      entityType: 'Prospect',
      entityId: id,
      summary: `Mise en corbeille du prospect ${existing.name}`,
      metadata: { label: existing.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/prospects/[id] error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer le prospect.' },
      { status: 500 },
    );
  }
}
