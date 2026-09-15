import LegalDoc, { LegalSection } from '@/components/legal/LegalDoc';

export default function ConfidentialitePage() {
  return (
    <LegalDoc title='Politique de confidentialité' updated='14 septembre 2026'>
      <LegalSection title='1. Responsable du traitement'>
        <p>
          Le service KpiTracker est édité par Appatam. Les données collectées
          via la plateforme sont traitées pour permettre la gestion commerciale
          des entreprises utilisatrices (prospects, clients, utilisateurs,
          objectifs et rapports).
        </p>
      </LegalSection>

      <LegalSection title='2. Données collectées'>
        <p>Selon votre usage, KpiTracker peut traiter notamment :</p>
        <ul className='mt-2 list-disc space-y-1 pl-5'>
          <li>identité et coordonnées des utilisateurs (nom, e-mail, rôle) ;</li>
          <li>
            données de prospects et contacts (entreprise, téléphone, e-mail,
            notes, pièces jointes) ;
          </li>
          <li>données clients, ventes, objectifs et rapports générés ;</li>
          <li>
            journaux d’actions nécessaires à la sécurité et à l’audit interne.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title='3. Finalités'>
        <p>
          Les traitements visent le suivi des prospects, la collaboration
          commerciale, le pilotage des objectifs, la génération de rapports et
          la sécurisation des accès (authentification, rôles, MFA).
        </p>
      </LegalSection>

      <LegalSection title='4. Accès et partage'>
        <p>
          L’accès aux données est limité selon les rôles (commercial, DG, rôles
          groupe, administrateur). Les données ne sont pas vendues. Elles
          peuvent être hébergées chez des prestataires techniques nécessaires
          au fonctionnement du service.
        </p>
      </LegalSection>

      <LegalSection title='5. Conservation'>
        <p>
          Les données sont conservées pendant la durée d’utilisation du service
          et, le cas échéant, le temps nécessaire aux obligations légales ou à
          la restauration via la corbeille avant purge définitive.
        </p>
      </LegalSection>

      <LegalSection title='6. Sécurité'>
        <p>
          Des mesures techniques et organisationnelles sont mises en œuvre
          (sessions authentifiées, contrôle des rôles, mots de passe hashés,
          MFA optionnel). Les utilisateurs doivent protéger leurs identifiants
          et ne pas partager leur compte.
        </p>
      </LegalSection>

      <LegalSection title='7. Vos droits'>
        <p>
          Selon la réglementation applicable, vous pouvez demander l’accès, la
          rectification ou la suppression de certaines données personnelles via
          votre administrateur ou en écrivant à{' '}
          <a
            href='mailto:contact@appatam.com'
            className='font-medium text-primary hover:underline'
          >
            contact@appatam.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
