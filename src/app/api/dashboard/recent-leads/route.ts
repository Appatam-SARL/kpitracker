import { getCurrentUser } from "@/lib/auth";
import { resolveDashboardLeadWhere } from "@/lib/dashboard-company-scope";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RECENT_LEADS_LIMIT = 8;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const companyIdParam = new URL(req.url).searchParams.get("companyId");
    const whereClause = await resolveDashboardLeadWhere(user, companyIdParam);
    if (whereClause instanceof NextResponse) return whereClause;

    const leads = await prisma.prospect.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: RECENT_LEADS_LIMIT,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 2,
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            contacts: { where: { deletedAt: null } },
          },
        },
      },
    });

    const result = leads.map((l) => {
      const primary = l.contacts[0] ?? null;
      const contactName = primary
        ? [primary.firstName, primary.lastName].filter(Boolean).join(" ").trim()
        : "";
      return {
        id: l.id,
        companyName: l.name,
        firstName: l.name,
        lastName: "",
        contactName: contactName || null,
        email: primary?.email ?? null,
        phone: primary?.phone ?? null,
        contactsCount: l._count.contacts,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/dashboard/recent-leads error", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
