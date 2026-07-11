import {
  canManageCatalogForTargetCompany,
  getCurrentUser,
  requireRole,
  resolveGroupCompanyScope,
} from '@/lib/auth';
import {
  hasGroupCompanyScope,
  isGroupHoldingScopeValue,
  prismaCompanyScopeFilter,
} from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  companyId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.companyId) {
      return NextResponse.json(
        { error: 'Non authentifié ou société introuvable' },
        { status: 401 },
      );
    }

    const companyIdParam = new URL(req.url).searchParams.get('companyId');
    let companyScope: { companyId: string | { in: string[] } } = {
      companyId: user.companyId,
    };
    if (hasGroupCompanyScope(user.role)) {
      const scope = await resolveGroupCompanyScope(user, companyIdParam);
      if (scope instanceof NextResponse) return scope;
      companyScope = prismaCompanyScopeFilter(scope);
    }

    const products = await prisma.product.findMany({
      where: companyScope,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('GET /api/products error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les produits' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  if (!user.companyId) {
    return NextResponse.json(
      { error: 'Non authentifié ou société introuvable' },
      { status: 401 },
    );
  }

  try {
    const json = await req.json();
    const body = createProductSchema.parse(json);

    if (isGroupHoldingScopeValue(body.companyId)) {
      return NextResponse.json(
        {
          error:
            "Sélectionnez une filiale précise pour enregistrer un produit (pas Holding).",
        },
        { status: 400 },
      );
    }

    const targetCompanyId = body.companyId?.trim() || user.companyId;
    const mutationAllowed = await canManageCatalogForTargetCompany(
      user,
      targetCompanyId,
    );
    if (mutationAllowed !== true) return mutationAllowed;

    const product = await prisma.product.create({
      data: {
        name: body.name.trim(),
        companyId: targetCompanyId,
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.PRODUCT_CREATE,
      entityType: 'Product',
      entityId: product.id,
      summary: `Création du produit « ${product.name} »`,
      metadata: { label: product.name },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(', ') },
        { status: 400 },
      );
    }
    console.error('POST /api/products error', error);
    return NextResponse.json(
      { error: 'Impossible de créer le produit' },
      { status: 500 },
    );
  }
}
