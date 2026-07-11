import { requireRole } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const saleItemSchema = z
  .object({
    productId: z.string().optional(),
    serviceId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().min(0),
  })
  .refine((item) => item.productId || item.serviceId, {
    message: 'Chaque ligne doit avoir un productId ou un serviceId',
  });

const createSaleSchema = z.object({
  clientId: z.string().min(1),
  date: z.string().datetime().optional(),
  items: z.array(saleItemSchema).min(1),
});

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** POST /api/sales
 * Enregistre une vente pour un client, par le user connecté.
 * Rôles autorisés : ADMIN, MANAGER, AGENT.
 */
export async function POST(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER', 'AGENT']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  if (!user.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }

  try {
    const json = await req.json();
    const body = createSaleSchema.parse(json);

    const client = await prisma.client.findUnique({
      where: { id: body.clientId },
      select: { id: true, companyId: true },
    });

    if (!client || client.companyId !== user.companyId) {
      return NextResponse.json(
        { error: "Client introuvable ou d'une autre entreprise" },
        { status: 403 },
      );
    }

    const saleDate = body.date ? new Date(body.date) : new Date();
    if (Number.isNaN(saleDate.getTime())) {
      return NextResponse.json(
        { error: 'Date de vente invalide' },
        { status: 400 },
      );
    }

    const itemsWithTotals = body.items.map((item) => ({
      ...item,
      lineTotal: item.quantity * item.unitPrice,
    }));
    const amount = itemsWithTotals.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    const result = await prisma.$transaction(async (tx: PrismaTx) => {
      const sale = await tx.sale.create({
        data: {
          clientId: client.id,
          userId: user.id,
          companyId: client.companyId,
          date: saleDate,
          amount,
          items: {
            create: itemsWithTotals.map((item) => ({
              productId: item.productId ?? null,
              serviceId: item.serviceId ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Mise à jour dérivée du CA total du client
      await tx.client.update({
        where: { id: client.id },
        data: {
          totalRevenue: { increment: amount },
        },
      });

      return sale;
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.SALE_CREATE,
      entityType: 'Sale',
      entityId: result.id,
      summary: `Enregistrement d'une vente (${result.amount.toLocaleString('fr-FR')} XOF)`,
      metadata: { clientId: result.clientId, amount: result.amount },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(' ; ') },
        { status: 400 },
      );
    }
    console.error('POST /api/sales error', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer la vente" },
      { status: 500 },
    );
  }
}
