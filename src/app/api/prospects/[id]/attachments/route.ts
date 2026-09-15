import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { activeOnlyWhere } from '@/lib/trash';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = 'public/uploads/prospects';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

export async function GET(
  req: NextRequest,
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
    const contactId = req.nextUrl.searchParams.get('contactId');

    const prospect = await prisma.prospect.findFirst({
      where: { id: prospectId, ...activeOnlyWhere },
      select: { id: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const attachments = await prisma.prospectAttachment.findMany({
      where: {
        prospectId,
        deletedAt: null,
        ...(contactId ? { contactId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(attachments);
  } catch (error) {
    console.error('GET attachments error', error);
    return NextResponse.json(
      { error: 'Impossible de récupérer les pièces jointes' },
      { status: 500 },
    );
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
      select: { id: true, name: true },
    });
    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect introuvable' },
        { status: 404 },
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const labelRaw = formData.get('label');
    const contactIdRaw = formData.get('contactId');
    const label =
      typeof labelRaw === 'string' && labelRaw.trim()
        ? labelRaw.trim()
        : null;
    const contactId =
      typeof contactIdRaw === 'string' && contactIdRaw.trim()
        ? contactIdRaw.trim()
        : null;

    if (contactId) {
      const contact = await prisma.prospectContact.findFirst({
        where: {
          id: contactId,
          prospectId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!contact) {
        return NextResponse.json(
          { error: 'Contact introuvable pour ce prospect' },
          { status: 400 },
        );
      }
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux (max 10 Mo)' },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Type de fichier non autorisé' },
        { status: 400 },
      );
    }

    const ext = path.extname(file.name) || '.bin';
    const safeName = `${Date.now()}-${Buffer.from(file.name, 'latin1')
      .toString('utf8')
      .replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const dir = path.join(process.cwd(), UPLOAD_DIR, prospectId);
    await mkdir(dir, { recursive: true });

    const fileName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;
    const filePath = path.join(dir, fileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const storagePath = `/uploads/prospects/${prospectId}/${fileName}`;
    const fileType = (ext.slice(1) || 'file').toUpperCase();

    const attachment = await prisma.prospectAttachment.create({
      data: {
        prospectId,
        contactId,
        label,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        storagePath,
      },
    });

    if (user.companyId) {
      await logUserAction({
        user: { id: user.id, companyId: user.companyId },
        action: USER_ACTION_CODES.LEAD_ATTACHMENT_CREATE,
        entityType: 'ProspectAttachment',
        entityId: attachment.id,
        summary: label
          ? `Document « ${label} » ajouté sur ${prospect.name}`
          : `Pièce jointe ajoutée sur ${prospect.name}`,
        metadata: {
          fileName: file.name,
          prospectId,
          contactId,
          label,
        },
      });
    }

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('POST attachments error', error);
    return NextResponse.json(
      { error: "Impossible d'ajouter la pièce jointe" },
      { status: 500 },
    );
  }
}
