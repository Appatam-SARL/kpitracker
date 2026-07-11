import {
  agentCanModifyLead,
  getLeadIdsWithActivitySinceInCompany,
  getLegacyUnassignedLeadIdsForAgent,
} from '@/lib/agentLegacyLeadAccess';
import { getCurrentUser, resolveGroupCompanyScope } from '@/lib/auth';
import { logUserAction, formatLeadName, USER_ACTION_CODES } from '@/lib/user-action-log';
import { softDeleteLead, activeOnlyWhere } from '@/lib/trash';
import { hasGroupCompanyScope, prismaCompanyScopeFilter } from '@/lib/group-scope-roles';
import {
  leadActivityDomainsInclude,
  normalizeActivityDomainsInput,
  serializeLeadWithActivityDomains,
} from '@/lib/lead-activity-domains';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, LeadStatus } from '@prisma/client';

const createLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  civility: z.string().optional(),
  activitySector: z.string().optional(),
  activityDomains: z.array(z.string()).optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  // on reste aligné avec l'enum LeadStatus du schema Prisma
  status: z
    .enum(['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED'])
    .optional(),
  assignedTo: z.string().optional(),
  companyId: z.string().optional(),
  // Identifiants des produits/services qui intéressent ce prospect
  productIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
});

const updateLeadSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  civility: z.string().optional(),
  activitySector: z.string().optional(),
  activityDomains: z.array(z.string()).optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  status: z
    .enum(['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED'])
    .optional(),
  assignedTo: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('companyId');
    const statusParam = url.searchParams.get('status');
    const sourceParam = url.searchParams.get('source');
    const assignedToParam = url.searchParams.get('assignedTo');
    const createdFromParam = url.searchParams.get('createdFrom');
    const createdToParam = url.searchParams.get('createdTo');
    const staleDaysParam = url.searchParams.get('staleDays');
    const takeParam = url.searchParams.get('take');
    const skipParam = url.searchParams.get('skip');

    // Par défaut: isolation par entreprise ; rôles groupe : companyId= ou holding
    let companyScope: { companyId: string | { in: string[] } } = {
      companyId: user.companyId,
    };
    if (hasGroupCompanyScope(user.role)) {
      const scope = await resolveGroupCompanyScope(user, companyIdParam);
      if (scope instanceof NextResponse) return scope;
      companyScope = prismaCompanyScopeFilter(scope);
    }

    const where: Prisma.LeadWhereInput = { ...companyScope, ...activeOnlyWhere };
    const andConditions: Prisma.LeadWhereInput[] = [];

    // Legacy transition: AGENT voit ses leads assignés + leads non assignés dont la première
    // activité de création/import (leadId OU relatedTo) est la sienne.
    if (user.role === 'AGENT') {
      const legacyIds = await getLegacyUnassignedLeadIdsForAgent(
        user.companyId,
        user.id,
      );
      andConditions.push({
        OR: [
          { assignedTo: user.id },
          { assignedTo: null },
          ...(legacyIds.length ? [{ id: { in: legacyIds } }] : []),
        ],
      });
    }

    if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length) {
        where.status = { in: statuses as LeadStatus[] };
      }
    }

    if (sourceParam) {
      where.source = {
        contains: sourceParam,
        mode: 'insensitive',
      };
    }

    // Filtre commercial : réservé aux rôles non-AGENT (un AGENT est déjà limité à lui-même).
    if (assignedToParam && user.role !== 'AGENT') {
      where.assignedTo = assignedToParam;
    }
    // if (!assignedToParam && user.role !== 'AGENT') {
    //   where.assignedTo = '';
    // }

    if (createdFromParam || createdToParam) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (createdFromParam) {
        const from = new Date(createdFromParam);
        if (!Number.isNaN(from.getTime())) {
          createdAt.gte = from;
        }
      }
      if (createdToParam) {
        const to = new Date(createdToParam);
        if (!Number.isNaN(to.getTime())) {
          // Inclure toute la journée
          to.setHours(23, 59, 59, 999);
          createdAt.lte = to;
        }
      }
      if (createdAt.gte || createdAt.lte) {
        where.createdAt = createdAt;
      }
    }

    const staleDays = staleDaysParam
      ? Number.parseInt(staleDaysParam, 10)
      : NaN;
    if (Number.isFinite(staleDays) && staleDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - staleDays);
      // Sans activité récente (leadId OU relatedTo), cohérent avec les activités legacy.
      const withRecent = await getLeadIdsWithActivitySinceInCompany(
        companyScope.companyId,
        cutoff,
      );
      if (withRecent.length) {
        andConditions.push({
          NOT: { id: { in: withRecent } },
        });
      }
    }

    if (andConditions.length) {
      where.AND = andConditions;
    }

    const take =
      takeParam && !Number.isNaN(Number.parseInt(takeParam, 10))
        ? Math.min(Number.parseInt(takeParam, 10), 200)
        : undefined;
    const skip =
      skipParam && !Number.isNaN(Number.parseInt(skipParam, 10))
        ? Math.max(0, Number.parseInt(skipParam, 10))
        : undefined;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: {
        ...leadActivityDomainsInclude,
        ...(hasGroupCompanyScope(user.role)
          ? { company: { select: { id: true, name: true } } }
          : {}),
      },
    });
    return NextResponse.json(leads.map(serializeLeadWithActivityDomains));
  } catch (error) {
    console.error('GET /api/leads error', error);
    return NextResponse.json(
      { error: 'Unable to fetch leads' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const body = createLeadSchema.parse(json);
    const activityDomains = normalizeActivityDomainsInput(body.activityDomains);

    const lead = await prisma.lead.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        source: body.source,
        civility: body.civility,
        activitySector: body.activitySector,
        activityDomains:
          activityDomains.length > 0
            ? {
                create: activityDomains.map((domain) => ({ domain })),
              }
            : undefined,
        companyName: body.companyName,
        jobTitle: body.jobTitle,
        location: body.location,
        notes: body.notes,
        status: body.status,
        // Traçabilité: si aucun commercial n'est spécifié, on attribue au créateur.
        assignedTo: body.assignedTo ?? user.id,
        products:
          body.productIds && body.productIds.length
            ? {
                connect: body.productIds.map((id) => ({ id })),
              }
            : undefined,
        services:
          body.serviceIds && body.serviceIds.length
            ? {
                connect: body.serviceIds.map((id) => ({ id })),
              }
            : undefined,
        // On rattache toujours le lead à la société de l'utilisateur connecté.
        companyId: user.companyId,
      },
      include: leadActivityDomainsInclude,
    });

    await prisma.activity.create({
      data: {
        type: 'NOTE',
        relatedTo: lead.id,
        leadId: lead.id,
        userId: user.id,
        content: `Lead créé manuellement par ${user.name} (${user.email}).`,
      },
    });

    // Création automatique d'une tâche d'agenda à la création du lead
    if (process.env.AUTO_AGENDA_ON_LEAD_CREATE === 'true') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      try {
        await prisma.agendaItem.create({
          data: {
            leadId: lead.id,
            title: 'Appeler le prospect',
            dueDate,
            status: 'TODO',
          },
        });
      } catch (e) {
        // On ne bloque pas la création du lead si l'agenda échoue
        console.error('Erreur création AgendaItem auto pour lead', e);
      }
    }

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_CREATE,
      entityType: 'Lead',
      entityId: lead.id,
      summary: `Création du prospect ${formatLeadName(lead.firstName, lead.lastName)}`,
      metadata: {
        label: formatLeadName(lead.firstName, lead.lastName),
        status: lead.status,
      },
    });

    return NextResponse.json(serializeLeadWithActivityDomains(lead), {
      status: 201,
    });
  } catch (error) {
    console.error('POST /api/leads error', error);
    return NextResponse.json(
      { error: 'Unable to create lead' },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const body = updateLeadSchema.parse(json);

    const existing =
      user.role === 'AGENT'
        ? (await agentCanModifyLead(body.id, user.companyId, user.id))
          ? { id: body.id }
          : null
        : await prisma.lead.findFirst({
            where: { id: body.id, companyId: user.companyId, ...activeOnlyWhere },
            select: { id: true },
          });
    if (!existing) {
      return NextResponse.json(
        { error: 'Lead introuvable dans votre société' },
        { status: 404 },
      );
    }

    const activityDomains =
      body.activityDomains !== undefined
        ? normalizeActivityDomainsInput(body.activityDomains)
        : undefined;

    const lead = await prisma.lead.update({
      where: { id: body.id },
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email,
        source: body.source,
        civility: body.civility,
        activitySector: body.activitySector,
        companyName: body.companyName,
        jobTitle: body.jobTitle,
        location: body.location,
        notes: body.notes,
        status: body.status,
        assignedTo: body.assignedTo,
        activityDomains:
          activityDomains !== undefined
            ? {
                deleteMany: {},
                create: activityDomains.map((domain) => ({ domain })),
              }
            : undefined,
        products: body.productIds
          ? {
              set: body.productIds.map((id) => ({ id })),
            }
          : undefined,
        services: body.serviceIds
          ? {
              set: body.serviceIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: leadActivityDomainsInclude,
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_UPDATE,
      entityType: 'Lead',
      entityId: lead.id,
      summary: `Modification du prospect ${formatLeadName(lead.firstName, lead.lastName)}`,
      metadata: {
        label: formatLeadName(lead.firstName, lead.lastName),
        status: lead.status,
      },
    });

    return NextResponse.json(serializeLeadWithActivityDomains(lead));
  } catch (error) {
    console.error('PATCH /api/leads error', error);
    return NextResponse.json(
      { error: 'Unable to update lead' },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const existing =
      user.role === 'AGENT'
        ? (await agentCanModifyLead(id, user.companyId, user.id))
          ? { id }
          : null
        : await prisma.lead.findFirst({
            where: { id, companyId: user.companyId, deletedAt: null },
            select: { id: true, firstName: true, lastName: true },
          });
    if (!existing) {
      return NextResponse.json(
        { error: 'Lead introuvable dans votre société' },
        { status: 404 },
      );
    }

    await softDeleteLead(user.id, id);

    if (existing && 'firstName' in existing) {
      await logUserAction({
        user,
        action: USER_ACTION_CODES.LEAD_DELETE,
        entityType: 'Lead',
        entityId: id,
        summary: `Mise en corbeille du prospect ${formatLeadName(existing.firstName, existing.lastName)}`,
        metadata: {
          label: formatLeadName(existing.firstName, existing.lastName),
        },
      });
    } else {
      await logUserAction({
        user,
        action: USER_ACTION_CODES.LEAD_DELETE,
        entityType: 'Lead',
        entityId: id,
        summary: 'Mise en corbeille d\'un prospect',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/leads error', error);
    return NextResponse.json(
      { error: 'Unable to delete lead' },
      { status: 500 },
    );
  }
}
