import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { activeOnlyWhere, softDeleteAttachment } from "@/lib/trash";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: leadId, attachmentId } = await params;

    const attachment = await prisma.leadAttachment.findFirst({
      where: { id: attachmentId, leadId, ...activeOnlyWhere },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Pièce jointe introuvable" },
        { status: 404 }
      );
    }

    const authUser = await getCurrentUser();
    if (!authUser) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    await softDeleteAttachment(authUser.id, attachmentId);

    await logUserAction({
      user: authUser,
      action: USER_ACTION_CODES.LEAD_ATTACHMENT_DELETE,
      entityType: 'LeadAttachment',
      entityId: attachmentId,
      summary: `Mise en corbeille pièce jointe : ${attachment.fileName}`,
      metadata: { label: attachment.fileName, leadId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/leads/[id]/attachments/[attachmentId] error", error);
    return NextResponse.json(
      { error: "Impossible de mettre la pièce jointe à la corbeille" },
      { status: 500 }
    );
  }
}
