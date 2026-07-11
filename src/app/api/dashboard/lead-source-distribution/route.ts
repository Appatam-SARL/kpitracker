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

    const rows = await prisma.lead.findMany({
      where: whereBase,
      select: { source: true },
    });

    return NextResponse.json(
      rows.map((r) => ({ source: r.source ?? null })),
    );
  } catch (error) {
    console.error("GET /api/dashboard/lead-source-distribution error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
