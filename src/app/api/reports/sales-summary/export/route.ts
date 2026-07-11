import { requireRole } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { parseSalesSummaryDateRange } from '@/lib/sales-summary-report';
import { buildStatsExportPayload } from '@/lib/stats-export-data';
import { buildStatsDashboardExcelBuffer } from '@/lib/stats-excel-export';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const userId = searchParams.get('userId') || undefined;
  const source = searchParams.get('source') || undefined;
  const companyId = searchParams.get('companyId');

  const range = parseSalesSummaryDateRange(from, to);
  if (!range || !from || !to) {
    return NextResponse.json(
      {
        error:
          'Paramètres from et to obligatoires (format YYYY-MM-DD), avec from <= to',
      },
      { status: 400 },
    );
  }

  const payload = await buildStatsExportPayload(user, {
    from,
    to,
    userId,
    source,
    companyId,
  });
  if (payload instanceof NextResponse) return payload;

  const buffer = await buildStatsDashboardExcelBuffer(payload);
  const filename = `tableau-bord-stats-${from}_${to}.xlsx`;

  await logUserAction({
    user,
    action: USER_ACTION_CODES.REPORT_EXPORT,
    summary: `Export tableau de bord statistiques (${from} — ${to})`,
    metadata: { from, to },
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
