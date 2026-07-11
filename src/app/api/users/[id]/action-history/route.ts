import { canViewUserProfile, getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const PAGE_SIZE = 10;

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const iso = `${value}T00:00:00.000Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseActionList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEntityTypeList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id: targetUserId } = await params;

  if (targetUserId !== currentUser.id) {
    if (currentUser.role === 'AGENT') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 },
      );
    }

    const viewAllowed = await canViewUserProfile(
      currentUser,
      target.companyId,
    );
    if (viewAllowed !== true) return viewAllowed;
  }

  const searchParams = req.nextUrl.searchParams;
  const pageParam = searchParams.get('page');
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const actionsParam = searchParams.get('action');
  const entityTypesParam = searchParams.get('entityType');
  const qParamRaw = searchParams.get('q');
  const q =
    qParamRaw && qParamRaw.trim()
      ? qParamRaw.trim().slice(0, 200)
      : null;

  const fromDate = parseDateParam(fromParam);
  const toDate = parseDateParam(toParam);
  const actions = parseActionList(actionsParam);
  const entityTypes = parseEntityTypeList(entityTypesParam);

  const where: Prisma.UserActionLogWhereInput = {
    userId: targetUserId,
  };

  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate
        ? {
            lte: new Date(
              `${toParam}T23:59:59.999Z`,
            ),
          }
        : {}),
    };
  }

  if (actions.length) {
    where.action = { in: actions };
  }

  if (entityTypes.length) {
    where.entityType = { in: entityTypes };
  }

  if (q) {
    where.OR = [
      {
        summary: {
          contains: q,
          mode: 'insensitive',
        },
      },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.userActionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          summary: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.userActionLog.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('GET /api/users/[id]/action-history error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
