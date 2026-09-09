import { ResetPasswordEmailTemplate } from '@/emails/ResetPasswordEmail';
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      'Configuration SMTP manquante (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)',
    );
  }

  return nodemailer.createTransport({
    host,
    port: Number(port),
    auth: { user, pass },
  });
}

interface SendResetPasswordEmailInput {
  recipientName: string;
  recipientEmail: string;
  resetUrl: string;
  companyName?: string;
}

export async function sendResetPasswordEmail(
  input: SendResetPasswordEmailInput,
): Promise<void> {
  const transporter = createTransport();
  const html = await render(
    ResetPasswordEmailTemplate({
      recipientName: input.recipientName,
      companyName: input.companyName,
      resetUrl: input.resetUrl,
    }),
  );

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.recipientEmail,
    subject: 'Réinitialisation de votre mot de passe',
    html,
  });
}
