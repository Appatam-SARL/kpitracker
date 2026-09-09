// Options par défaut réutilisables pour les leads
// Sources, secteurs (listes) ; domaines = saisie libre par la commerciale

export const DEFAULT_LEAD_SOURCES = [
  'Non renseigné',
  'Facebook',
  'WhatsApp',
  'LinkedIn',
  'Site web',
  'Bouche-à-oreille',
  'Email',
  'Partenaires',
  'Salon / évènement',
  'Recommandation client',
  'Appel entrant',
  'Prospection terrain',
  'Autre',
] as const;

/** Secteurs d'activité CIAP (nomenclature A–U). */
export const DEFAULT_ACTIVITY_SECTORS = [
  'Activités des ménages employeurs',
  'Activités extractives',
  "Activités financières et d'assurance",
  'Activités immobilières',
  'Activités spécialisées, scientifiques et techniques',
  'Administration publique',
  'Agriculture, sylviculture, pêche',
  'Arts, spectacles, activités récréatives',
  'Autres activités de services',
  'Commerce',
  'Construction',
  'Eau, assainissement, déchets',
  'Électricité, gaz, vapeur, air conditionné',
  'Enseignement',
  'Hébergement et restauration',
  'Industrie manufacturière',
  'Information et communication',
  'Organisations extraterritoriales',
  'Santé humaine et action sociale',
  'Services administratifs et de soutien',
  'Transports et entreposage',
] as const;

export const DEFAULT_CIVILITIES = ['M.', 'Mme', 'Mlle', 'Dr', 'Pr'] as const;

/** Types de client (TypeClient) — libellés UI / Excel. */
export const DEFAULT_LEAD_TYPES = [
  'Agence de Coopération / Opérateur',
  'Collectivité territoriale',
  'Entreprise Privée (B2B)',
  'Gouvernement & Secteur Public',
  'Hôtels et espaces événementiel',
  'Institution Financière Internationale (IFI)',
  'Institution Multilatérale (OI)',
  'Non déterminé',
  'ONG & Association / Académique',
  'Particulier (B2C)',
] as const;

export type LeadTypeLabel = (typeof DEFAULT_LEAD_TYPES)[number];

/** Valeurs enum Prisma LeadTypeClient (sans importer @prisma/client côté client). */
export const LEAD_TYPE_OPTIONS = [
  {
    value: 'AGENCE_DE_COOPERATION_OPERATEUR',
    label: 'Agence de Coopération / Opérateur',
  },
  {
    value: 'COLLECTIVITE_TERRITORIALE',
    label: 'Collectivité territoriale',
  },
  {
    value: 'ENTREPRISE_PRIVEE_B2B',
    label: 'Entreprise Privée (B2B)',
  },
  {
    value: 'GOUVERNEMENT_SECTEUR_PUBLIC',
    label: 'Gouvernement & Secteur Public',
  },
  {
    value: 'HOTELS_ET_ESPACES_EVENEMENTIEL',
    label: 'Hôtels et espaces événementiel',
  },
  {
    value: 'INSTITUTION_FINANCIERE_INTERNATIONALE_IFI',
    label: 'Institution Financière Internationale (IFI)',
  },
  {
    value: 'INSTITUTION_MULTILATERALE_OI',
    label: 'Institution Multilatérale (OI)',
  },
  {
    value: 'NON_DETERMINE',
    label: 'Non déterminé',
  },
  {
    value: 'ONG_ASSOCIATION_ACADEMIQUE',
    label: 'ONG & Association / Académique',
  },
  {
    value: 'PARTICULIER_B2C',
    label: 'Particulier (B2C)',
  },
] as const;

export type LeadTypeValue = (typeof LEAD_TYPE_OPTIONS)[number]['value'];

export function formatLeadTypeLabel(
  value: string | null | undefined,
): string {
  if (value == null || value === '') return 'Non déterminé';
  const byValue = LEAD_TYPE_OPTIONS.find((option) => option.value === value);
  if (byValue) return byValue.label;
  const byLabel = LEAD_TYPE_OPTIONS.find(
    (option) => option.label.toLowerCase() === value.trim().toLowerCase(),
  );
  return byLabel?.label ?? value;
}
