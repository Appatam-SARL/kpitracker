import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { sessionCookieOptions } from '@/lib/session-cookies';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schéma de validation pour les identifiants reçus depuis le frontend
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { email, password } = loginSchema.parse(json);

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { company: true },
    });

    const validPassword = user
      ? await verifyPassword(password, user.password)
      : false;

    if (!user || !validPassword) {
      return NextResponse.json(
        { error: 'Identifiants invalides' },
        { status: 401 },
      );
    }

    if (!user.company) {
      return NextResponse.json(
        { error: 'Compte sans entreprise associée. Contactez l\'administrateur.' },
        { status: 403 },
      );
    }

    const userWithMfa = user as typeof user & { mfaEnabled?: boolean };

    if (userWithMfa.mfaEnabled) {
      const res = NextResponse.json(
        {
          requiresMfa: true,
          mustChangePassword: user.mustChangePassword,
          message: 'Vérification MFA requise',
        },
        { status: 200 },
      );
      res.cookies.set('mfa_pending', user.id, sessionCookieOptions(60 * 5));
      res.cookies.set(
        'must_change_password',
        user.mustChangePassword ? '1' : '0',
        sessionCookieOptions(60 * 60 * 24 * 7),
      );
      return res;
    }

    const res = NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      company: { id: user.company.id, name: user.company.name },
    });

    res.cookies.set('auth_session', user.id, sessionCookieOptions(60 * 60 * 24 * 7));
    res.cookies.set('auth_role', user.role, sessionCookieOptions(60 * 60 * 24 * 7));
    res.cookies.set(
      'must_change_password',
      user.mustChangePassword ? '1' : '0',
      sessionCookieOptions(60 * 60 * 24 * 7),
    );

    await logUserAction({
      user: { id: user.id, companyId: user.companyId },
      action: USER_ACTION_CODES.AUTH_LOGIN,
      summary: 'Connexion au CRM',
    });

    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données de connexion invalides' },
        { status: 400 },
      );
    }

    console.error('POST /api/auth/login error', error);
    const message =
      error instanceof Error && error.message.includes('DATABASE_URL')
        ? 'Configuration serveur incomplète (base de données)'
        : 'Erreur interne du serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
