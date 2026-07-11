import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hasGroupCompanyScope } from "@/lib/group-scope-roles";
import { agentCanAccessUnassignedLegacyLead } from "@/lib/agentLegacyLeadAccess";
import {
  leadActivityDomainsInclude,
  serializeLeadWithActivityDomains,
} from "@/lib/lead-activity-domains";

/** GET /api/leads/[id] - Récupère un lead avec sa société */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        products: {
          select: { id: true, name: true },
        },
        services: {
          select: { id: true, name: true },
        },
        productInterests: {
          select: {
            estimatedValue: true,
            customName: true,
            product: { select: { id: true, name: true } },
          },
        },
        serviceInterests: {
          select: {
            estimatedValue: true,
            customName: true,
            service: { select: { id: true, name: true } },
          },
        },
        ...leadActivityDomainsInclude,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    // Multi-tenant: accessible dans la société de l'utilisateur.
    // Rôles groupe : accès global (multi-entreprises).
    if (!hasGroupCompanyScope(user.role) && lead.companyId !== user.companyId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Commercial: uniquement les leads qui lui sont attribués.
    // Legacy transition: lead non assigné dont la première activité de création/import
    // (leadId ou relatedTo) est la sienne.
    if (user.role === "AGENT" && lead.assignedTo !== user.id) {
      if (lead.assignedTo !== null) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const legacyOk = await agentCanAccessUnassignedLegacyLead(
        id,
        user.companyId,
        user.id,
      );
      if (!legacyOk) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const [activities, totalActivities] = await Promise.all([
      prisma.activity.findMany({
        where: {
          OR: [{ leadId: id }, { relatedTo: id }],
        },
        orderBy: { date: "desc" },
        take: 20,
        include: { user: { select: { name: true } } },
      }),
      prisma.activity.count({
        where: {
          OR: [{ leadId: id }, { relatedTo: id }],
        },
      }),
    ]);

    return NextResponse.json({
      ...serializeLeadWithActivityDomains(lead),
      activities,
      totalActivities,
      hasMoreActivities: totalActivities > activities.length,
    });
  } catch (error) {
    console.error("GET /api/leads/[id] error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer le lead" },
      { status: 500 }
    );
  }
}
