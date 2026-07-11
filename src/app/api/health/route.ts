import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** GET /api/health — diagnostic rapide (DB, variables) pour cPanel. */
export async function GET() {
  const checks: Record<string, string> = {
    nodeEnv: process.env.NODE_ENV ?? 'non défini',
    databaseUrl: process.env.DATABASE_URL ? 'défini' : 'manquant',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '(racine)',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
    return NextResponse.json({ status: 'ok', checks });
  } catch (error) {
    checks.database = 'erreur';
    console.error('GET /api/health error', error);
    return NextResponse.json(
      {
        status: 'error',
        checks,
        hint: 'Vérifiez DATABASE_URL et que PostgreSQL est accessible depuis le serveur.',
      },
      { status: 503 },
    );
  }
}
