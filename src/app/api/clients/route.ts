import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import {
  buildConversionSaleItems,
  computeLeadInterestsRevenue,
  CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE,
} from "@/lib/lead-conversion";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const convertLeadSchema = z.object({
  leadId: z.string().min(1),
});

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }

    const clients = await prisma.client.findMany({
      where: { companyId: user.companyId },
      include: {
        company: true,
        convertedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error("GET /api/clients error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les clients" },
      { status: 500 },
    );
  }
}

// Convertit un lead en client à partir de son id
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 },
      );
    }

    const json = await req.json();
    const { leadId } = convertLeadSchema.parse(json);

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        company: true,
        productInterests: {
          select: {
            productId: true,
            customName: true,
            estimatedValue: true,
            product: { select: { name: true } },
          },
        },
        serviceInterests: {
          select: {
            serviceId: true,
            customName: true,
            estimatedValue: true,
            service: { select: { name: true } },
          },
        },
        activityDomains: {
          select: { domain: true },
          orderBy: { domain: 'asc' },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "Lead introuvable" },
        { status: 404 },
      );
    }

    if (
      lead.productInterests.length === 0 &&
      lead.serviceInterests.length === 0
    ) {
      return NextResponse.json(
        { error: CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE },
        { status: 400 },
      );
    }

    const conversionRevenue = computeLeadInterestsRevenue(
      lead.productInterests,
      lead.serviceInterests,
    );
    const conversionDate = new Date();

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const customProductInterests = lead.productInterests.filter(
        (i) => !i.productId && i.customName,
      );
      const customServiceInterests = lead.serviceInterests.filter(
        (i) => !i.serviceId && i.customName,
      );
      const customInterestNotesLines = [
        ...customProductInterests.map(
          (i) => `- Produit (autre): ${i.customName} (${i.estimatedValue} FCFA)`,
        ),
        ...customServiceInterests.map(
          (i) => `- Service (autre): ${i.customName} (${i.estimatedValue} FCFA)`,
        ),
      ];
      const appendedCustomInterestsNotes =
        customInterestNotesLines.length > 0
          ? [
              lead.notes?.trim() || '',
              '',
              'Intérêts personnalisés du prospect (hors catalogue):',
              ...customInterestNotesLines,
            ]
              .filter((line, idx, arr) => !(idx === 0 && !line && arr[1] === ''))
              .join('\n')
          : lead.notes || undefined;

      const client = await tx.client.create({
        data: {
          name: `${lead.firstName} ${lead.lastName}`.trim(),
          contact: lead.phone || lead.email || undefined,
          email: lead.email || undefined,
          phone: lead.phone || undefined,
          source: lead.source || undefined,
          civility: lead.civility || undefined,
          activityDomain:
            lead.activityDomains.length > 0
              ? lead.activityDomains.map((d) => d.domain).join(', ')
              : undefined,
          companyName: lead.companyName ?? lead.company?.name,
          location: lead.location || undefined,
          notes: appendedCustomInterestsNotes || undefined,
          companyId: lead.companyId,
          convertedById: user.id,
          convertedAt: conversionDate,
          totalRevenue: conversionRevenue,
        },
      });

      if (conversionRevenue > 0) {
        const saleItems = buildConversionSaleItems(
          lead.productInterests,
          lead.serviceInterests,
        );
        await tx.sale.create({
          data: {
            clientId: client.id,
            userId: user.id,
            companyId: lead.companyId,
            date: conversionDate,
            amount: conversionRevenue,
            ...(saleItems.length > 0
              ? { items: { create: saleItems } }
              : {}),
          },
        });
      }

      // Si des produits / services étaient déjà renseignés sur le lead,
      // on les initialise comme intérêts du client avec une valeur estimative issue du lead.
      const hasClientProductInterest =
        (tx as any).clientProductInterest !== undefined;
      const hasClientServiceInterest =
        (tx as any).clientServiceInterest !== undefined;

      const productInterestsSource = lead.productInterests
        .filter((i) => !!i.productId)
        .map((i) => ({
        productId: i.productId as string,
        estimatedValue: i.estimatedValue,
      }));

      const serviceInterestsSource = lead.serviceInterests
        .filter((i) => !!i.serviceId)
        .map((i) => ({
        serviceId: i.serviceId as string,
        estimatedValue: i.estimatedValue,
      }));

      if (hasClientProductInterest && productInterestsSource.length > 0) {
        await (tx as any).clientProductInterest.createMany({
          data: productInterestsSource.map((product) => ({
            clientId: client.id,
            productId: product.productId,
            estimatedValue: product.estimatedValue,
          })),
        });
      }

      if (hasClientServiceInterest && serviceInterestsSource.length > 0) {
        await (tx as any).clientServiceInterest.createMany({
          data: serviceInterestsSource.map((service) => ({
            clientId: client.id,
            serviceId: service.serviceId,
            estimatedValue: service.estimatedValue,
          })),
        });
      }

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: { status: "CONVERTED" },
      });

      return { client, lead: updatedLead };
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.CLIENT_CREATE,
      entityType: 'Client',
      entityId: result.client.id,
      summary: `Conversion du prospect en client : ${result.client.name}`,
      metadata: { label: result.client.name, leadId: result.lead.id },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 },
      );
    }
    console.error("POST /api/clients error", error);
    return NextResponse.json(
      { error: "Impossible de convertir le lead en client" },
      { status: 500 },
    );
  }
}

