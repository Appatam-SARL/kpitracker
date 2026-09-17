'use client';

import ProspectFichePage from '@/components/prospects/ProspectFichePage';

export default function EntrepriseFichePage() {
  return (
    <ProspectFichePage
      backHref='/entreprises'
      backLabel='Retour aux entreprises'
    />
  );
}
