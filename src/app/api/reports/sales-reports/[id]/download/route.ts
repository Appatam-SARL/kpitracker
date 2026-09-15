import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import { prismaCompanyScopeFilter } from '@/lib/group-scope-roles';
import { prisma } from '@/lib/prisma';
import {
  buildSalesReportDocxBuffer,
  buildSalesReportExcelBuffer,
  buildSalesReportPdfBuffer,
  contentTypeForFormat,
  extensionForFormat,
  isDownloadFormat,
  type SalesReportMeta,
} from '@/lib/sales-report-files';
import {
  buildSalesSummaryReport,
  type SalesSummaryReport,
} from '@/lib/sales-summary-report';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function safeFilename(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const formatRaw = (searchParams.get('format') ?? 'pdf').toLowerCase();
  if (!isDownloadFormat(formatRaw)) {
    return NextResponse.json(
      { error: 'Format invalide (pdf, xlsx ou docx)' },
      { status: 400 },
    );
  }

  const scope = await resolveGroupCompanyScope(
    user,
    searchParams.get('companyId'),
  );
  if (scope instanceof NextResponse) return scope;
  const companyFilter = prismaCompanyScopeFilter(scope);

  const report = await prisma.salesReport.findFirst({
    where: { id, ...companyFilter },
    include: {
      agent: { select: { name: true } },
    },
  });
  if (!report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 });
  }

  let payload = report.payload as unknown as SalesSummaryReport;
  try {
    payload = await buildSalesSummaryReport({
      companyFilter,
      fromDate: report.periodFrom,
      toDate: report.periodTo,
      userId: report.agentId ?? undefined,
      source: report.source ?? undefined,
    });
  } catch (error) {
    console.error('Sales report live rebuild failed, using snapshot', error);
  }
  const meta: SalesReportMeta = {
    title: report.title,
    periodFrom: toIsoDate(report.periodFrom),
    periodTo: toIsoDate(report.periodTo),
    scopeLabel: report.scopeLabel,
    agentName: report.agent?.name ?? null,
    source: report.source,
    createdAt: report.createdAt.toISOString(),
  };

  let buffer: Buffer;
  try {
    if (formatRaw === 'pdf') {
      buffer = await buildSalesReportPdfBuffer(payload, meta);
    } else if (formatRaw === 'xlsx') {
      buffer = await buildSalesReportExcelBuffer(payload, meta);
    } else {
      buffer = await buildSalesReportDocxBuffer(payload, meta);
    }
  } catch (error) {
    console.error('Sales report download generation error', error);
    return NextResponse.json(
      { error: 'Impossible de générer le fichier' },
      { status: 500 },
    );
  }

  await logUserAction({
    user: { id: user.id, companyId: report.companyId },
    action: USER_ACTION_CODES.REPORT_DOWNLOAD,
    entityType: 'SalesReport',
    entityId: report.id,
    summary: `Téléchargement ${formatRaw.toUpperCase()} — « ${report.title} »`,
    metadata: { format: formatRaw },
  });

  const filename = `${safeFilename(report.title) || 'rapport-ventes'}.${extensionForFormat(formatRaw)}`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentTypeForFormat(formatRaw),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
