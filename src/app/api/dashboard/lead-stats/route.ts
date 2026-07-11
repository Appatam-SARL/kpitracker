import { getCurrentUser } from "@/lib/auth";
import { resolveDashboardLeadWhere } from "@/lib/dashboard-company-scope";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get("companyId");
    const whereBase = await resolveDashboardLeadWhere(user, companyIdParam);
    if (whereBase instanceof NextResponse) return whereBase;

    const [total, converted] = await Promise.all([
      prisma.lead.count({ where: whereBase }),
      prisma.lead.count({
        where: { ...whereBase, status: "CONVERTED" },
      }),
    ]);

    const conversionRate =
      total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

    return NextResponse.json({
      total,
      converted,
      conversionRate,
    });
  } catch (error) {
    console.error("GET /api/dashboard/lead-stats error", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
