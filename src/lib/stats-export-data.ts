import type { LeadDemographicsResponse } from '@/lib/lead-demographics-report';
import type { AuthUser } from '@/lib/auth';
import { resolveGroupCompanyScope } from '@/lib/auth';
import { getPeriodLabel } from '@/lib/goalPeriods';
import {
  hasGroupCompanyScope,
  type ResolvedGroupCompanyScope,
  prismaCompanyScopeFilter,
  userCompanyInScope,
} from '@/lib/group-scope-roles';
import { activeOnlyWhere } from '@/lib/trash';
import { buildLeadDemographicsReport } from '@/lib/lead-demographics-report';
import {
  buildMonthlySalesMetrics,
  buildSalesSummaryReport,
  type MonthlySalesMetric,
  type SalesSummaryReport,
} from '@/lib/sales-summary-report';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export type StatsGoalRow = {
  id: string;
  periodLabel: string;
  targetConversions: number;
  targetRevenue: number;
  realizedConversions: number;
  realizedRevenue: number;
  user: { id: string; name: string; email: string };
};

export type StatsGoalsSummary = {
  goalsDefined: number;
  commercialsCount: number;
  realizedConversions: number;
  targetConversions: number;
};

export type StatsExportPayload = {
  meta: {
    scopeLabel: string;
    commercialLabel: string | null;
    salesPeriodFrom: string;
    salesPeriodTo: string;
    salesSource: string | null;
    exportedAt: string;
    isHoldingScope: boolean;
  };
  sales: SalesSummaryReport;
  demographics: LeadDemographicsResponse;
  currentGoals: StatsGoalRow[];
  goals: StatsGoalRow[];
  goalsSummary: StatsGoalsSummary;
  monthlySales: MonthlySalesMetric[];
};

export type StatsExportParams = {
  from: string;
  to: string;
  userId?: string;
  source?: string;
  companyId?: string | null;
};

async function resolveScopeLabel(
  user: AuthUser,
  scope: ResolvedGroupCompanyScope,
): Promise<string> {
  if (scope.mode === 'holding') {
    return 'Holding (toutes les entreprises du groupe)';
  }
  const company = await prisma.company.findUnique({
    where: { id: scope.companyId },
    select: { name: true },
  });
  if (company?.name) return company.name;
  if (user.companyId === scope.companyId) {
    const fallback = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { name: true },
    });
    return fallback?.name ?? 'Entreprise sélectionnée';
  }
  return 'Entreprise sélectionnée';
}

async function resolveCommercialLabel(
  userId: string | undefined,
): Promise<string | null> {
  if (!userId?.trim()) return null;
  const commercial = await prisma.user.findUnique({
    where: { id: userId.trim() },
    select: { name: true },
  });
  return commercial?.name ?? null;
}

async function withGoalRealized(goal: {
  id: string;
  userId: string;
  companyId: string;
  periodType: 'MONTH' | 'QUARTER' | 'SEMESTER' | 'YEAR';
  periodStart: Date;
  periodEnd: Date;
  targetConversions: number;
  targetRevenue: number;
  user: { id: string; name: string; email: string };
}): Promise<StatsGoalRow> {
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

  return {
    id: goal.id,
    periodLabel: getPeriodLabel(goal.periodType, goal.periodStart),
    targetConversions: goal.targetConversions,
    targetRevenue: goal.targetRevenue,
    realizedConversions,
    realizedRevenue: realizedRevenueResult._sum.amount ?? 0,
    user: goal.user,
  };
}

async function fetchGoalsForExport(
  scope: ResolvedGroupCompanyScope,
  userId?: string,
): Promise<StatsGoalRow[]> {
  const companyScope = prismaCompanyScopeFilter(scope);
  let where: Prisma.SalesGoalWhereInput = { ...companyScope, ...activeOnlyWhere };

  if (userId?.trim()) {
    const target = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { companyId: true },
    });
    if (!target || !userCompanyInScope(target.companyId, scope)) {
      return [];
    }
    where.userId = userId.trim();
  }

  const goals = await prisma.salesGoal.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ userId: 'asc' }, { periodStart: 'desc' }],
  });

  return Promise.all(goals.map((g) => withGoalRealized(g)));
}

async function fetchCurrentGoalsForExport(
  scope: ResolvedGroupCompanyScope,
  userId?: string,
): Promise<StatsGoalRow[]> {
  const companyScope = prismaCompanyScopeFilter(scope);
  const now = new Date();

  if (userId?.trim()) {
    const targetUser = await prisma.user.findUnique({
      where: { id: userId.trim() },
      select: { id: true, companyId: true },
    });
    if (!targetUser || !userCompanyInScope(targetUser.companyId, scope)) {
      return [];
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

    if (!goal) return [];
    return [await withGoalRealized(goal)];
  }

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

  const byUser = new Map<string, (typeof goals)[number]>();
  for (const g of goals) {
    if (!byUser.has(g.userId)) {
      byUser.set(g.userId, g);
    }
  }

  return Promise.all(
    Array.from(byUser.values()).map((g) => withGoalRealized(g)),
  );
}

function buildGoalsSummary(goals: StatsGoalRow[]): StatsGoalsSummary {
  return {
    goalsDefined: goals.length,
    commercialsCount: new Set(goals.map((g) => g.user.id)).size,
    realizedConversions: goals.reduce((s, g) => s + g.realizedConversions, 0),
    targetConversions: goals.reduce((s, g) => s + g.targetConversions, 0),
  };
}

export async function buildStatsExportPayload(
  user: AuthUser,
  params: StatsExportParams,
): Promise<StatsExportPayload | NextResponse> {
  const scopeCompanyId =
    params.companyId ??
    (params.userId
      ? (
          await prisma.user.findUnique({
            where: { id: params.userId },
            select: { companyId: true },
          })
        )?.companyId ?? null
      : null);

  const scope = await resolveGroupCompanyScope(
    user,
    hasGroupCompanyScope(user.role) ? scopeCompanyId : params.companyId ?? null,
  );
  if (scope instanceof NextResponse) return scope;

  const companyFilter = prismaCompanyScopeFilter(scope);
  const fromDate = new Date(params.from + 'T00:00:00.000Z');
  const toDate = new Date(params.to + 'T23:59:59.999Z');

  const salesParams = {
    companyFilter,
    fromDate,
    toDate,
    userId: params.userId,
    source: params.source,
  };

  const [scopeLabel, commercialLabel, sales, monthlySales, demographics, goals, currentGoals] =
    await Promise.all([
      resolveScopeLabel(user, scope),
      resolveCommercialLabel(params.userId),
      buildSalesSummaryReport(salesParams),
      buildMonthlySalesMetrics(salesParams),
      buildLeadDemographicsReport(scope, params.userId).catch(() => ({
        total: 0,
        byCivility: [],
        byActivitySector: [],
        byCompanyName: [],
        byGroupCompany: [],
        byLocation: [],
        byJobTitle: [],
      })),
      fetchGoalsForExport(scope, params.userId),
      fetchCurrentGoalsForExport(scope, params.userId),
    ]);

  return {
    meta: {
      scopeLabel,
      commercialLabel,
      salesPeriodFrom: params.from,
      salesPeriodTo: params.to,
      salesSource: params.source?.trim() || null,
      exportedAt: new Date().toISOString(),
      isHoldingScope: scope.mode === 'holding',
    },
    sales,
    demographics,
    currentGoals,
    goals,
    goalsSummary: buildGoalsSummary(goals),
    monthlySales,
  };
}
