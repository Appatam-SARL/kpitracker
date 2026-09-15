import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-screen bg-bgGray text-primary'>
      <header className='border-b border-gray-200/80 bg-white'>
        <div className='mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4'>
          <Link href='/' className='inline-flex items-center gap-2'>
            <img
              src='/kpitracker-logo.png'
              alt='KpiTracker'
              className='h-8 w-auto'
            />
            <span className='text-sm font-semibold'>KpiTracker</span>
          </Link>
          <Link
            href='/login'
            className='text-[12px] font-medium text-gray-500 hover:text-primary'
          >
            Connexion
          </Link>
        </div>
      </header>
      <main className='mx-auto max-w-3xl px-4 py-8 md:py-10'>{children}</main>
      <div className='mx-auto max-w-3xl px-4 pb-8'>
        <p className='text-center text-[11px] text-gray-400'>
          © {new Date().getFullYear()} Appatam ·{' '}
          <Link href='/legal/confidentialite' className='hover:text-primary'>
            Confidentialité
          </Link>{' '}
          ·{' '}
          <Link href='/legal/mentions-legales' className='hover:text-primary'>
            Mentions légales
          </Link>{' '}
          ·{' '}
          <Link href='/legal/cgu' className='hover:text-primary'>
            CGU
          </Link>
        </p>
      </div>
    </div>
  );
}
