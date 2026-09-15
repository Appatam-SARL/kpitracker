import { getCurrentUser } from '@/lib/auth';
import { requireGroupProspectsAccess } from '@/lib/prospect-access';
import { softDeleteAttachment } from '@/lib/trash';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const access = await requireGroupProspectsAccess(user);
    if (access !== true) return access;

    const { id, attachmentId } = await params;
    const att = await prisma.prospectAttachment.findFirst({
      where: { id: attachmentId, prospectId: id, deletedAt: null },
      select: { id: true },
    });
    if (!att) {
      return NextResponse.json(
        { error: 'Pièce jointe introuvable' },
        { status: 404 },
      );
    }

    await softDeleteAttachment(user.id, attachmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE attachment error', error);
    return NextResponse.json(
      { error: 'Impossible de supprimer la pièce jointe' },
      { status: 500 },
    );
  }
}
