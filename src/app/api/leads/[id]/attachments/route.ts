import { getCurrentUser } from "@/lib/auth";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";
import { activeOnlyWhere } from "@/lib/trash";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = "public/uploads/leads";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...activeOnlyWhere },
    });
    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable" },
        { status: 404 }
      );
    }

    const attachments = await prisma.leadAttachment.findMany({
      where: { leadId, ...activeOnlyWhere },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("GET /api/leads/[id]/attachments error", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les pièces jointes" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, ...activeOnlyWhere },
    });
    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable" },
        { status: 404 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10 Mo)" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name) || ".bin";
    const safeName = `${Date.now()}-${Buffer.from(file.name, "latin1").toString("utf8").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dir = path.join(process.cwd(), UPLOAD_DIR, leadId);

    await mkdir(dir, { recursive: true });

    const fileName = safeName.endsWith(ext) ? safeName : `${safeName}${ext}`;
    const filePath = path.join(dir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const storagePath = `/uploads/leads/${leadId}/${fileName}`;
    const fileType = (ext.slice(1) || "file").toUpperCase();

    const attachment = await prisma.leadAttachment.create({
      data: {
        leadId,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        storagePath,
      },
    });

    const authUser = await getCurrentUser();
    if (authUser) {
      await logUserAction({
        user: authUser,
        action: USER_ACTION_CODES.LEAD_ATTACHMENT_CREATE,
        entityType: 'LeadAttachment',
        entityId: attachment.id,
        summary: `Ajout pièce jointe : ${attachment.fileName}`,
        metadata: { label: attachment.fileName, leadId },
      });
    }

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads/[id]/attachments error", error);
    return NextResponse.json(
      { error: "Impossible d'ajouter la pièce jointe" },
      { status: 500 }
    );
  }
}
