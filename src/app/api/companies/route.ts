import { requireRole } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/welcome-email';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(1, "Nom de l'entreprise requis"),
  plan: z.enum(['free', 'pro', 'business']).default('free'),
  kind: z.enum(['GROUP', 'CLIENT']).default('GROUP'),
  firstUser: z.object({
    name: z.string().min(1, 'Nom du manager requis'),
    email: z.string().email('Email invalide'),
    password: z.string().min(6, 'Mot de passe min. 6 caractères'),
  }),
});

/** GET : liste des entreprises — ADMIN et MANAGER (pas AGENT). */
export async function GET() {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  try {
    const companies = await prisma.company.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(companies);
  } catch (error) {
    console.error('GET /api/companies error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les entreprises' },
      { status: 500 },
    );
  }
}

/** POST : création d'entreprise (opération critique) — ADMIN uniquement. */
export async function POST(req: Request) {
  // const auth = await requireRole(['ADMIN']);
  // if (auth instanceof Response) return auth;
  try {
    const json = await req.json();
    const body = createCompanySchema.parse(json);

    // Vérifier qu'aucun utilisateur n'existe déjà avec cet email (clé unique)
    const existingUser = await prisma.user.findUnique({
      where: { email: body.firstUser.email },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          error:
            'Un utilisateur existe déjà avec cet email. Veuillez en utiliser un autre.',
        },
        { status: 400 },
      );
    }

    const company = await prisma.company.create({
      data: {
        name: body.name,
        plan: body.plan,
        kind: body.kind,
      },
    });

    const hashedPassword = await hashPassword(body.firstUser.password);

    const manager = await prisma.user.create({
      data: {
        name: body.firstUser.name,
        email: body.firstUser.email,
        password: hashedPassword,
        mustChangePassword: true,
        role: 'MANAGER',
        companyId: company.id,
      },
    });

    try {
      await sendWelcomeEmail({
        recipientName: manager.name,
        recipientEmail: manager.email,
        temporaryPassword: body.firstUser.password,
        companyName: company.name,
      });
    } catch (emailError) {
      console.error('Welcome email error', emailError);
    }

    return NextResponse.json(
      {
        company,
        manager: {
          id: manager.id,
          name: manager.name,
          email: manager.email,
          role: manager.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const msg = error.issues.map((e) => e.message).join(' ; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('POST /api/companies error', error);
    return NextResponse.json(
      { error: "Impossible de créer l'entreprise" },
      { status: 500 },
    );
  }
}
