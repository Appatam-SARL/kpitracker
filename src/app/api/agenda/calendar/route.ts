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
 * - AGENT  : ne voit que les tâches qu'il/elle a créées (agendaItem.createdById = user.id)
 * - MANAGER / ADMIN :
 *    - par défaut : toutes les tâches créées par des utilisateurs de la société
 *    - si userId est fourni : uniquement les tâches créées par cet utilisateur (même société)
 * - Rôles groupe (directrice commerciale, PDG, directrice opération) : ?companyId= optionnel (aligné /api/leads)
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

    // Base: plage de dates + périmètre entreprise (via le lead)
    let where: AgendaItemWhereInput = {
      dueDate: { gte: from, lte: to },
      lead: companyScope,
    };

    if (authUser.role === "AGENT") {
      where = {
        dueDate: { gte: from, lte: to },
        createdById: authUser.id,
        lead: companyScope,
      };
    } else if (createdByIdFilter) {
      // Filtre optionnel par créateur (commercial) : on vérifie qu'il appartient à la société ciblée
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
        lead: companyScope,
      };
    } else {
      // Manager / Admin / Directrice : toutes les tâches créées par les utilisateurs de l'entreprise
      where = {
        dueDate: { gte: from, lte: to },
        createdBy: companyScope,
        lead: companyScope,
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
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            assignedTo: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/agenda/calendar error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer le calendrier" },
      { status: 500 },
    );
  }
}

