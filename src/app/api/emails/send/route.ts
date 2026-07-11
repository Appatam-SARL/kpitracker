import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { LeadEmailTemplate } from "@/emails/LeadEmail";
import { sanitizeEmailBodyHtml } from "@/lib/email-html-sanitize";
import {
  appendEmailSignatureIfMissing,
  hasEmailSignatureMarker,
  isEmailComposeBodyEmpty,
} from "@/lib/email-signature";
import { embedSignatureImageAsCid } from "@/lib/email-signature-server";
import { emailHtmlToPlainSummary } from "@/lib/email-html-shared";
import { logUserAction, USER_ACTION_CODES } from "@/lib/user-action-log";

const sendEmailSchema = z.object({
  leadId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  cc: z.array(z.string().email()).max(25).optional(),
  bcc: z.array(z.string().email()).max(25).optional(),
  recipientName: z.string().optional(),
  createFollowUpTask: z.boolean().optional(),
});

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_TYPES = new Set([
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
]);

function parseAddressField(input: FormDataEntryValue | null): string[] {
  if (typeof input !== "string" || input.trim() === "") return [];
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean);
    }
  } catch {
    // ignore malformed JSON and fallback to split
  }
  return input
    .split(/[;,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      "Configuration SMTP manquante (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)",
    );
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    auth: { user, pass },
  });
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("auth_session")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        companyId: true,
        emailSignature: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") ?? "";
    let body: z.infer<typeof sendEmailSchema>;
    let uploadedFiles: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      uploadedFiles = formData
        .getAll("attachments")
        .filter((v): v is File => v instanceof File && v.size > 0);

      body = sendEmailSchema.parse({
        leadId: String(formData.get("leadId") ?? ""),
        to: String(formData.get("to") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        bodyHtml: String(formData.get("bodyHtml") ?? ""),
        cc: parseAddressField(formData.get("cc")),
        bcc: parseAddressField(formData.get("bcc")),
        recipientName: String(formData.get("recipientName") ?? ""),
        createFollowUpTask:
          String(formData.get("createFollowUpTask") ?? "false") === "true",
      });
    } else {
      const json = await req.json();
      body = sendEmailSchema.parse(json);
      uploadedFiles = [];
    }

    if (isEmailComposeBodyEmpty(body.bodyHtml)) {
      return NextResponse.json(
        { error: "Le message ne peut pas être vide" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id: body.leadId },
      include: { company: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    const htmlWithSignature = appendEmailSignatureIfMissing(
      body.bodyHtml,
      user.emailSignature,
    );
    const sanitized = sanitizeEmailBodyHtml(htmlWithSignature);
    const { html: safeHtml, attachment: signatureAttachment } =
      await embedSignatureImageAsCid(sanitized, user.emailSignature);
    const cc = body.cc?.length ? body.cc : undefined;
    const bcc = body.bcc?.length ? body.bcc : undefined;
    if (uploadedFiles.length > MAX_ATTACHMENTS) {
      return NextResponse.json(
        { error: `Trop de pièces jointes (max ${MAX_ATTACHMENTS})` },
        { status: 400 },
      );
    }
    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Fichier trop volumineux: ${file.name} (max 10 Mo)` },
          { status: 400 },
        );
      }
      if (!ALLOWED_TYPES.has(file.type) && !file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `Type de fichier non autorisé: ${file.name}` },
          { status: 400 },
        );
      }
    }

    const html = await render(
      LeadEmailTemplate({
        subject: body.subject,
        bodyHtml: safeHtml,
        recipientName: body.recipientName || `${lead.firstName} ${lead.lastName}`,
        senderName: user.name,
        companyName: lead.company?.name,
        hideDefaultClosing:
          hasEmailSignatureMarker(safeHtml) || !!user.emailSignature,
      }),
    );

    const transporter = createTransport();
    const fileAttachments = await Promise.all(
      uploadedFiles.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || undefined,
      })),
    );
    const attachments = [
      ...fileAttachments,
      ...(signatureAttachment
        ? [
            {
              filename: signatureAttachment.filename,
              content: signatureAttachment.content,
              contentType: signatureAttachment.contentType,
              cid: signatureAttachment.cid,
            },
          ]
        : []),
    ];
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: body.to,
      cc,
      bcc,
      subject: body.subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    const plainSummary = emailHtmlToPlainSummary(safeHtml, 4000);

    const activity = await prisma.activity.create({
      data: {
        type: "EMAIL",
        relatedTo: "LEAD",
        leadId: body.leadId,
        userId: user.id,
        content: `Subject: ${body.subject}\n\n${plainSummary}`,
      },
      include: { user: { select: { name: true } } },
    });

    if (body.createFollowUpTask === true) {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      await prisma.agendaItem.create({
        data: {
          leadId: body.leadId,
          createdById: user.id,
          title: `Relancer : ${body.subject}`,
          description: `Email envoyé — voir activité ${activity.id}`,
          dueDate: due,
        },
      });
    }

    if (user.companyId) {
      await logUserAction({
        user: { id: user.id, companyId: user.companyId },
        action: USER_ACTION_CODES.EMAIL_SEND,
        entityType: 'Lead',
        entityId: body.leadId,
        summary: `Envoi d'un email au prospect (${body.subject})`,
        metadata: { label: body.subject, to: body.to },
      });
    }

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(" ; ") },
        { status: 400 },
      );
    }
    console.error("POST /api/emails/send error", error);
    return NextResponse.json(
      { error: "Impossible d'envoyer l'email" },
      { status: 500 },
    );
  }
}
