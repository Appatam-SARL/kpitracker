import { getCurrentUser } from '@/lib/auth';
import {
  canManageContact,
  requireGroupProspectsAccess,
} from '@/lib/prospect-access';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const interestItemSchema = z
  .object({
    id: z.string().optional(),
    customName: z.string().trim().min(2).optional(),
    estimatedValue: z.number().min(0).default(0),
  })
  .refine((v) => Boolean(v.id) || Boolean(v.customName), {
    message: 'id catalogue ou customName requis',
  });

const putSchema = z.object({
  products: z.array(interestItemSchema).default([]),
  services: z.array(interestItemSchema).default([]),
  /** Format ancien LeadInterestsEstimatorCard */
  items: z
    .array(
      z.union([
        z.object({
          kind: z.enum(['product', 'service']),
          id: z.string().min(1),
          estimatedValue: z.number().min(0).default(0),
        }),
        z.object({
          kind: z.enum(['product', 'service']),
          customName: z.string().trim().min(2),
          estimatedValue: z.number().min(0).default(0),
        }),
      ]),
    )
    .optional(),
});

/**
 * PUT /api/prospects/[id]/contacts/[contactId]/interests
 * Remplace les intérêts de l'utilisateur courant sur ce contact.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;
    if (!user.companyId) {
      return NextResponse.json(
        { error: 'Société non associée' },
        { status: 403 },
      );
    }

    const { id: prospectId, contactId } = await params;
    const contact = await prisma.prospectContact.findFirst({
      where: { id: contactId, prospectId, deletedAt: null },
    });
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact introuvable' },
        { status: 404 },
      );
    }
    if (!canManageContact(user, contact)) {
      return NextResponse.json(
        { error: 'Accès refusé à cette fiche contact.' },
        { status: 403 },
      );
    }

    const raw = putSchema.parse(await req.json());
    const products =
      raw.items && raw.items.length > 0
        ? raw.items
            .filter((i) => i.kind === 'product')
            .map((i) =>
              'id' in i && i.id
                ? { id: i.id, estimatedValue: i.estimatedValue }
                : {
                    customName: 'customName' in i ? i.customName : undefined,
                    estimatedValue: i.estimatedValue,
                  },
            )
        : raw.products;
    const services =
      raw.items && raw.items.length > 0
        ? raw.items
            .filter((i) => i.kind === 'service')
            .map((i) =>
              'id' in i && i.id
                ? { id: i.id, estimatedValue: i.estimatedValue }
                : {
                    customName: 'customName' in i ? i.customName : undefined,
                    estimatedValue: i.estimatedValue,
                  },
            )
        : raw.services;

    const productIds = products
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id));
    const serviceIds = services
      .map((s) => s.id)
      .filter((id): id is string => Boolean(id));

    if (productIds.length) {
      const count = await prisma.product.count({
        where: { id: { in: productIds }, companyId: user.companyId },
      });
      if (count !== productIds.length) {
        return NextResponse.json(
          { error: 'Produit hors catalogue de votre société' },
          { status: 400 },
        );
      }
    }
    if (serviceIds.length) {
      const count = await prisma.service.count({
        where: { id: { in: serviceIds }, companyId: user.companyId },
      });
      if (count !== serviceIds.length) {
        return NextResponse.json(
          { error: 'Service hors catalogue de votre société' },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.prospectProductInterest.deleteMany({
        where: { contactId, userId: user.id },
      });
      await tx.prospectServiceInterest.deleteMany({
        where: { contactId, userId: user.id },
      });

      for (const p of products) {
        await tx.prospectProductInterest.create({
          data: {
            contactId,
            userId: user.id,
            productId: p.id ?? null,
            customName: p.id ? null : p.customName ?? null,
            estimatedValue: p.estimatedValue ?? 0,
          },
        });
      }
      for (const s of services) {
        await tx.prospectServiceInterest.create({
          data: {
            contactId,
            userId: user.id,
            serviceId: s.id ?? null,
            customName: s.id ? null : s.customName ?? null,
            estimatedValue: s.estimatedValue ?? 0,
          },
        });
      }
    });

    const [productInterests, serviceInterests] = await Promise.all([
      prisma.prospectProductInterest.findMany({
        where: { contactId, userId: user.id },
        include: { product: { select: { id: true, name: true } } },
      }),
      prisma.prospectServiceInterest.findMany({
        where: { contactId, userId: user.id },
        include: { service: { select: { id: true, name: true } } },
      }),
    ]);

    return NextResponse.json({ productInterests, serviceInterests });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }
    console.error('PUT contact interests error', error);
    return NextResponse.json(
      { error: 'Impossible d’enregistrer les intérêts.' },
      { status: 500 },
    );
  }
}
