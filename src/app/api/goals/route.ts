import { canMutateGoalForTargetCompany, getCurrentUser, requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import {
  GROUP_SCOPE_ROLES,
  hasGroupCompanyScope,
  prismaCompanyScopeFilter,
  type ResolvedGroupCompanyScope,
  userCompanyInScope,
} from '@/lib/group-scope-roles';
import { sendGoalAssignmentEmails } from '@/lib/goal-email';
import { getPeriodBounds, getPeriodLabel } from '@/lib/goalPeriods';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { activeOnlyWhere } from '@/lib/trash';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, GoalPeriodType } from '@prisma/client';

const createGoalSchema = z.object({
  userId: z.string().min(1),
  periodType: z.enum(['MONTH', 'QUARTER', 'SEMESTER', 'YEAR']),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12).optional(),
  quarter: z.number().int().min(1).max(4).optional(),
  semester: z.number().int().min(1).max(2).optional(),
  targetConversions: z.number().int().min(0).default(0),
  targetRevenue: z.number().min(0).default(0),
});

/** POST : créer ou mettre à jour un objectif — ADMIN ou MANAGER uniquement. */
export async function POST(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;
  if (!user.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }
  try {
    const json = await req.json();
    const body = createGoalSchema.parse(json);

    const targetUser = await prisma.user.findFirst({
      where: { id: body.userId, deletedAt: null },
      select: { id: true, companyId: true },
    });
    if (!targetUser?.companyId) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé ou autre entreprise' },
        { status: 403 },
      );
    }
    const mutationAllowed = await canMutateGoalForTargetCompany(
      user,
      targetUser.companyId,
    );
    if (mutationAllowed !== true) return mutationAllowed;
    const { periodStart, periodEnd } = getPeriodBounds(
      body.periodType,
      body.year,
      body.month,
      body.quarter,
      body.semester,
    );

    const goal = await prisma.salesGoal.upsert({
      where: {
        userId_periodType_periodStart: {
          userId: body.userId,
          periodType: body.periodType,
          periodStart,
        },
      },
      create: {
        userId: body.userId,
        companyId: targetUser.companyId,
        periodType: body.periodType,
        periodStart,
        periodEnd,
        targetConversions: body.targetConversions,
        targetRevenue: body.targetRevenue,
        setById: user.id,
      },
      update: {
        periodEnd,
        targetConversions: body.targetConversions,
        targetRevenue: body.targetRevenue,
        setById: user.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        setBy: { select: { id: true, name: true } },
      },
    });

    try {
      const [company, managersAndAdmins, groupDirectrices] = await Promise.all([
        prisma.company.findUnique({
          where: { id: goal.companyId },
          select: { name: true },
        }),
        prisma.user.findMany({
          where: {
            companyId: goal.companyId,
            role: { in: ['MANAGER', 'ADMIN'] },
          },
          select: { email: true },
        }),
        prisma.user.findMany({
          where: { role: { in: [...GROUP_SCOPE_ROLES] } },
          select: { email: true },
        }),
      ]);

      const managementRecipients = [
        ...managersAndAdmins.map((u) => u.email),
        ...groupDirectrices.map((u) => u.email),
      ];

      await sendGoalAssignmentEmails({
        companyName: company?.name ?? 'Votre entreprise',
        commercialName: goal.user.name,
        commercialEmail: goal.user.email,
        periodType: goal.periodType,
        periodStart: goal.periodStart,
        targetConversions: goal.targetConversions,
        targetRevenue: goal.targetRevenue,
        setByName: goal.setBy?.name ?? 'Systeme',
        managementRecipients,
      });
    } catch (emailError) {
      console.error('POST /api/goals email error', {
        goalId: goal.id,
        companyId: goal.companyId,
        message:
          emailError instanceof Error ? emailError.message : 'Unknown error',
      });
    }

    await logUserAction({
      user,
      action: USER_ACTION_CODES.GOAL_CREATE,
      entityType: 'SalesGoal',
      entityId: goal.id,
      summary: `Définition d'un objectif commercial`,
      metadata: { userId: goal.userId, periodType: goal.periodType },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues.map((err) => err.message).join(' ; ') },
        { status: 400 },
      );
    }
    if (e instanceof Error && e.message.includes('doit être')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('POST /api/goals error', e);
    return NextResponse.json(
      { error: "Impossible de créer ou mettre à jour l'objectif" },
      { status: 500 },
    );
  }
}

/** GET : liste des objectifs. ADMIN/MANAGER = company ; AGENT = uniquement les siens. DIRECTRICE : ?companyId= (optionnel, aligné /api/leads). Query : userId?, periodType?, year?. */
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
  const periodTypeParam = url.searchParams.get('periodType');
  const yearParam = url.searchParams.get('year');

  let companyScope = prismaCompanyScopeFilter({
    mode: 'single',
    companyId: currentUser.companyId,
  });
  let resolvedScope: ResolvedGroupCompanyScope | null = null;
  if (hasGroupCompanyScope(currentUser.role)) {
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

    const scope = await resolveGroupCompanyScope(
      currentUser,
      scopeCompanyId,
    );
    if (scope instanceof NextResponse) return scope;
    resolvedScope = scope;
    companyScope = prismaCompanyScopeFilter(scope);
  }

  let where: Prisma.SalesGoalWhereInput = {
    ...companyScope,
    ...activeOnlyWhere,
  };

  if (currentUser.role === 'AGENT') {
    where.userId = currentUser.id;
  } else if (userIdParam) {
    const target = await prisma.user.findUnique({
      where: { id: userIdParam },
      select: { companyId: true },
    });
    if (
      !target ||
      (resolvedScope
        ? !userCompanyInScope(target.companyId, resolvedScope)
        : target.companyId !== currentUser.companyId)
    ) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé ou autre entreprise' },
        { status: 403 },
      );
    }
    where.userId = userIdParam;
  }

  if (periodTypeParam) {
    const allowed: GoalPeriodType[] = ['MONTH', 'QUARTER', 'SEMESTER', 'YEAR'];
    if (allowed.includes(periodTypeParam as GoalPeriodType)) {
      where = {
        ...where,
        periodType: periodTypeParam as GoalPeriodType,
      };
    }
  }
  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!Number.isNaN(y)) {
      where.periodStart = {
        gte: new Date(Date.UTC(y, 0, 1)),
        lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
    }
  }

  try {
    const goals = await prisma.salesGoal.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        setBy: { select: { id: true, name: true } },
      },
      orderBy: [{ userId: 'asc' }, { periodStart: 'desc' }],
    });

    const withRealized = await Promise.all(
      goals.map(async (g) => {
        // Conversions réalisées : toujours basé sur les clients convertis
        const realizedConversions = await prisma.client.count({
          where: {
            convertedById: g.userId,
            convertedAt: {
              gte: g.periodStart,
              lte: g.periodEnd,
            },
            companyId: g.companyId,
          },
        });

        // CA réalisé : somme des ventes réelles (Sale.amount) sur la période
        const realizedRevenueResult = await prisma.sale.aggregate({
          where: {
            userId: g.userId,
            companyId: g.companyId,
            date: {
              gte: g.periodStart,
              lte: g.periodEnd,
            },
          },
          _sum: { amount: true },
        });
        const realizedRevenue = realizedRevenueResult._sum.amount ?? 0;

        return {
          ...g,
          periodLabel: getPeriodLabel(g.periodType, g.periodStart),
          realizedConversions,
          realizedRevenue,
        };
      }),
    );

    return NextResponse.json(withRealized);
  } catch (error) {
    console.error('GET /api/goals error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les objectifs' },
      { status: 500 },
    );
  }
}
