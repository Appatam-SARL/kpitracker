import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import { prismaCompanyScopeFilter } from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import { buildSalesSummaryReport } from '@/lib/sales-summary-report';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const reportDetailSelect = {
  id: true,
  agentId: true,
  title: true,
  periodFrom: true,
  periodTo: true,
  source: true,
  scopeLabel: true,
  payload: true,
  createdAt: true,
  archivedAt: true,
  agent: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { id } = await context.params;
  const companyIdParam = new URL(req.url).searchParams.get('companyId');
  const scope = await resolveGroupCompanyScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const report = await prisma.salesReport.findFirst({
    where: { id, ...companyFilter },
    select: reportDetailSelect,
  });
  if (!report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }

  let payload = report.payload;
  if (!report.archivedAt) {
    try {
      payload = await buildSalesSummaryReport({
        companyFilter,
        fromDate: report.periodFrom,
        toDate: report.periodTo,
        userId: report.agentId ?? undefined,
        source: report.source ?? undefined,
      });
    } catch (error) {
      console.error('Sales report detail rebuild failed, using snapshot', error);
    }
  }

  return NextResponse.json({ ...report, payload });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { id } = await context.params;
  let body: { archived?: boolean; companyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  if (typeof body.archived !== 'boolean') {
    return NextResponse.json(
      { error: 'Champ archived (boolean) obligatoire' },
      { status: 400 },
    );
  }
  if (body.archived !== true) {
    return NextResponse.json(
      { error: 'Un rapport archivé ne peut pas être retiré des archives.' },
      { status: 403 },
    );
  }

  const companyIdParam =
    body.companyId ?? new URL(req.url).searchParams.get('companyId');
  const scope = await resolveGroupCompanyScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const existing = await prisma.salesReport.findFirst({
    where: { id, ...companyFilter },
    select: { id: true, title: true, companyId: true, archivedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json(
      { error: 'Ce rapport est déjà archivé.' },
      { status: 400 },
    );
  }

  const updated = await prisma.salesReport.update({
    where: { id: existing.id },
    data: { archivedAt: new Date() },
    select: reportDetailSelect,
  });

  await logUserAction({
    user: { id: user.id, companyId: existing.companyId },
    action: USER_ACTION_CODES.REPORT_ARCHIVE,
    entityType: 'SalesReport',
    entityId: existing.id,
    summary: `Archivage du rapport « ${existing.title} »`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { id } = await context.params;
  const companyIdParam = new URL(req.url).searchParams.get('companyId');
  const scope = await resolveGroupCompanyScope(user, companyIdParam);
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const existing = await prisma.salesReport.findFirst({
    where: { id, ...companyFilter },
    select: { id: true, title: true, companyId: true, archivedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }
  if (existing.archivedAt) {
    return NextResponse.json(
      {
        error:
          'Un rapport archivé ne peut pas être supprimé.',
      },
      { status: 403 },
    );
  }

  await prisma.salesReport.delete({ where: { id: existing.id } });

  await logUserAction({
    user: { id: user.id, companyId: existing.companyId },
    action: USER_ACTION_CODES.REPORT_DELETE,
    entityType: 'SalesReport',
    entityId: existing.id,
    summary: `Suppression du rapport « ${existing.title} »`,
  });

  return NextResponse.json({ ok: true });
}
