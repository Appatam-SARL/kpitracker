import { getCurrentUser } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const interestsPayloadSchema = z.object({
  items: z.array(
    z
      .object({
        kind: z.enum(['product', 'service']),
        id: z.string().min(1).optional(),
        customName: z.string().trim().min(2).optional(),
        estimatedValue: z.number().min(0),
      })
      .refine(
        (item) => (item.id ? 1 : 0) + (item.customName ? 1 : 0) === 1,
        'Chaque intérêt doit contenir soit id soit customName (mais pas les deux).',
      ),
  ),
});

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function normalizeCustomName(value: string) {
  return value.trim().toLocaleLowerCase('fr-FR');
}

/** PUT /api/leads/[id]/interests - Remplace les intérêts (produits/services) d'un lead avec estimation */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;
    const json = await req.json();
    const body = interestsPayloadSchema.parse(json);

    const productRaw = body.items.filter((i) => i.kind === 'product');
    const serviceRaw = body.items.filter((i) => i.kind === 'service');

    const dedupedProducts = new Map<
      string,
      { productId?: string; customName?: string; estimatedValue: number }
    >();
    for (const item of productRaw) {
      if (item.id) {
        dedupedProducts.set(`id:${item.id}`, {
          productId: item.id,
          estimatedValue: item.estimatedValue,
        });
      } else if (item.customName) {
        const normalized = normalizeCustomName(item.customName);
        dedupedProducts.set(`custom:${normalized}`, {
          customName: item.customName.trim(),
          estimatedValue: item.estimatedValue,
        });
      }
    }

    const dedupedServices = new Map<
      string,
      { serviceId?: string; customName?: string; estimatedValue: number }
    >();
    for (const item of serviceRaw) {
      if (item.id) {
        dedupedServices.set(`id:${item.id}`, {
          serviceId: item.id,
          estimatedValue: item.estimatedValue,
        });
      } else if (item.customName) {
        const normalized = normalizeCustomName(item.customName);
        dedupedServices.set(`custom:${normalized}`, {
          customName: item.customName.trim(),
          estimatedValue: item.estimatedValue,
        });
      }
    }

    const productItems = Array.from(dedupedProducts.values());
    const serviceItems = Array.from(dedupedServices.values());

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const leadExists = await tx.lead.findUnique({
        where: { id: leadId },
        select: { id: true },
      });
      if (!leadExists) {
        return { notFound: true as const };
      }

      await tx.leadProductInterest.deleteMany({ where: { leadId } });
      await tx.leadServiceInterest.deleteMany({ where: { leadId } });

      if (productItems.length > 0) {
        await tx.leadProductInterest.createMany({
          data: productItems.map((p) => ({
            leadId,
            productId: p.productId ?? null,
            customName: p.customName ?? null,
            estimatedValue: p.estimatedValue,
          })),
        });
      }
      if (serviceItems.length > 0) {
        await tx.leadServiceInterest.createMany({
          data: serviceItems.map((s) => ({
            leadId,
            serviceId: s.serviceId ?? null,
            customName: s.customName ?? null,
            estimatedValue: s.estimatedValue,
          })),
        });
      }

      const customProducts = productItems.filter((i) => !!i.customName).length;
      const customServices = serviceItems.filter((i) => !!i.customName).length;
      return {
        notFound: false as const,
        counts: {
          products: productItems.length,
          services: serviceItems.length,
          customProducts,
          customServices,
        },
      };
    });

    if (result.notFound) {
      return NextResponse.json({ error: 'Lead introuvable' }, { status: 404 });
    }

    const authUser = await getCurrentUser();
    if (authUser) {
      await logUserAction({
        user: authUser,
        action: USER_ACTION_CODES.LEAD_INTERESTS_UPDATE,
        entityType: 'Lead',
        entityId: leadId,
        summary: 'Mise à jour des intérêts produits/services du prospect',
        metadata: { counts: result.counts },
      });
    }

    return NextResponse.json({
      ok: true,
      message: 'Intérêts enregistrés avec succès.',
      counts: result.counts,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(', ') },
        { status: 400 },
      );
    }
    console.error('PUT /api/leads/[id]/interests error', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer les intérêts" },
      { status: 500 },
    );
  }
}

