import type { ReactNode } from 'react';
import Link from 'next/link';

function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className='rounded-3xl border border-gray-100 bg-white p-6 shadow-neu-soft md:p-8'>
      <p className='text-[11px] font-medium uppercase tracking-wide text-gray-400'>
        Information légale
      </p>
      <h1 className='mt-1 text-2xl font-bold text-primary md:text-3xl'>
        {title}
      </h1>
      <p className='mt-2 text-[12px] text-gray-500'>
        Dernière mise à jour : {updated}
      </p>
      <div className='mt-6 space-y-5 text-sm leading-relaxed text-gray-600'>
        {children}
      </div>
      <p className='mt-8 text-[12px] text-gray-400'>
        Retour à{' '}
        <Link href='/' className='font-medium text-primary hover:underline'>
          l&apos;accueil
        </Link>{' '}
        ou à la{' '}
        <Link href='/login' className='font-medium text-primary hover:underline'>
          connexion
        </Link>
        .
      </p>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className='mb-2 text-base font-semibold text-primary'>{title}</h2>
      {children}
    </section>
  );
}

export default LegalDoc;
