import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import {
  GROUP_HOLDING_SCOPE_VALUE,
  prismaCompanyScopeFilter,
  userCompanyInScope,
} from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import {
  buildSalesSummaryReport,
  parseSalesSummaryDateRange,
  type SalesSummaryReport,
} from '@/lib/sales-summary-report';
import { activeOnlyWhere } from '@/lib/trash';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function resolveScopeLabel(
  scope: Awaited<ReturnType<typeof resolveGroupCompanyScope>>,
): Promise<string> {
  if (scope instanceof NextResponse) return '';
  if (scope.mode === 'holding') {
    return 'Holding (toutes les entreprises du groupe)';
  }
  const company = await prisma.company.findUnique({
    where: { id: scope.companyId },
    select: { name: true },
  });
  return company?.name ?? 'Entreprise';
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const scope = await resolveGroupCompanyScope(
    user,
    searchParams.get('companyId'),
  );
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const archivedParam = searchParams.get('archived');
  const showArchived = archivedParam === '1' || archivedParam === 'true';

  const reports = await prisma.salesReport.findMany({
    where: {
      ...companyFilter,
      archivedAt: showArchived ? { not: null } : null,
    },
    orderBy: showArchived
      ? [{ archivedAt: 'desc' }, { createdAt: 'desc' }]
      : { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      periodFrom: true,
      periodTo: true,
      source: true,
      scopeLabel: true,
      createdAt: true,
      archivedAt: true,
      agent: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  let body: {
    from?: string;
    to?: string;
    userId?: string;
    source?: string;
    companyId?: string;
    title?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const scope = await resolveGroupCompanyScope(
    user,
    body.companyId ?? null,
  );
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const range = parseSalesSummaryDateRange(body.from ?? null, body.to ?? null);
  if (!range) {
    return NextResponse.json(
      {
        error:
          'Paramètres from et to obligatoires (format YYYY-MM-DD), avec from <= to',
      },
      { status: 400 },
    );
  }

  const agentId = body.userId?.trim() || undefined;
  if (agentId) {
    const agent = await prisma.user.findFirst({
      where: {
        id: agentId,
        role: 'AGENT',
        ...activeOnlyWhere,
      },
      select: { id: true, name: true, companyId: true },
    });
    if (!agent || !userCompanyInScope(agent.companyId, scope)) {
      return NextResponse.json(
        { error: 'Commercial introuvable ou hors périmètre' },
        { status: 403 },
      );
    }
  }

  const payload: SalesSummaryReport = await buildSalesSummaryReport({
    companyFilter,
    fromDate: range.fromDate,
    toDate: range.toDate,
    userId: agentId,
    source: body.source?.trim() || undefined,
  });

  const scopeLabel = await resolveScopeLabel(scope);
  const agentName = agentId
    ? (
        await prisma.user.findUnique({
          where: { id: agentId },
          select: { name: true },
        })
      )?.name
    : null;

  const fromLabel = (body.from ?? '').trim();
  const toLabel = (body.to ?? '').trim();
  const defaultTitle = agentName
    ? `Synthèse ventes — ${agentName} (${fromLabel} → ${toLabel})`
    : `Synthèse ventes — équipe (${fromLabel} → ${toLabel})`;

  const storageCompanyId =
    scope.mode === 'holding'
      ? user.companyId!
      : scope.companyId;

  const report = await prisma.salesReport.create({
    data: {
      title: body.title?.trim() || defaultTitle,
      periodFrom: range.fromDate,
      periodTo: range.toDate,
      source: body.source?.trim() || null,
      scopeLabel:
        scope.mode === 'holding'
          ? scopeLabel
          : scopeLabel,
      payload,
      agentId: agentId ?? null,
      companyId: storageCompanyId,
      createdById: user.id,
    },
    select: {
      id: true,
      title: true,
      periodFrom: true,
      periodTo: true,
      source: true,
      scopeLabel: true,
      createdAt: true,
      agent: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
    },
  });

  await logUserAction({
    user: { id: user.id, companyId: storageCompanyId },
    action: USER_ACTION_CODES.REPORT_CREATE,
    entityType: 'SalesReport',
    entityId: report.id,
    summary: `Génération du rapport « ${report.title} »`,
    metadata: {
      agentId: agentId ?? null,
      from: fromLabel,
      to: toLabel,
      companyIdParam: body.companyId ?? null,
      holding: body.companyId === GROUP_HOLDING_SCOPE_VALUE,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
