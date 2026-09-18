import { AuthProvider } from '@/contexts/AuthContext';
import { resolveMetadataBase } from '@/lib/app-url';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: 'KpiTracker',
    template: '%s | KpiTracker',
  },
  description:
    'KpiTracker : CRM commercial fullstack moderne pour suivre vos leads, objectifs et ventes.',
  keywords: ['KpiTracker', 'CRM', 'prospects', 'leads', 'ventes', 'Next.js', 'dashboard'],
  authors: [{ name: 'KpiTracker' }],
  creator: 'KpiTracker',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'KpiTracker',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='fr' className={plusJakarta.variable}>
      <body
        className={`${plusJakarta.className} min-h-screen bg-bgGray text-primary`}
      >
        {/* Visible dès le premier paint (ouverture via barre d’adresse), avant hydratation. */}
        <div
          id='crm-boot-splash'
          suppressHydrationWarning
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f4f4f4',
          }}
          aria-hidden='true'
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
                @keyframes crm-logo-bounce {
                  0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                  50% { transform: translateY(-18px); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
                #crm-boot-splash img {
                  animation: crm-logo-bounce 1.1s infinite;
                  will-change: transform;
                }
              `,
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src='/kpitracker-logo.png'
            alt=''
            width={520}
            height={220}
            style={{
              height: 'auto',
              width: 'min(92vw, 32rem)',
              maxWidth: '520px',
              objectFit: 'contain',
            }}
          />
        </div>
        <AuthProvider>
          <div className='md:pt-0'>{children}</div>
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
