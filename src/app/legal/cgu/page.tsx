import LegalDoc, { LegalSection } from '@/components/legal/LegalDoc';

export default function CguPage() {
  return (
    <LegalDoc title="Conditions d'utilisation" updated='14 septembre 2026'>
      <LegalSection title='1. Objet'>
        <p>
          Les présentes conditions régissent l’accès et l’utilisation de
          KpiTracker par les collaborateurs des entreprises clientes
          d’Appatam.
        </p>
      </LegalSection>

      <LegalSection title='2. Accès au service'>
        <p>
          L’accès est nominatif, protégé par identifiants. Chaque utilisateur
          s’engage à conserver la confidentialité de son mot de passe et à
          activer, lorsque proposé, l’authentification à deux facteurs.
        </p>
      </LegalSection>

      <LegalSection title='3. Usage autorisé'>
        <p>
          KpiTracker doit être utilisé exclusivement à des fins professionnelles
          liées au suivi commercial. Il est interdit d’utiliser le service pour
          des activités illicites, de tenter de contourner les contrôles
          d’accès ou d’extraire massivement des données hors cadre autorisé.
        </p>
      </LegalSection>

      <LegalSection title='4. Rôles et permissions'>
        <p>
          Les droits (commercial, DG, rôles groupe, administrateur) déterminent
          les modules et les fiches consultables ou modifiables. L’utilisateur
          doit respecter le périmètre qui lui est attribué.
        </p>
      </LegalSection>

      <LegalSection title='5. Contenu saisi'>
        <p>
          Les utilisateurs sont responsables de l’exactitude des informations
          saisies (prospects, contacts, clients, pièces jointes). Les
          suppressions peuvent passer par une corbeille avant purge définitive.
        </p>
      </LegalSection>

      <LegalSection title='6. Suspension'>
        <p>
          L’accès peut être suspendu en cas d’usage abusif, de non-respect des
          présentes conditions ou sur demande de l’administrateur de
          l’entreprise.
        </p>
      </LegalSection>

      <LegalSection title='7. Contact'>
        <p>
          Pour toute question relative aux conditions d’utilisation :{' '}
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
