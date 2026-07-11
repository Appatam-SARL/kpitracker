import { getCurrentUser } from "@/lib/auth";
import { resolveDashboardLeadWhere } from "@/lib/dashboard-company-scope";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUS_KEYS = ["NEW", "CONTACTED", "QUALIFIED", "LOST", "CONVERTED"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get("companyId");
    const whereBase = await resolveDashboardLeadWhere(user, companyIdParam);
    if (whereBase instanceof NextResponse) return whereBase;

    const group = await prisma.lead.groupBy({
      by: ["status"],
      where: whereBase,
      _count: { _all: true },
    });

    const counts: Record<StatusKey, number> = {
      NEW: 0,
      CONTACTED: 0,
      QUALIFIED: 0,
      LOST: 0,
      CONVERTED: 0,
    };

    for (const row of group) {
      const key = row.status as StatusKey;
      if (key in counts) {
        counts[key] = row._count._all;
      }
    }

    return NextResponse.json(
      STATUS_KEYS.map((status) => ({ status, count: counts[status] })),
    );
  } catch (error) {
    console.error("GET /api/dashboard/lead-status-distribution error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
