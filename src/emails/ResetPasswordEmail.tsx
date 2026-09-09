import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ResetPasswordEmailProps {
  recipientName: string;
  companyName?: string;
  resetUrl: string;
}

export function ResetPasswordEmailTemplate({
  recipientName,
  companyName = 'KpiTracker',
  resetUrl,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Réinitialisation de votre mot de passe</Preview>
      <Body
        style={{ backgroundColor: '#f3f4f6', margin: 0, padding: '24px 0' }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: 24,
            padding: 24,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            color: '#111827',
          }}
        >
          <Heading as='h2' style={{ fontSize: 20, marginBottom: 12 }}>
            Réinitialisation du mot de passe
          </Heading>
          <Text style={{ fontSize: 14, marginBottom: 12 }}>
            Bonjour {recipientName},
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 1.6 }}>
            Une demande de réinitialisation de mot de passe a été faite pour
            votre compte {companyName}. Cliquez sur le bouton ci-dessous pour
            choisir un nouveau mot de passe. Ce lien expire dans 1 heure.
          </Text>

          <Section style={{ marginTop: 20, marginBottom: 8, textAlign: 'center' }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: '#0284c7',
                borderRadius: 12,
                color: '#ffffff',
                display: 'inline-block',
                fontSize: 14,
                fontWeight: 600,
                padding: '12px 20px',
                textDecoration: 'none',
              }}
            >
              Choisir un nouveau mot de passe
            </Button>
          </Section>

          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 20, lineHeight: 1.5 }}>
            Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez
            cet e-mail : votre mot de passe actuel reste inchangé.
          </Text>
          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, lineHeight: 1.5 }}>
            Lien de secours : {resetUrl}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
