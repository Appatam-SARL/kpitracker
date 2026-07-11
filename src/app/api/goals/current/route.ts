import { getCurrentUser, resolveGroupCompanyScope } from '@/lib/auth';
import {
  hasGroupCompanyScope,
  prismaCompanyScopeFilter,
  userCompanyInScope,
} from '@/lib/group-scope-roles';
import { getPeriodLabel } from '@/lib/goalPeriods';
import { activeOnlyWhere } from '@/lib/trash';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type GoalCurrentDto = {
  id: string;
  periodType: 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';
  periodStart: string;
  user: { id: string; name: string; email: string };
  periodLabel: string;
  targetConversions: number;
  realizedConversions: number;
  targetRevenue: number;
  realizedRevenue: number;
};

async function withRealized(goal: {
  id: string;
  userId: string;
  companyId: string;
  periodType: 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';
  periodStart: Date;
  periodEnd: Date;
  targetConversions: number;
  targetRevenue: number;
  user: { id: string; name: string; email: string };
}): Promise<GoalCurrentDto> {
  const realizedConversions = await prisma.client.count({
    where: {
      convertedById: goal.userId,
      convertedAt: {
        gte: goal.periodStart,
        lte: goal.periodEnd,
      },
      companyId: goal.companyId,
    },
  });

  const realizedRevenueResult = await prisma.sale.aggregate({
    where: {
      userId: goal.userId,
      companyId: goal.companyId,
      date: {
        gte: goal.periodStart,
        lte: goal.periodEnd,
      },
    },
    _sum: { amount: true },
  });
  const realizedRevenue = realizedRevenueResult._sum.amount ?? 0;

  return {
    id: goal.id,
    periodType: goal.periodType,
    periodStart: goal.periodStart.toISOString(),
    user: goal.user,
    periodLabel: getPeriodLabel(goal.periodType, goal.periodStart),
    targetConversions: goal.targetConversions,
    realizedConversions,
    targetRevenue: goal.targetRevenue,
    realizedRevenue,
  };
}

/** GET /api/goals/current?userId=...&companyId=... (directrice : entreprise du groupe)
 *  - AGENT (sans userId): objectif courant de l'agent, ou null
 *  - ADMIN/MANAGER/DIRECTRICE + userId: objectif courant de ce commercial, ou null
 *  - ADMIN/MANAGER/DIRECTRICE sans userId: tableau des objectifs courants (un par commercial)
 */
export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (!currentUser.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const userIdParam = url.searchParams.get('userId');
  const now = new Date();

  // Cas 1: AGENT (toujours son propre objectif courant, pas de userId nécessaire)
  if (currentUser.role === 'AGENT') {
    const goal = await prisma.salesGoal.findFirst({
      where: {
        companyId: currentUser.companyId,
        userId: currentUser.id,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        ...activeOnlyWhere,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { periodStart: 'desc' },
    });

    if (!goal) {
      return NextResponse.json(null);
    }

    const dto = await withRealized(goal);
    return NextResponse.json(dto);
  }

  // À partir d'ici: ADMIN, MANAGER ou rôles groupe (vision multi-entreprises)
  if (
    currentUser.role !== 'ADMIN' &&
    currentUser.role !== 'MANAGER' &&
    !hasGroupCompanyScope(currentUser.role)
  ) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const companyIdParam = url.searchParams.get('companyId');
  const scopeCompanyId =
    companyIdParam ??
    (userIdParam
      ? (
          await prisma.user.findUnique({
            where: { id: userIdParam },
            select: { companyId: true },
          })
        )?.companyId ?? null
      : null);

  const scopeRes = await resolveGroupCompanyScope(
    currentUser,
    hasGroupCompanyScope(currentUser.role) ? scopeCompanyId : companyIdParam,
  );
  if (scopeRes instanceof NextResponse) return scopeRes;
  const companyScope = prismaCompanyScopeFilter(scopeRes);

  // Cas 2: + userId => objectif courant unique ou null
  if (userIdParam) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userIdParam },
      select: { id: true, companyId: true, name: true, email: true },
    });
    if (!targetUser || !userCompanyInScope(targetUser.companyId, scopeRes)) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé ou autre entreprise' },
        { status: 403 },
      );
    }

    const goal = await prisma.salesGoal.findFirst({
      where: {
        ...companyScope,
        userId: targetUser.id,
        periodStart: { lte: now },
        periodEnd: { gte: now },
        ...activeOnlyWhere,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { periodStart: 'desc' },
    });

    if (!goal) {
      return NextResponse.json(null);
    }

    const dto = await withRealized(goal);
    return NextResponse.json(dto);
  }

  // Cas 3: sans userId => tableau des objectifs courants (un par userId)
  const goals = await prisma.salesGoal.findMany({
    where: {
      ...companyScope,
      periodStart: { lte: now },
      periodEnd: { gte: now },
      ...activeOnlyWhere,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ userId: 'asc' }, { periodStart: 'desc' }],
  });

  // Garder au plus un objectif courant par commercial (le plus récent)
  const byUser = new Map<string, (typeof goals)[number]>();
  for (const g of goals) {
    if (!byUser.has(g.userId)) {
      byUser.set(g.userId, g);
    }
  }

  const selected = Array.from(byUser.values());
  const withMetrics = await Promise.all(selected.map((g) => withRealized(g)));

  return NextResponse.json(withMetrics);
}
