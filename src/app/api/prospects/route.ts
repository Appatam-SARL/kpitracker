import { getCurrentUser } from '@/lib/auth';
import { leadTypeEnumValues } from '@/lib/lead-type-values';
import {
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
import {
  biimContactFieldsSchema,
  resolveBiimContactData,
  userBelongsToBiim,
} from '@/lib/biim-contact';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const socialLinkSchema = z.object({
  network: z.string().min(1),
  url: z.string().min(1),
});

const createProspectSchema = z.object({
  name: z.string().min(1),
  leadType: z.enum(leadTypeEnumValues).optional(),
  activitySector: z.string().optional(),
  activityDomains: z.array(z.string()).optional(),
  location: z.string().optional(),
  geographicSituation: z.string().optional(),
  websiteUrl: z.string().optional(),
  socialLinks: z.array(socialLinkSchema).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  status: z
    .enum(['EN_PROSPECTION', 'VENTE_CONCLUE', 'VENTE_PERDUE'])
    .optional(),
  contact: z
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
    })
    .merge(biimContactFieldsSchema),
});

/** GET /api/prospects — liste des entreprises prospectées (pool GROUP). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const status = req.nextUrl.searchParams.get('status');
    const mine = req.nextUrl.searchParams.get('mine') === '1';
    const seeAllContacts = canViewAllProspectContacts(user);
    const visibleContactsWhere = seeAllContacts
      ? { deletedAt: null }
      : user.role === 'MANAGER' && user.companyId
        ? { deletedAt: null, createdBy: { companyId: user.companyId } }
        : { deletedAt: null, createdById: user.id };

    const prospects = await prisma.prospect.findMany({
      where: {
        deletedAt: null,
        ...(status
          ? {
              status: status as
                | 'EN_PROSPECTION'
                | 'VENTE_CONCLUE'
                | 'VENTE_PERDUE',
            }
          : {}),
        ...(mine
          ? { contacts: { some: { createdById: user.id, deletedAt: null } } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        activityDomains: { select: { domain: true }, orderBy: { domain: 'asc' } },
        _count: {
          select: {
            contacts: { where: visibleContactsWhere },
          },
        },
        contacts: {
          where: visibleContactsWhere,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            email: true,
            phone: true,
            createdById: true,
            createdBy: { select: { id: true, name: true, companyId: true } },
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        },
      },
    });

    return NextResponse.json(
      prospects.map((p) => {
        const visibleContacts = p.contacts;
        return {
          id: p.id,
          name: p.name,
          leadType: p.leadType,
          activitySector: p.activitySector,
          location: p.location,
          geographicSituation: p.geographicSituation,
          websiteUrl: p.websiteUrl,
          logoUrl: p.logoUrl,
          socialLinks: normalizeProspectSocialLinks(
            p.socialLinks as
              | Array<{ network?: string; url?: string }>
              | null,
          ),
          source: p.source,
          notes: p.notes,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          activityDomains: p.activityDomains.map((d) => d.domain),
          contactsCount: p._count.contacts,
          contactsPreview: visibleContacts.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            jobTitle: c.jobTitle,
            email: c.email,
            phone: c.phone,
            canViewFiche: canViewContactFiche(user, c),
            ownerName: c.createdBy?.name ?? null,
          })),
        };
      }),
    );
  } catch (error) {
    console.error('GET /api/prospects error', error);
    return NextResponse.json(
      { error: 'Impossible de charger les prospects.' },
      { status: 500 },
    );
  }
}

/** POST /api/prospects — crée une entreprise + 1er contact (refus si doublon). */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const json = await req.json();
    const body = createProspectSchema.parse(json);
    const name = displayProspectName(body.name);
    const nameNormalized = normalizeProspectName(name);

    const existing = await prisma.prospect.findFirst({
      where: { nameNormalized, deletedAt: null },
      select: { id: true, name: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: 'Cette entreprise existe déjà dans le pool de prospects.',
          existingId: existing.id,
          existingName: existing.name,
        },
        { status: 409 },
      );
    }

    const domains = (body.activityDomains ?? [])
      .map((d) => d.trim())
      .filter(Boolean);
    const socialLinks = normalizeProspectSocialLinks(body.socialLinks);
    const isBiimUser = await userBelongsToBiim(user.companyId);
    const biimData = resolveBiimContactData(body.contact, isBiimUser);

    const prospect = await prisma.prospect.create({
      data: {
        name,
        nameNormalized,
        leadType: body.leadType ?? 'NON_DETERMINE',
        activitySector: body.activitySector || null,
        location: body.location || null,
        geographicSituation: body.geographicSituation || null,
        websiteUrl: body.websiteUrl?.trim() || null,
        socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
        source: body.source || null,
        notes: body.notes || null,
        status: body.status ?? body.contact.negotiationStage ?? 'EN_PROSPECTION',
        activityDomains:
          domains.length > 0
            ? { create: domains.map((domain) => ({ domain })) }
            : undefined,
        contacts: {
          create: {
            createdById: user.id,
            firstName: body.contact.firstName.trim(),
            lastName: body.contact.lastName.trim(),
            email: body.contact.email?.trim() || null,
            phone: body.contact.phone?.trim() || null,
            civility: body.contact.civility?.trim() || null,
            jobTitle: body.contact.jobTitle?.trim() || null,
            decisionRole: body.contact.decisionRole ?? 'NON_DETERMINE',
            negotiationStage:
              body.contact.negotiationStage ??
              body.status ??
              'EN_PROSPECTION',
            ...biimData,
          },
        },
      },
      include: {
        contacts: {
          where: { deletedAt: null },
          include: {
            createdBy: { select: { id: true, name: true, companyId: true } },
          },
        },
        activityDomains: true,
      },
    });

    await prisma.activity.create({
      data: {
        type: 'NOTE',
        relatedTo: prospect.id,
        prospectId: prospect.id,
        contactId: prospect.contacts[0]?.id,
        userId: user.id,
        content: `Entreprise prospectée « ${prospect.name} » créée par ${user.name}.`,
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_CREATE,
      entityType: 'Prospect',
      entityId: prospect.id,
      summary: `Création du prospect entreprise ${prospect.name}`,
      metadata: { label: prospect.name },
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides pour créer le prospect.' },
        { status: 400 },
      );
    }
    console.error('POST /api/prospects error', error);
    return NextResponse.json(
      { error: 'Impossible de créer le prospect.' },
      { status: 500 },
    );
  }
}
