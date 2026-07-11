import { requireRole, resolveGroupCompanyScope } from '@/lib/auth';
import { buildLeadDemographicsReport } from '@/lib/lead-demographics-report';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export type { LeadDemographicsResponse } from '@/lib/lead-demographics-report';

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

  const userIdParam = searchParams.get('userId')?.trim() ?? '';

  try {
    const payload = await buildLeadDemographicsReport(
      scope,
      userIdParam || undefined,
    );
    return NextResponse.json(payload);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Commercial introuvable ou autre entreprise'
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('GET /api/dashboard/lead-demographics error', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
