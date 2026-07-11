import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  contact: z.string().optional().nullable(),
  totalRevenue: z.number().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        company: true,
        convertedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }
    return NextResponse.json(client);
  } catch (error) {
    console.error("GET /api/clients/[id] error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer le client" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Corps de requête JSON invalide ou vide" },
        { status: 400 },
      );
    }

    const body = updateClientSchema.parse(json);

    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.contact !== undefined && { contact: body.contact }),
        ...(body.totalRevenue !== undefined && {
          totalRevenue: body.totalRevenue,
        }),
      },
      include: {
        company: true,
        convertedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    const authUser = await getCurrentUser();
    if (authUser) {
      await logUserAction({
        user: authUser,
        action: USER_ACTION_CODES.CLIENT_UPDATE,
        entityType: 'Client',
        entityId: client.id,
        summary: `Modification du client ${client.name}`,
        metadata: { label: client.name },
      });
    }
    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    console.error("PATCH /api/clients/[id] error", error);
    return NextResponse.json(
      { error: "Impossible de modifier le client" },
      { status: 500 }
    );
  }
}
