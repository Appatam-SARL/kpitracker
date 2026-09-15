import { getCurrentUser } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import {
  buildConversionSaleItems,
  computeLeadInterestsRevenue,
  CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE,
} from '@/lib/lead-conversion';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const convertSchema = z
  .object({
    contactId: z.string().min(1).optional(),
    /** Alias : id contact (rétrocompat leadId) */
    leadId: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.contactId || v.leadId), {
    message: 'contactId requis',
  });

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
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
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error('GET /api/clients error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les clients' },
      { status: 500 },
    );
  }
}

/** Convertit un contact prospect → client de la société de la commerciale. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (!user.companyId) {
      return NextResponse.json(
        { error: "Aucune société associée à l'utilisateur" },
        { status: 400 },
      );
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const json = await req.json();
    const parsed = convertSchema.parse(json);
    const contactId = parsed.contactId || parsed.leadId!;

    const contact = await prisma.prospectContact.findFirst({
      where: { id: contactId, deletedAt: null },
      include: {
        prospect: {
          include: {
            activityDomains: { select: { domain: true } },
          },
        },
        productInterests: {
          where: { userId: user.id },
          select: {
            productId: true,
            customName: true,
            estimatedValue: true,
            product: { select: { name: true } },
          },
        },
        serviceInterests: {
          where: { userId: user.id },
          select: {
            serviceId: true,
            customName: true,
            estimatedValue: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    if (!contact || contact.prospect.deletedAt) {
      return NextResponse.json(
        { error: 'Contact / prospect introuvable' },
        { status: 404 },
      );
    }

    if (
      contact.productInterests.length === 0 &&
      contact.serviceInterests.length === 0
    ) {
      return NextResponse.json(
        { error: CONVERT_REQUIRES_PIVOT_INTERESTS_MESSAGE },
        { status: 400 },
      );
    }

    const conversionRevenue = computeLeadInterestsRevenue(
      contact.productInterests,
      contact.serviceInterests,
    );
    const conversionDate = new Date();
    const prospect = contact.prospect;

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const customProductInterests = contact.productInterests.filter(
        (i) => !i.productId && i.customName,
      );
      const customServiceInterests = contact.serviceInterests.filter(
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
      const notes = [
        prospect.notes?.trim() || '',
        contact.notes?.trim() || '',
        customInterestNotesLines.length
          ? [
              'Intérêts personnalisés (hors catalogue):',
              ...customInterestNotesLines,
            ].join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const client = await tx.client.create({
        data: {
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          contact: contact.phone || contact.email || undefined,
          email: contact.email || undefined,
          phone: contact.phone || undefined,
          source: prospect.source || undefined,
          civility: contact.civility || undefined,
          activityDomain:
            prospect.activityDomains.length > 0
              ? prospect.activityDomains.map((d) => d.domain).join(', ')
              : undefined,
          companyName: prospect.name,
          location: prospect.location || undefined,
          notes: notes || undefined,
          companyId: user.companyId!,
          convertedById: user.id,
          convertedAt: conversionDate,
          convertedFromProspectId: prospect.id,
          totalRevenue: conversionRevenue,
        },
      });

      if (conversionRevenue > 0) {
        const saleItems = buildConversionSaleItems(
          contact.productInterests,
          contact.serviceInterests,
        );
        await tx.sale.create({
          data: {
            clientId: client.id,
            userId: user.id,
            companyId: user.companyId!,
            date: conversionDate,
            amount: conversionRevenue,
            ...(saleItems.length > 0 ? { items: { create: saleItems } } : {}),
          },
        });
      }

      for (const i of contact.productInterests) {
        if (!i.productId) continue;
        await tx.clientProductInterest.create({
          data: {
            clientId: client.id,
            productId: i.productId,
            estimatedValue: i.estimatedValue ?? 0,
          },
        });
      }
      for (const i of contact.serviceInterests) {
        if (!i.serviceId) continue;
        await tx.clientServiceInterest.create({
          data: {
            clientId: client.id,
            serviceId: i.serviceId,
            estimatedValue: i.estimatedValue ?? 0,
          },
        });
      }

      await tx.prospectContact.update({
        where: { id: contact.id },
        data: { negotiationStage: 'VENTE_CONCLUE' },
      });

      await tx.prospect.update({
        where: { id: prospect.id },
        data: { status: 'VENTE_CONCLUE' },
      });

      return client;
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.CLIENT_CREATE,
      entityType: 'Client',
      entityId: result.id,
      summary: `Conversion contact ${contact.firstName} ${contact.lastName} → client`,
      metadata: { prospectId: prospect.id, contactId: contact.id },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('POST /api/clients error', error);
    return NextResponse.json(
      { error: 'Impossible de convertir en client' },
      { status: 500 },
    );
  }
}
