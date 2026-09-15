import type { AuthUser } from '@/lib/auth';
import {
  prismaCompanyScopeFilter,
  userCompanyInScope,
  type ResolvedGroupCompanyScope,
} from '@/lib/group-scope-roles';
import { getPeriodLabel } from '@/lib/goalPeriods';
import { prisma } from '@/lib/prisma';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { rm, unlink } from 'fs/promises';
import path from 'path';

import type { TrashEntityType, TrashItemDto } from '@/lib/trash-types';
import {
  TRASH_ENTITY_TYPES,
  activeOnlyWhere,
  isTrashEntityType,
  trashedOnlyWhere,
} from '@/lib/trash-types';
export type { TrashEntityType, TrashItemDto } from '@/lib/trash-types';
export {
  TRASH_ENTITY_TYPES,
  TRASH_ENTITY_LABELS,
  activeOnlyWhere,
  trashedOnlyWhere,
  isTrashEntityType,
} from '@/lib/trash-types';

export type ListTrashFilters = {
  entityType?: TrashEntityType;
  q?: string;
  page: number;
  pageSize: number;
};

export type ListTrashResult = {
  items: TrashItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const deletedBySelect = {
  deletedBy: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

function normalizeSearch(q: string | undefined): string {
  return q?.trim().toLowerCase() ?? '';
}

function matchesSearch(label: string, q: string): boolean {
  if (!q) return true;
  return label.toLowerCase().includes(q);
}

function toDto(
  entityType: TrashEntityType,
  row: {
    id: string;
    deletedAt: Date | null;
    deletedBy: { id: string; name: string } | null;
    companyId: string;
    company?: { name: string } | null;
    label: string;
    metadata?: Record<string, unknown>;
  },
): TrashItemDto | null {
  if (!row.deletedAt) return null;
  return {
    id: row.id,
    entityType,
    label: row.label,
    deletedAt: row.deletedAt.toISOString(),
    deletedBy: row.deletedBy,
    companyId: row.companyId,
    companyName: row.company?.name,
    metadata: row.metadata,
  };
}

export async function listTrashItems(
  scope: ResolvedGroupCompanyScope,
  filters: ListTrashFilters,
  includeCompanyNames: boolean,
): Promise<ListTrashResult> {
  const companyFilter = prismaCompanyScopeFilter(scope);
  const q = normalizeSearch(filters.q);
  const typeFilter = filters.entityType;
  const items: TrashItemDto[] = [];

  if (!typeFilter || typeFilter === 'LEAD') {
    const prospects = await prisma.prospect.findMany({
      where: { ...trashedOnlyWhere },
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true,
        deletedBy: {
          select: {
            id: true,
            name: true,
            companyId: true,
            ...(includeCompanyNames
              ? { company: { select: { name: true } } }
              : {}),
          },
        },
      },
      orderBy: { deletedAt: 'desc' },
    });
    for (const prospect of prospects) {
      const companyId = prospect.deletedBy?.companyId;
      if (!companyId || !userCompanyInScope(companyId, scope)) continue;
      const label = prospect.name;
      if (!matchesSearch(label, q)) continue;
      const dto = toDto('LEAD', {
        id: prospect.id,
        deletedAt: prospect.deletedAt,
        deletedBy: prospect.deletedBy
          ? { id: prospect.deletedBy.id, name: prospect.deletedBy.name }
          : null,
        companyId,
        company: includeCompanyNames
          ? (prospect.deletedBy as { company?: { name: string } } | null)
              ?.company
          : null,
        label,
        metadata: { status: prospect.status },
      });
      if (dto) items.push(dto);
    }
  }

  if (!typeFilter || typeFilter === 'USER') {
    const users = await prisma.user.findMany({
      where: { ...companyFilter, ...trashedOnlyWhere },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        companyId: true,
        deletedAt: true,
        deletedBy: { select: { id: true, name: true } },
        ...(includeCompanyNames
          ? { company: { select: { name: true } } }
          : {}),
      },
      orderBy: { deletedAt: 'desc' },
    });
    for (const user of users) {
      if (!matchesSearch(user.name, q) && !matchesSearch(user.email, q)) {
        continue;
      }
      const dto = toDto('USER', {
        id: user.id,
        deletedAt: user.deletedAt,
        deletedBy: user.deletedBy,
        companyId: user.companyId,
        company: includeCompanyNames
          ? (user as { company?: { name: string } }).company
          : null,
        label: user.name,
        metadata: { email: user.email, role: user.role },
      });
      if (dto) items.push(dto);
    }
  }

  if (!typeFilter || typeFilter === 'GOAL') {
    const goals = await prisma.salesGoal.findMany({
      where: { ...companyFilter, ...trashedOnlyWhere },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        companyId: true,
        deletedAt: true,
        deletedBy: { select: { id: true, name: true } },
        user: { select: { name: true } },
        ...(includeCompanyNames
          ? { company: { select: { name: true } } }
          : {}),
      },
      orderBy: { deletedAt: 'desc' },
    });
    for (const goal of goals) {
      const periodLabel = getPeriodLabel(goal.periodType, goal.periodStart);
      const label = `Objectif ${periodLabel} — ${goal.user.name}`;
      if (!matchesSearch(label, q)) continue;
      const dto = toDto('GOAL', {
        id: goal.id,
        deletedAt: goal.deletedAt,
        deletedBy: goal.deletedBy,
        companyId: goal.companyId,
        company: includeCompanyNames
          ? (goal as { company?: { name: string } }).company
          : null,
        label,
        metadata: { periodType: goal.periodType, commercial: goal.user.name },
      });
      if (dto) items.push(dto);
    }
  }

  if (!typeFilter || typeFilter === 'ATTACHMENT') {
    const attachments = await prisma.prospectAttachment.findMany({
      where: { ...trashedOnlyWhere },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        prospectId: true,
        deletedAt: true,
        deletedBy: {
          select: {
            id: true,
            name: true,
            companyId: true,
            ...(includeCompanyNames
              ? { company: { select: { name: true } } }
              : {}),
          },
        },
        prospect: { select: { name: true } },
      },
      orderBy: { deletedAt: 'desc' },
    });
    for (const att of attachments) {
      const companyId = att.deletedBy?.companyId;
      if (!companyId || !userCompanyInScope(companyId, scope)) continue;
      const label = att.fileName;
      if (!matchesSearch(label, q)) continue;
      const dto = toDto('ATTACHMENT', {
        id: att.id,
        deletedAt: att.deletedAt,
        deletedBy: att.deletedBy
          ? { id: att.deletedBy.id, name: att.deletedBy.name }
          : null,
        companyId,
        company: includeCompanyNames
          ? (att.deletedBy as { company?: { name: string } } | null)?.company
          : null,
        label,
        metadata: {
          fileType: att.fileType,
          leadId: att.prospectId,
          leadName: att.prospect.name,
        },
      });
      if (dto) items.push(dto);
    }
  }

  items.sort(
    (a, b) =>
      new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );

  const total = items.length;
  const pageSize = Math.min(Math.max(filters.pageSize, 1), 100);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}

async function assertTrashAccessToCompany(
  actor: AuthUser,
  scope: ResolvedGroupCompanyScope,
  companyId: string,
): Promise<void> {
  if (!userCompanyInScope(companyId, scope)) {
    throw new TrashError('Élément hors de votre périmètre', 403);
  }
}

export class TrashError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'TrashError';
  }
}

export async function softDeleteLead(
  actorId: string,
  leadId: string,
): Promise<void> {
  await prisma.prospect.update({
    where: { id: leadId },
    data: { deletedAt: new Date(), deletedById: actorId },
  });
}

export async function softDeleteUser(
  actorId: string,
  userId: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date(), deletedById: actorId },
  });
}

export async function softDeleteGoal(
  actorId: string,
  goalId: string,
): Promise<void> {
  await prisma.salesGoal.update({
    where: { id: goalId },
    data: { deletedAt: new Date(), deletedById: actorId },
  });
}

export async function softDeleteAttachment(
  actorId: string,
  attachmentId: string,
): Promise<void> {
  await prisma.prospectAttachment.update({
    where: { id: attachmentId },
    data: { deletedAt: new Date(), deletedById: actorId },
  });
}

export async function restoreTrashItem(
  actor: AuthUser,
  scope: ResolvedGroupCompanyScope,
  entityType: TrashEntityType,
  id: string,
): Promise<TrashItemDto> {
  switch (entityType) {
    case 'LEAD': {
      const lead = await prisma.prospect.findFirst({
        where: { id, ...trashedOnlyWhere },
        select: {
          id: true,
          name: true,
          status: true,
          deletedAt: true,
          deletedBy: { select: { companyId: true } },
        },
      });
      if (!lead?.deletedAt) {
        throw new TrashError('Prospect introuvable en corbeille', 404);
      }
      const companyId =
        lead.deletedBy?.companyId ?? actor.companyId ?? '';
      if (!companyId) {
        throw new TrashError('Prospect introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, companyId);
      await prisma.prospect.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });
      return {
        id: lead.id,
        entityType: 'LEAD',
        label: lead.name,
        deletedAt: lead.deletedAt.toISOString(),
        deletedBy: null,
        companyId,
        metadata: { status: lead.status },
      };
    }
    case 'USER': {
      const user = await prisma.user.findFirst({
        where: { id, ...trashedOnlyWhere },
        select: {
          id: true,
          name: true,
          email: true,
          companyId: true,
          deletedAt: true,
        },
      });
      if (!user?.deletedAt) {
        throw new TrashError('Utilisateur introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, user.companyId);
      const conflict = await prisma.user.findFirst({
        where: {
          email: user.email,
          deletedAt: null,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new TrashError(
          'Impossible de restaurer : un compte actif utilise déjà cet e-mail',
          409,
        );
      }
      await prisma.user.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });
      return {
        id: user.id,
        entityType: 'USER',
        label: user.name,
        deletedAt: user.deletedAt.toISOString(),
        deletedBy: null,
        companyId: user.companyId,
        metadata: { email: user.email },
      };
    }
    case 'GOAL': {
      const goal = await prisma.salesGoal.findFirst({
        where: { id, ...trashedOnlyWhere },
        include: { user: { select: { name: true } } },
      });
      if (!goal?.deletedAt) {
        throw new TrashError('Objectif introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, goal.companyId);
      await prisma.salesGoal.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });
      const periodLabel = getPeriodLabel(goal.periodType, goal.periodStart);
      return {
        id: goal.id,
        entityType: 'GOAL',
        label: `Objectif ${periodLabel} — ${goal.user.name}`,
        deletedAt: goal.deletedAt.toISOString(),
        deletedBy: null,
        companyId: goal.companyId,
      };
    }
    case 'ATTACHMENT': {
      const att = await prisma.prospectAttachment.findFirst({
        where: { id, ...trashedOnlyWhere },
        include: {
          prospect: { select: { name: true } },
          deletedBy: { select: { companyId: true } },
        },
      });
      if (!att?.deletedAt) {
        throw new TrashError('Pièce jointe introuvable en corbeille', 404);
      }
      const companyId =
        att.deletedBy?.companyId ?? actor.companyId ?? '';
      if (!companyId) {
        throw new TrashError('Pièce jointe introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, companyId);
      await prisma.prospectAttachment.update({
        where: { id },
        data: { deletedAt: null, deletedById: null },
      });
      return {
        id: att.id,
        entityType: 'ATTACHMENT',
        label: att.fileName,
        deletedAt: att.deletedAt.toISOString(),
        deletedBy: null,
        companyId,
        metadata: {
          leadId: att.prospectId,
          leadName: att.prospect.name,
        },
      };
    }
    default:
      throw new TrashError('Type d\'entité invalide', 400);
  }
}

async function removeAttachmentFile(storagePath: string): Promise<void> {
  const filePath = path.join(process.cwd(), 'public', storagePath);
  try {
    await unlink(filePath);
  } catch {
    // fichier déjà absent
  }
}

async function removeLeadUploadDir(leadId: string): Promise<void> {
  const dir = path.join(process.cwd(), 'public', 'uploads', 'leads', leadId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // dossier déjà absent
  }
}

export async function purgeTrashItem(
  actor: AuthUser,
  scope: ResolvedGroupCompanyScope,
  entityType: TrashEntityType,
  id: string,
): Promise<void> {
  switch (entityType) {
    case 'LEAD': {
      const lead = await prisma.prospect.findFirst({
        where: { id, ...trashedOnlyWhere },
        select: {
          id: true,
          deletedBy: { select: { companyId: true } },
          attachments: { select: { storagePath: true } },
        },
      });
      if (!lead) {
        throw new TrashError('Prospect introuvable en corbeille', 404);
      }
      const companyId =
        lead.deletedBy?.companyId ?? actor.companyId ?? '';
      if (!companyId) {
        throw new TrashError('Prospect introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, companyId);
      for (const att of lead.attachments) {
        await removeAttachmentFile(att.storagePath);
      }
      await removeLeadUploadDir(lead.id);
      await prisma.prospect.delete({ where: { id } });
      return;
    }
    case 'USER': {
      const user = await prisma.user.findFirst({
        where: { id, ...trashedOnlyWhere },
        select: { id: true, companyId: true },
      });
      if (!user) {
        throw new TrashError('Utilisateur introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, user.companyId);
      try {
        await prisma.user.delete({ where: { id } });
      } catch (error) {
        if (
          error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          throw new TrashError(
            'Impossible de supprimer définitivement : des données sont encore liées à cet utilisateur',
            409,
          );
        }
        throw error;
      }
      return;
    }
    case 'GOAL': {
      const goal = await prisma.salesGoal.findFirst({
        where: { id, ...trashedOnlyWhere },
        select: { id: true, companyId: true },
      });
      if (!goal) {
        throw new TrashError('Objectif introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, goal.companyId);
      await prisma.salesGoal.delete({ where: { id } });
      return;
    }
    case 'ATTACHMENT': {
      const att = await prisma.prospectAttachment.findFirst({
        where: { id, ...trashedOnlyWhere },
        include: { deletedBy: { select: { companyId: true } } },
      });
      if (!att) {
        throw new TrashError('Pièce jointe introuvable en corbeille', 404);
      }
      const companyId =
        att.deletedBy?.companyId ?? actor.companyId ?? '';
      if (!companyId) {
        throw new TrashError('Pièce jointe introuvable en corbeille', 404);
      }
      await assertTrashAccessToCompany(actor, scope, companyId);
      await removeAttachmentFile(att.storagePath);
      await prisma.prospectAttachment.delete({ where: { id } });
      return;
    }
    default:
      throw new TrashError('Type d\'entité invalide', 400);
  }
}
