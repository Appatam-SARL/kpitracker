import { getCurrentUser } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import {
  EMAIL_SIGNATURE_IMAGE,
  EMAIL_SIGNATURE_DESIGNER_BRIEF,
} from '@/config/email-signature';
import {
  buildSignatureHtmlFromStored,
  validateSignatureImageDimensions,
} from '@/lib/email-signature';
import { prisma } from '@/lib/prisma';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

const UPLOAD_ROOT = 'public/uploads/signatures';

function signatureDir(userId: string) {
  return path.join(process.cwd(), UPLOAD_ROOT, userId);
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  return '.bin';
}

async function removeExistingSignatureFiles(userId: string) {
  const dir = signatureDir(userId);
  const base = path.join(dir, 'signature');
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
    try {
      await unlink(`${base}${ext}`);
    } catch {
      // fichier absent
    }
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailSignature: true },
  });

  const stored = row?.emailSignature?.trim() ?? '';
  const imageUrl =
    stored && !stored.startsWith('<') && stored.startsWith('/')
      ? stored
      : null;

  return NextResponse.json({
    imageUrl,
    signatureHtml: buildSignatureHtmlFromStored(stored, { absolute: false }),
    spec: {
      width: EMAIL_SIGNATURE_IMAGE.width,
      height: EMAIL_SIGNATURE_IMAGE.height,
      maxFileSizeBytes: EMAIL_SIGNATURE_IMAGE.maxFileSizeBytes,
      allowedMimeTypes: EMAIL_SIGNATURE_IMAGE.allowedMimeTypes,
      designerBrief: EMAIL_SIGNATURE_DESIGNER_BRIEF,
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'Aucun fichier image fourni' },
        { status: 400 },
      );
    }

    const mime = file.type;
    if (
      !EMAIL_SIGNATURE_IMAGE.allowedMimeTypes.includes(
        mime as (typeof EMAIL_SIGNATURE_IMAGE.allowedMimeTypes)[number],
      )
    ) {
      return NextResponse.json(
        {
          error: 'Format non autorisé. Utilisez un fichier PNG ou JPEG.',
        },
        { status: 400 },
      );
    }

    if (file.size > EMAIL_SIGNATURE_IMAGE.maxFileSizeBytes) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux (max ${Math.round(EMAIL_SIGNATURE_IMAGE.maxFileSizeBytes / 1024)} Ko).`,
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dimCheck = validateSignatureImageDimensions(buffer, mime);
    if (!dimCheck.ok) {
      return NextResponse.json({ error: dimCheck.message }, { status: 400 });
    }

    const ext = extFromMime(mime);
    const dir = signatureDir(user.id);
    await mkdir(dir, { recursive: true });
    await removeExistingSignatureFiles(user.id);

    const fileName = `signature${ext}`;
    const diskPath = path.join(dir, fileName);
    await writeFile(diskPath, buffer);

    const publicPath = `/uploads/signatures/${user.id}/${fileName}`;

    await prisma.user.update({
      where: { id: user.id },
      data: { emailSignature: publicPath },
    });

    await logUserAction({
      user,
      action: USER_ACTION_CODES.PROFILE_SIGNATURE_UPDATE,
      entityType: 'User',
      entityId: user.id,
      summary: 'Mise à jour de la signature email',
    });

    return NextResponse.json({
      imageUrl: publicPath,
      signatureHtml: buildSignatureHtmlFromStored(publicPath, {
        absolute: false,
      }),
    });
  } catch (error) {
    console.error('POST /api/profile/email-signature error', error);
    return NextResponse.json(
      { error: 'Impossible d’enregistrer la signature' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  try {
    await removeExistingSignatureFiles(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { emailSignature: null },
    });
    await logUserAction({
      user,
      action: USER_ACTION_CODES.PROFILE_SIGNATURE_UPDATE,
      entityType: 'User',
      entityId: user.id,
      summary: 'Suppression de la signature email',
    });
    return NextResponse.json({ imageUrl: null, signatureHtml: '' });
  } catch (error) {
    console.error('DELETE /api/profile/email-signature error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer la signature' },
      { status: 500 },
    );
  }
}
