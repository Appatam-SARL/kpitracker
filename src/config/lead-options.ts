// Options par défaut réutilisables pour les leads
// Sources, secteurs CIAP, domaines CIAP (listes) ; sources / civilités

export const DEFAULT_LEAD_SOURCES = [
  'Client inbound',
  'Prospection mail - téléphone',
  'Recommandation client',
  'Prospection terrain',
  'Événement',
  'Facebook',
  'Tik Tok',
  'LinkedIn',
  'Appel d\'offres',
  'Autres',
] as const;

function sortFrByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }),
  );
}

function formatCiapOption(code: string, label: string): string {
  return `${code} - ${label}`;
}

/** Secteurs d'activité CIAP (nomenclature A–U), tri alphabétique sur le libellé. */
const ACTIVITY_SECTOR_ENTRIES = sortFrByLabel([
  { code: 'A', label: 'Agriculture, sylviculture, pêche' },
  { code: 'B', label: 'Activités extractives' },
  { code: 'C', label: 'Industrie manufacturière' },
  { code: 'D', label: 'Électricité, gaz, vapeur, air conditionné' },
  { code: 'E', label: 'Eau, assainissement, déchets' },
  { code: 'F', label: 'Construction' },
  { code: 'G', label: 'Commerce' },
  { code: 'H', label: 'Transports et entreposage' },
  { code: 'I', label: 'Hébergement et restauration' },
  { code: 'J', label: 'Information et communication' },
  { code: 'K', label: "Activités financières et d'assurance" },
  { code: 'L', label: 'Activités immobilières' },
  {
    code: 'M',
    label: 'Activités spécialisées, scientifiques et techniques',
  },
  { code: 'N', label: 'Services administratifs et de soutien' },
  { code: 'O', label: 'Administration publique' },
  { code: 'P', label: 'Enseignement' },
  { code: 'Q', label: 'Santé humaine et action sociale' },
  { code: 'R', label: 'Arts, spectacles, activités récréatives' },
  { code: 'S', label: 'Autres activités de services' },
  { code: 'T', label: 'Activités des ménages employeurs' },
  { code: 'U', label: 'Organisations extraterritoriales' },
]);

export const DEFAULT_ACTIVITY_SECTORS = ACTIVITY_SECTOR_ENTRIES.map((e) =>
  formatCiapOption(e.code, e.label),
) as unknown as readonly string[];

/** Domaines d'activités CIAP (codes A01–U99), tri alphabétique sur le libellé. */
const ACTIVITY_DOMAIN_ENTRIES = sortFrByLabel([
  {
    code: 'A01',
    label: 'Agriculture, élevage, chasse et services annexes',
  },
  { code: 'A02', label: 'Sylviculture et exploitation forestière' },
  { code: 'A03', label: 'Pêche et aquaculture' },
  { code: 'B05', label: 'Extraction de houille et de lignite' },
  { code: 'B06', label: "Extraction d'hydrocarbures" },
  { code: 'B07', label: 'Extraction de minerais métalliques' },
  { code: 'B08', label: 'Autres industries extractives' },
  {
    code: 'B09',
    label: 'Services de soutien aux industries extractives',
  },
  { code: 'C10', label: 'Industries alimentaires' },
  { code: 'C11', label: 'Fabrication de boissons' },
  { code: 'C12', label: 'Fabrication de produits à base de tabac' },
  { code: 'C13', label: 'Fabrication de textiles' },
  { code: 'C14', label: "Fabrication d'articles d'habillement" },
  { code: 'C15', label: 'Travail du cuir et de la chaussure' },
  { code: 'C16', label: 'Travail du bois' },
  { code: 'C17', label: 'Fabrication de papier et carton' },
  {
    code: 'C18',
    label: "Imprimerie et reproduction d'enregistrements",
  },
  { code: 'C19', label: 'Cokéfaction et raffinage' },
  { code: 'C20', label: 'Fabrication de produits chimiques' },
  { code: 'C21', label: 'Fabrication de produits pharmaceutiques' },
  {
    code: 'C22',
    label: 'Fabrication de produits en caoutchouc et plastique',
  },
  {
    code: 'C23',
    label: "Fabrication d'autres produits minéraux non métalliques",
  },
  { code: 'C24', label: 'Métallurgie' },
  { code: 'C25', label: 'Fabrication de produits métalliques' },
  {
    code: 'C26',
    label:
      'Fabrication de produits informatiques, électroniques et optiques',
  },
  { code: 'C27', label: "Fabrication d'équipements électriques" },
  {
    code: 'C28',
    label: 'Fabrication de machines et équipements n.c.a.',
  },
  { code: 'C29', label: 'Industrie automobile' },
  {
    code: 'C30',
    label: "Fabrication d'autres matériels de transport",
  },
  { code: 'C31', label: 'Fabrication de meubles' },
  { code: 'C32', label: 'Autres industries manufacturières' },
  {
    code: 'C33',
    label: 'Réparation et installation de machines et équipements',
  },
  {
    code: 'D35',
    label:
      "Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
  },
  {
    code: 'E36',
    label: "Captage, traitement et distribution d'eau",
  },
  { code: 'E37', label: 'Collecte et traitement des eaux usées' },
  {
    code: 'E38',
    label: 'Collecte, traitement et élimination des déchets',
  },
  {
    code: 'E39',
    label: 'Dépollution et autres services de gestion des déchets',
  },
  { code: 'F41', label: 'Construction de bâtiments' },
  { code: 'F42', label: 'Génie civil' },
  { code: 'F43', label: 'Travaux de construction spécialisés' },
  {
    code: 'G45',
    label: "Commerce et réparation d'automobiles et de motocycles",
  },
  { code: 'G46', label: 'Commerce de gros' },
  { code: 'G47', label: 'Commerce de détail' },
  {
    code: 'H49',
    label: 'Transports terrestres et transport par conduites',
  },
  { code: 'H50', label: 'Transports par eau' },
  { code: 'H51', label: 'Transports aériens' },
  {
    code: 'H52',
    label: 'Entreposage et services auxiliaires des transports',
  },
  { code: 'H53', label: 'Activités de poste et de courrier' },
  { code: 'I55', label: 'Hébergement' },
  { code: 'I56', label: 'Restauration' },
  { code: 'J58', label: 'Édition' },
  {
    code: 'J59',
    label: 'Production de films, vidéo, programmes TV',
  },
  { code: 'J60', label: 'Programmation et diffusion' },
  { code: 'J61', label: 'Télécommunications' },
  {
    code: 'J62',
    label: 'Programmation, conseil et activités informatiques',
  },
  { code: 'J63', label: "Services d'information" },
  { code: 'K64', label: 'Services financiers' },
  { code: 'K65', label: 'Assurance, réassurance' },
  {
    code: 'K66',
    label: 'Activités auxiliaires de services financiers',
  },
  { code: 'L68', label: 'Activités immobilières' },
  { code: 'M69', label: 'Activités juridiques et comptables' },
  {
    code: 'M70',
    label: 'Activités de sièges sociaux ; conseil de gestion',
  },
  { code: 'M71', label: 'Architecture et ingénierie' },
  { code: 'M72', label: 'Recherche-développement scientifique' },
  { code: 'M73', label: 'Publicité et études de marché' },
  {
    code: 'M74',
    label: 'Autres activités spécialisées, scientifiques et techniques',
  },
  { code: 'M75', label: 'Activités vétérinaires' },
  { code: 'N77', label: 'Activités de location et location-bail' },
  { code: 'N78', label: "Activités liées à l'emploi" },
  { code: 'N79', label: 'Agences de voyage, voyagistes' },
  { code: 'N80', label: 'Enquêtes et sécurité' },
  {
    code: 'N81',
    label: 'Services relatifs aux bâtiments et paysages',
  },
  {
    code: 'N82',
    label: 'Activités administratives et de soutien aux entreprises',
  },
  { code: 'O84', label: 'Administration publique et défense' },
  { code: 'P85', label: 'Enseignement' },
  { code: 'Q86', label: 'Activités pour la santé humaine' },
  { code: 'Q87', label: 'Hébergement médico-social' },
  { code: 'Q88', label: 'Action sociale sans hébergement' },
  {
    code: 'R90',
    label: 'Activités créatives, artistiques et de spectacle',
  },
  { code: 'R91', label: 'Bibliothèques, archives, musées' },
  { code: 'R92', label: "Jeux de hasard et d'argent" },
  {
    code: 'R93',
    label: 'Activités sportives, récréatives et de loisirs',
  },
  { code: 'S94', label: 'Activités des organisations associatives' },
  {
    code: 'S95',
    label: "Réparation d'ordinateurs et de biens personnels",
  },
  { code: 'S96', label: 'Autres services personnels' },
  {
    code: 'T97',
    label:
      "Activités des ménages en tant qu'employeurs de personnel domestique",
  },
  {
    code: 'T98',
    label: 'Activités indifférenciées des ménages pour usage propre',
  },
  {
    code: 'U99',
    label: 'Activités des organisations et organismes extraterritoriaux',
  },
]);

export const DEFAULT_ACTIVITY_DOMAINS = ACTIVITY_DOMAIN_ENTRIES.map((e) =>
  formatCiapOption(e.code, e.label),
) as unknown as readonly string[];

/**
 * Résout une valeur saisie (code, libellé ou « CODE - libellé ») vers
 * l'option canonique de la liste, ou null si inconnue.
 */
export function matchCiapListValue(
  raw: string | undefined,
  options: readonly string[],
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const exact = options.find((option) => option.toLowerCase() === lower);
  if (exact) return exact;

  const byCode = options.find((option) => {
    const code = option.split(' - ')[0]?.trim().toLowerCase();
    return code === lower;
  });
  if (byCode) return byCode;

  const byLabel = options.find((option) => {
    const label = option.includes(' - ')
      ? option.slice(option.indexOf(' - ') + 3).trim().toLowerCase()
      : '';
    return label === lower;
  });
  return byLabel ?? null;
}

/** Lettre CIAP du secteur (ex. « C - Industrie… » → « C »). */
export function getActivitySectorLetter(
  sector: string | null | undefined,
): string | null {
  const matched = matchCiapListValue(sector ?? undefined, DEFAULT_ACTIVITY_SECTORS);
  const raw = matched ?? sector?.trim();
  if (!raw) return null;
  const code = raw.split(' - ')[0]?.trim().toUpperCase() ?? '';
  return /^[A-U]$/.test(code) ? code : null;
}

/** Domaines CIAP rattachés à un secteur (même lettre de code). */
export function getActivityDomainsForSector(
  sector: string | null | undefined,
): readonly string[] {
  const letter = getActivitySectorLetter(sector);
  if (!letter) return [];
  return DEFAULT_ACTIVITY_DOMAINS.filter((domain) =>
    new RegExp(`^${letter}\\d`, 'i').test(domain),
  );
}

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

/** Rôle du contact dans la décision d'achat. */
export const DECISION_ROLE_OPTIONS = [
  { value: 'DECIDEUR', label: 'Décideur' },
  { value: 'PRESCRIPTEUR', label: 'Prescripteur' },
  { value: 'INFLUENCEUR', label: 'Influenceur' },
  { value: 'RELAI_INTERNE', label: 'Relai interne' },
  { value: 'NON_DETERMINE', label: 'Non déterminé' },
] as const;

export type DecisionRoleValue = (typeof DECISION_ROLE_OPTIONS)[number]['value'];

export function formatDecisionRoleLabel(
  value: string | null | undefined,
): string {
  if (value == null || value === '') return 'Non déterminé';
  const byValue = DECISION_ROLE_OPTIONS.find((option) => option.value === value);
  if (byValue) return byValue.label;
  const byLabel = DECISION_ROLE_OPTIONS.find(
    (option) => option.label.toLowerCase() === value.trim().toLowerCase(),
  );
  return byLabel?.label ?? value;
}

export function parseDecisionRole(
  raw: string | null | undefined,
): DecisionRoleValue | null | undefined {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const asEnum = trimmed.toUpperCase().replace(/[\s-]+/g, '_');
  if (DECISION_ROLE_OPTIONS.some((o) => o.value === asEnum)) {
    return asEnum as DecisionRoleValue;
  }

  const key = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
  const byLabel = DECISION_ROLE_OPTIONS.find(
    (option) =>
      option.label
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '') === key,
  );
  return byLabel?.value;
}
