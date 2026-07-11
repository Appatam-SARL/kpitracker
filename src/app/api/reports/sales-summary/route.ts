import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import { prismaCompanyScopeFilter } from '@/lib/group-scope-roles';
import {
  buildSalesSummaryReport,
  parseSalesSummaryDateRange,
} from '@/lib/sales-summary-report';
import { NextRequest, NextResponse } from 'next/server';

export type { SalesSummaryReport } from '@/lib/sales-summary-report';

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

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const userId = searchParams.get('userId') || undefined;
  const source = searchParams.get('source') || undefined;

  const range = parseSalesSummaryDateRange(from, to);
  if (!range) {
    return NextResponse.json(
      {
        error:
          'Paramètres from et to obligatoires (format YYYY-MM-DD), avec from <= to',
      },
      { status: 400 },
    );
  }

  const report = await buildSalesSummaryReport({
    companyFilter,
    fromDate: range.fromDate,
    toDate: range.toDate,
    userId,
    source,
  });

  return NextResponse.json(report);
}
