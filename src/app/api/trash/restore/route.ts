import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import {
  isTrashEntityType,
  restoreTrashItem,
  TrashError,
} from '@/lib/trash';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const restoreBodySchema = z.object({
  entityType: z.string().min(1),
  id: z.string().min(1),
});

/** POST : restaurer un élément depuis la corbeille. */
export async function POST(req: Request) {
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
    const body = restoreBodySchema.parse(json);

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

    const restored = await restoreTrashItem(
      user,
      scope,
      body.entityType,
      body.id,
    );

    await logUserAction({
      user,
      action: USER_ACTION_CODES.TRASH_RESTORE,
      entityType: body.entityType,
      entityId: body.id,
      summary: `Restauration : ${restored.label}`,
      metadata: { label: restored.label, entityType: body.entityType },
    });

    return NextResponse.json({ ok: true, item: restored });
  } catch (error) {
    if (error instanceof TrashError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    console.error('POST /api/trash/restore error', error);
    return NextResponse.json(
      { error: 'Impossible de restaurer l\'élément' },
      { status: 500 },
    );
  }
}
