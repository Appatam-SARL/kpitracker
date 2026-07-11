import { getCurrentUser, requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import { hasGroupCompanyScope } from '@/lib/group-scope-roles';
import {
  isTrashEntityType,
  listTrashItems,
  purgeTrashItem,
  TrashError,
} from '@/lib/trash';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const purgeBodySchema = z.object({
  entityType: z.string().min(1),
  id: z.string().min(1),
});

/** GET : liste paginée des éléments en corbeille — managers/admins/rôles groupe. */
export async function GET(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  if (!user.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }

  try {
    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('companyId');
    const entityTypeParam = url.searchParams.get('entityType');
    const q = url.searchParams.get('q') ?? undefined;
    const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
    const pageSize = Number.parseInt(
      url.searchParams.get('pageSize') ?? '20',
      10,
    );

    const scope = await resolveGroupCompanyScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;

    const entityType =
      entityTypeParam && isTrashEntityType(entityTypeParam)
        ? entityTypeParam
        : undefined;

    const result = await listTrashItems(
      scope,
      {
        entityType,
        q,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      },
      hasGroupCompanyScope(user.role),
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/trash error', error);
    return NextResponse.json(
      { error: 'Impossible de charger la corbeille' },
      { status: 500 },
    );
  }
}

/** DELETE : suppression définitive d'un élément en corbeille. */
export async function DELETE(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
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
    const body = purgeBodySchema.parse(json);

    if (!isTrashEntityType(body.entityType)) {
      return NextResponse.json(
        { error: 'Type d\'entité invalide' },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const companyIdParam = url.searchParams.get('companyId');
    const scope = await resolveGroupCompanyScope(user, companyIdParam);
    if (scope instanceof NextResponse) return scope;

    await purgeTrashItem(user, scope, body.entityType, body.id);

    await logUserAction({
      user,
      action: USER_ACTION_CODES.TRASH_PURGE,
      entityType: body.entityType,
      entityId: body.id,
      summary: `Suppression définitive (${body.entityType})`,
      metadata: { entityType: body.entityType },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TrashError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    console.error('DELETE /api/trash error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer définitivement' },
      { status: 500 },
    );
  }
}
