import Image from 'next/image';
import Link from 'next/link';

const YEAR = new Date().getFullYear();

const LEGAL_LINKS = [
  { href: '/legal/confidentialite', label: 'Politique de confidentialité' },
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/cgu', label: "Conditions d'utilisation" },
  { href: '/guide', label: 'Guide' },
] as const;

type AppFooterProps = {
  /** Variante compacte pour le shell dashboard. */
  compact?: boolean;
  className?: string;
};

export default function AppFooter({
  compact = false,
  className = '',
}: AppFooterProps) {
  return (
    <footer
      className={`border border-primary/10 bg-[#f5f5ff] shadow-neu-soft ${
        compact ? 'mt-auto rounded-2xl px-4 py-4' : 'mt-8 rounded-3xl px-4 py-6'
      } ${className}`}
    >
      <div
        className={`mx-auto flex w-full max-w-6xl flex-col gap-3 ${
          compact ? '' : 'gap-4'
        }`}
      >
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-2'>
            <Link href='/' className='inline-flex items-center'>
              <Image
                src='/kpitracker-logo.png'
                alt='KpiTracker'
                width={140}
                height={36}
                className='h-8 w-auto'
              />
            </Link>
            <p className='max-w-md text-[11px] leading-relaxed text-gray-500'>
              CRM de gestion des prospects et de suivi des objectifs commerciaux,
              édité par Appatam.
            </p>
          </div>
          <div className='text-[11px] text-gray-500 sm:text-right'>
            <p>
              Support :{' '}
              <a
                href='mailto:contact@appatam.com'
                className='font-medium text-primary hover:underline'
              >
                contact@appatam.com
              </a>
            </p>
            <p className='mt-0.5'>
              Site :{' '}
              <a
                href='https://www.appatam.com'
                target='_blank'
                rel='noreferrer'
                className='font-medium text-primary hover:underline'
              >
                appatam.com
              </a>
            </p>
          </div>
        </div>

        <nav
          aria-label='Informations légales'
          className='flex flex-wrap items-center gap-x-1 gap-y-1.5 text-[11px]'
        >
          {LEGAL_LINKS.map((link, index) => (
            <span key={link.href} className='inline-flex items-center'>
              {index > 0 ? (
                <span className='mx-2 text-primary/20' aria-hidden>
                  ·
                </span>
              ) : null}
              <Link
                href={link.href}
                className='text-gray-500 transition-colors hover:text-primary hover:underline'
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>

        <div className='flex flex-col gap-1 border-t border-primary/10 pt-3 text-[10px] text-gray-400 sm:flex-row sm:items-center sm:justify-between'>
          <p>© {YEAR} Appatam. Tous droits réservés.</p>
          <p>
            Données traitées pour le suivi commercial · Accès selon rôles et
            permissions
          </p>
        </div>
      </div>
    </footer>
  );
}
