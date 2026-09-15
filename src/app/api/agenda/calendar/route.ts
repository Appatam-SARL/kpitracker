import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, resolveGroupCompanyScope } from "@/lib/auth";
import {
  prismaCompanyScopeFilter,
  userCompanyInScope,
} from "@/lib/group-scope-roles";

type AgendaItemWhereInput = NonNullable<
  Parameters<typeof prisma.agendaItem.findMany>[0]
>["where"];

/**
 * GET /api/agenda/calendar?from=ISO&to=ISO[&userId=...][&companyId=...]
 *
 * Règles d'accès :
 * - AGENT  : tâches qu'il/elle a créées
 * - MANAGER / ADMIN / rôles groupe : tâches créées par les utilisateurs du périmètre société
 */
export async function GET(req: Request) {
  try {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    if (!authUser.companyId) {
      return NextResponse.json(
        { error: "Société introuvable pour cet utilisateur" },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const createdByIdFilter = url.searchParams.get("userId");

    const scope = await resolveGroupCompanyScope(
      authUser,
      url.searchParams.get("companyId"),
    );
    if (scope instanceof NextResponse) return scope;
    const companyScope = prismaCompanyScopeFilter(scope);

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: "Paramètres from et to (ISO date) requis" },
        { status: 400 },
      );
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Dates from/to invalides" },
        { status: 400 },
      );
    }

    let where: AgendaItemWhereInput = {
      dueDate: { gte: from, lte: to },
    };

    if (authUser.role === "AGENT") {
      where = {
        dueDate: { gte: from, lte: to },
        createdById: authUser.id,
      };
    } else if (createdByIdFilter) {
      const target = await prisma.user.findUnique({
        where: { id: createdByIdFilter },
        select: { companyId: true },
      });
      if (!target || !userCompanyInScope(target.companyId, scope)) {
        return NextResponse.json(
          { error: "Utilisateur cible introuvable ou d'une autre société" },
          { status: 403 },
        );
      }
      where = {
        dueDate: { gte: from, lte: to },
        createdById: createdByIdFilter,
      };
    } else {
      where = {
        dueDate: { gte: from, lte: to },
        createdBy: companyScope,
      };
    }

    const items = await prisma.agendaItem.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        prospect: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Compat UI : exposer aussi `lead` (entreprise) pour AgendaCalendarBlock
    const mapped = items.map((item) => ({
      ...item,
      lead: item.prospect
        ? {
            id: item.prospect.id,
            firstName: item.prospect.name,
            lastName: "",
            assignedTo: null,
            company: null,
          }
        : null,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("GET /api/agenda/calendar error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer le calendrier" },
      { status: 500 },
    );
  }
}
