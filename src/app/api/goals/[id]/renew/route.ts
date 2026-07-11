import { canMutateGoalForTargetCompany, requireRole } from "@/lib/auth";
import { getNextPeriod, getPeriodBounds, GoalPeriodType } from "@/lib/goalPeriods";
import { prisma } from "@/lib/prisma";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { NextResponse } from "next/server";

/** POST : reconduire un objectif sur la période suivante — ADMIN ou MANAGER uniquement. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["ADMIN", "MANAGER"]);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  if (!user.companyId) {
    return NextResponse.json(
      { error: "Utilisateur sans entreprise" },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;

    const existing = await prisma.salesGoal.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        companyId: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        targetConversions: true,
        targetRevenue: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Objectif introuvable" },
        { status: 404 }
      );
    }

    const mutationAllowed = await canMutateGoalForTargetCompany(
      user,
      existing.companyId,
    );
    if (mutationAllowed !== true) return mutationAllowed;

    // Recalculer le réalisé pour cet objectif (même logique que GET /api/goals)
    const realizedConversions = await prisma.client.count({
      where: {
        convertedById: existing.userId,
        convertedAt: {
          gte: existing.periodStart,
          lte: existing.periodEnd,
        },
        companyId: existing.companyId,
      },
    });

    const realizedRevenueResult = await prisma.sale.aggregate({
      where: {
        userId: existing.userId,
        companyId: existing.companyId,
        date: {
          gte: existing.periodStart,
          lte: existing.periodEnd,
        },
      },
      _sum: { amount: true },
    });

    const realizedRevenue = realizedRevenueResult._sum.amount ?? 0;

    const hasConversionTarget = existing.targetConversions > 0;
    const hasRevenueTarget = existing.targetRevenue > 0;

    const conversionsMet =
      !hasConversionTarget ||
      realizedConversions >= existing.targetConversions;
    const revenueMet =
      !hasRevenueTarget || realizedRevenue >= existing.targetRevenue;

    if (conversionsMet && revenueMet) {
      return NextResponse.json(
        {
          error:
            "Objectif déjà atteint, reconduction non nécessaire.",
        },
        { status: 400 }
      );
    }

    const periodType = existing.periodType as GoalPeriodType;
    const { year, month, quarter, semester } = getNextPeriod(
      periodType,
      existing.periodStart
    );
    const { periodStart, periodEnd } = getPeriodBounds(
      periodType,
      year,
      month,
      quarter,
      semester
    );

    const renewed = await prisma.salesGoal.upsert({
      where: {
        userId_periodType_periodStart: {
          userId: existing.userId,
          periodType: existing.periodType,
          periodStart,
        },
      },
      create: {
        userId: existing.userId,
        companyId: existing.companyId,
        periodType: existing.periodType,
        periodStart,
        periodEnd,
        targetConversions: existing.targetConversions,
        targetRevenue: existing.targetRevenue,
        setById: user.id,
      },
      update: {
        periodEnd,
        targetConversions: existing.targetConversions,
        targetRevenue: existing.targetRevenue,
        setById: user.id,
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.GOAL_RENEW,
      entityType: 'SalesGoal',
      entityId: renewed.id,
      summary: 'Reconduction d\'un objectif commercial',
      metadata: { previousGoalId: existing.id },
    });

    return NextResponse.json(renewed, { status: 201 });
  } catch (error) {
    console.error("POST /api/goals/[id]/renew error", error);
    return NextResponse.json(
      { error: "Impossible de reconduire l'objectif" },
      { status: 500 }
    );
  }
}

