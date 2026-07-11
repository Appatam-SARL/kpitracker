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

const createServiceSchema = z.object({
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

    const services = await prisma.service.findMany({
      where: companyScope,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(services);
  } catch (error) {
    console.error('GET /api/services error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les services' },
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
    const body = createServiceSchema.parse(json);

    if (isGroupHoldingScopeValue(body.companyId)) {
      return NextResponse.json(
        {
          error:
            "Sélectionnez une filiale précise pour enregistrer un service (pas Holding).",
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

    const service = await prisma.service.create({
      data: {
        name: body.name.trim(),
        companyId: targetCompanyId,
      },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.SERVICE_CREATE,
      entityType: 'Service',
      entityId: service.id,
      summary: `Création du service « ${service.name} »`,
      metadata: { label: service.name },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(', ') },
        { status: 400 },
      );
    }
    console.error('POST /api/services error', error);
    return NextResponse.json(
      { error: 'Impossible de créer le service' },
      { status: 500 },
    );
  }
}
