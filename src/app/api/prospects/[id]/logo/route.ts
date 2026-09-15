import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { activeOnlyWhere } from '@/lib/trash';
import { prisma } from '@/lib/prisma';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = 'public/uploads/prospects';
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

async function removeLocalLogo(logoUrl: string | null | undefined) {
  if (!logoUrl?.startsWith('/uploads/prospects/')) return;
  const absolute = path.join(process.cwd(), 'public', logoUrl.replace(/^\//, ''));
  try {
    await unlink(absolute);
  } catch {
    // fichier déjà absent
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId } = await params;
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, ...activeOnlyWhere },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('logo') as File | null;
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'Aucun logo fourni' },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Logo trop volumineux (max 2 Mo)' },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Format de logo non autorisé (JPG, PNG, GIF, WEBP, SVG)' },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name) || '.png';
    const fileName = `logo-${Date.now()}${ext.toLowerCase()}`;
    const dir = path.join(process.cwd(), UPLOAD_DIR, prospectId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const logoUrl = `/uploads/prospects/${prospectId}/${fileName}`;
    await removeLocalLogo(prospect.logoUrl);

    const updated = await prisma.prospect.update({
      where: { id: prospectId },
      data: { logoUrl },
      select: { id: true, logoUrl: true },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.LEAD_UPDATE,
      entityType: 'Prospect',
      entityId: prospectId,
      summary: `Logo mis à jour pour ${prospect.name}`,
      metadata: { logoUrl },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('POST /api/prospects/[id]/logo error', error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le logo" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id: prospectId } = await params;
    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, ...activeOnlyWhere },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    await removeLocalLogo(prospect.logoUrl);
    await prisma.prospect.update({
      where: { id: prospectId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ id: prospectId, logoUrl: null });
  } catch (error) {
    console.error('DELETE /api/prospects/[id]/logo error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer le logo' },
      { status: 500 },
    );
  }
}
