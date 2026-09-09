import type { Role } from '@/lib/auth';
import { canSoftDeleteUserAccount, requireRole } from '@/lib/auth';
import {
  hasGroupCompanyScope,
  isGroupHoldingScopeValue,
} from '@/lib/group-scope-roles';
import { hashPassword } from '@/lib/password';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { softDeleteUser, activeOnlyWhere } from '@/lib/trash';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/welcome-email';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z
    .enum([
      'ADMIN',
      'MANAGER',
      'DIRECTRICE_COMMERCIALE',
      'PDG',
      'DIRECTRICE_OPERATION',
      'AGENT',
    ])
    .default('AGENT'),
  // optionnel côté API : on créera / utilisera une company par défaut si absent
  companyId: z.string().optional(),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z
    .enum([
      'ADMIN',
      'MANAGER',
      'DIRECTRICE_COMMERCIALE',
      'PDG',
      'DIRECTRICE_OPERATION',
      'AGENT',
    ])
    .optional(),
});

const userRoleFilterSchema = z.enum([
  'ADMIN',
  'MANAGER',
  'DIRECTRICE_COMMERCIALE',
  'PDG',
  'DIRECTRICE_OPERATION',
  'AGENT',
]);

/** GET : liste des utilisateurs — ADMIN/MANAGER/DIRECTRICE (AGENT n'a pas accès).
 *  DIRECTRICE uniquement : ?companyId= pour cibler une entreprise existante (lecture).
 *  ?role=AGENT (etc.) pour filtrer par rôle (ex. liste des commerciaux).
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth as {
    user: {
      id: string;
      role: Role;
      companyId: string | null;
    };
  };
  if (!currentUser.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }
  try {
    const companyIdParam = req.nextUrl.searchParams.get('companyId');
    let filterCompanyId: string | { in: string[] } = currentUser.companyId;

    if (companyIdParam) {
      if (!hasGroupCompanyScope(currentUser.role)) {
        return NextResponse.json(
          { error: 'Filtre entreprise non autorisé' },
          { status: 403 },
        );
      }
      if (isGroupHoldingScopeValue(companyIdParam)) {
        const groupCompanies = await prisma.company.findMany({
          where: { kind: 'GROUP' },
          select: { id: true },
        });
        filterCompanyId = {
          in: groupCompanies.map((company) => company.id),
        };
      } else {
        const target = await prisma.company.findUnique({
          where: { id: companyIdParam },
          select: { id: true },
        });
        if (!target) {
          return NextResponse.json(
            { error: 'Entreprise introuvable' },
            { status: 400 },
          );
        }
        filterCompanyId = target.id;
      }
    }

    const roleParam = req.nextUrl.searchParams.get('role');
    let roleFilter: Role | undefined;
    if (roleParam) {
      const parsed = userRoleFilterSchema.safeParse(roleParam);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Rôle de filtre invalide' },
          { status: 400 },
        );
      }
      roleFilter = parsed.data;
    }

    const users = await prisma.user.findMany({
      where: {
        companyId: filterCompanyId,
        ...activeOnlyWhere,
        ...(roleFilter ? { role: roleFilter } : {}),
      },
      include: { company: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('GET /api/users error', error);
    return NextResponse.json(
      { error: 'Unable to fetch users' },
      { status: 500 },
    );
  }
}

/** PATCH : modification d'un utilisateur (rôles, etc.) — ADMIN ou MANAGER. */
export async function PATCH(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth as {
    user: {
      id: string;
      role: 'ADMIN' | 'MANAGER' | 'AGENT';
      companyId: string | null;
    };
  };
  if (!currentUser.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }
  try {
    const json = await req.json();
    const body = updateUserSchema.parse(json);

    const target = await prisma.user.findUnique({
      where: { id: body.id },
      select: { id: true, companyId: true },
    });
    if (!target || target.companyId !== currentUser.companyId) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé ou autre entreprise' },
        { status: 403 },
      );
    }

    const user = await prisma.user.update({
      where: { id: body.id },
      data: {
        name: body.name,
        email: body.email,
        role: body.role,
      },
    });

    await logUserAction({
      user: currentUser,
      action: USER_ACTION_CODES.USER_UPDATE,
      entityType: 'User',
      entityId: user.id,
      summary: `Modification de l'utilisateur ${user.name}`,
      metadata: { label: user.name, role: user.role },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('PATCH /api/users error', error);
    return NextResponse.json(
      { error: 'Unable to update user' },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}

/** DELETE : mise en corbeille d'un utilisateur — ADMIN, MANAGER ou rôles groupe. */
export async function DELETE(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth;
  if (!currentUser.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        name: true,
        role: true,
        deletedAt: true,
      },
    });
    if (!target || target.deletedAt) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé ou autre entreprise' },
        { status: 403 },
      );
    }

    const allowed = await canSoftDeleteUserAccount(currentUser, {
      id: target.id,
      companyId: target.companyId,
      role: target.role as Role,
    });
    if (allowed !== true) return allowed;

    await softDeleteUser(currentUser.id, id);

    await logUserAction({
      user: currentUser,
      action: USER_ACTION_CODES.USER_DELETE,
      entityType: 'User',
      entityId: id,
      summary: `Mise en corbeille de l'utilisateur ${target.name}`,
      metadata: { label: target.name },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/users error', error);
    return NextResponse.json(
      { error: 'Unable to delete user' },
      { status: 500 },
    );
  }
}

/** POST : création d'un utilisateur — ADMIN ou MANAGER. */
export async function POST(req: Request) {
  const auth = await requireRole(['ADMIN', 'MANAGER']);
  if (auth instanceof Response) return auth;
  const { user: currentUser } = auth as {
    user: {
      id: string;
      role: 'ADMIN' | 'MANAGER' | 'AGENT';
      companyId: string | null;
    };
  };
  if (!currentUser.companyId) {
    return NextResponse.json(
      { error: 'Utilisateur sans entreprise' },
      { status: 403 },
    );
  }
  try {
    const json = await req.json();
    const body = createUserSchema.parse(json);

    const companyId = currentUser.companyId;
    if (body.companyId && body.companyId !== currentUser.companyId) {
      return NextResponse.json(
        {
          error: 'Impossible de créer un utilisateur dans une autre entreprise',
        },
        { status: 403 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    if (existing) {
      const message = existing.deletedAt
        ? 'Un compte avec cet email existe déjà (utilisateur en corbeille). Restaurez-le ou utilisez un autre email.'
        : 'Un compte existe déjà avec cet email.';
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const hashedPassword = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        password: hashedPassword,
        mustChangePassword: true,
        role: body.role,
        companyId,
      },
    });

    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      await sendWelcomeEmail({
        recipientName: user.name,
        recipientEmail: user.email,
        temporaryPassword: body.password,
        companyName: company?.name,
      });
    } catch (emailError) {
      console.error('Welcome email error', emailError);
    }

    await logUserAction({
      user: currentUser,
      action: USER_ACTION_CODES.USER_CREATE,
      entityType: 'User',
      entityId: user.id,
      summary: `Création de l'utilisateur ${user.name}`,
      metadata: { label: user.name, role: user.role },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email.' },
        { status: 409 },
      );
    }
    console.error('POST /api/users error', error);
    return NextResponse.json(
      { error: 'Impossible de créer l\'utilisateur.' },
      { status: 500 },
    );
  }
}
