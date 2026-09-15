import LegalDoc, { LegalSection } from '@/components/legal/LegalDoc';

export default function MentionsLegalesPage() {
  return (
    <LegalDoc title='Mentions légales' updated='14 septembre 2026'>
      <LegalSection title='Éditeur'>
        <p>
          <strong>Appatam</strong>
          <br />
          Éditeur de la solution KpiTracker (CRM de gestion des prospects et de
          suivi des objectifs commerciaux).
        </p>
        <p className='mt-2'>
          Site web :{' '}
          <a
            href='https://www.appatam.com'
            target='_blank'
            rel='noreferrer'
            className='font-medium text-primary hover:underline'
          >
            www.appatam.com
          </a>
          <br />
          Contact :{' '}
          <a
            href='mailto:contact@appatam.com'
            className='font-medium text-primary hover:underline'
          >
            contact@appatam.com
          </a>
        </p>
      </LegalSection>

      <LegalSection title='Produit'>
        <p>
          <strong>KpiTracker</strong> est une application web destinée aux
          équipes commerciales pour suivre les entreprises prospectées, les
          contacts, les clients, l’agenda, les statistiques et les rapports.
        </p>
      </LegalSection>

      <LegalSection title='Hébergement'>
        <p>
          L’application est hébergée sur l’infrastructure mise à disposition
          pour le déploiement de KpiTracker (environnement serveur et base de
          données configurés par Appatam / le client selon le contrat).
        </p>
      </LegalSection>

      <LegalSection title='Propriété intellectuelle'>
        <p>
          L’ensemble des éléments constitutifs de KpiTracker (marque, interface,
          textes, logos, code) est protégé. Toute reproduction non autorisée
          est interdite, sauf accord écrit d’Appatam.
        </p>
      </LegalSection>

      <LegalSection title='Responsabilité'>
        <p>
          Les contenus saisis par les utilisateurs (prospects, notes, pièces
          jointes, rapports) relèvent de leur responsabilité. Appatam s’efforce
          d’assurer la disponibilité du service sans garantir une absence
          totale d’interruption.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
