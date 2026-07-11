/** Modèle Excel d'import des prospects (12 colonnes, ordre A→L). */

export type LeadImportField =
  | 'civility'
  | 'lastName'
  | 'firstName'
  | 'phone'
  | 'email'
  | 'companyName'
  | 'jobTitle'
  | 'activitySector'
  | 'activityDomain'
  | 'source'
  | 'location'
  | 'observation';

export type LeadImportRow = {
  civility?: string;
  lastName?: string;
  firstName?: string;
  phone?: string;
  email?: string;
  companyName: string;
  jobTitle?: string;
  activitySector?: string;
  activityDomain?: string;
  source?: string;
  location?: string;
  observation?: string;
};

export const LEAD_IMPORT_HEADERS = [
  'Civilité',
  'Nom',
  'Prenoms',
  'Contact',
  'Email',
  "Nom de l'entreprise",
  'Poste / Fonction',
  "Secteur d'activités",
  "Domaine d'activités",
  'Source',
  'Situation géographique',
  'Observation',
] as const;

export const LEAD_IMPORT_EXAMPLE_ROW: string[] = [
  'M.',
  'Dupont',
  'Jean',
  '+225 01 23 45 67',
  'contact@acme.ci',
  'Acme Corp',
  'Directeur commercial',
  'Information & communication',
  'Informatique et télécommunication, Santé',
  '',
  'Abidjan, Cocody',
  'Client rencontré au salon X',
];

export const LEAD_IMPORT_HEADERS_HELP = LEAD_IMPORT_HEADERS.join(', ');

/** Largeurs des colonnes A→L (alignées import / export). */
export const LEAD_IMPORT_COLUMN_WIDTHS = [
  12, 14, 14, 18, 26, 22, 20, 22, 24, 18, 22, 28,
] as const;

/** Enregistrement lead pour export Excel (même disposition que l'import). */
export type LeadExportRecord = {
  civility?: string | null;
  lastName: string;
  firstName: string;
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  activitySector?: string | null;
  activityDomains?: string[] | null;
  source?: string | null;
  location?: string | null;
  notes?: string | null;
};

/** Convertit un lead en ligne Excel (ordre identique à LEAD_IMPORT_HEADERS). */
export function mapLeadToImportExcelRow(lead: LeadExportRecord): string[] {
  return [
    lead.civility ?? '',
    lead.lastName ?? '',
    lead.firstName ?? '',
    lead.phone ?? '',
    lead.email ?? '',
    lead.companyName ?? '',
    lead.jobTitle ?? '',
    lead.activitySector ?? '',
    (lead.activityDomains ?? []).join(', '),
    lead.source ?? '',
    lead.location ?? '',
    lead.notes ?? '',
  ];
}

/** Normalise un en-tête Excel pour comparaison robuste. */
export function normalizeImportHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Mappe un en-tête normalisé vers un champ logique (anciens fichiers inclus). */
export function mapHeaderToField(normalized: string): LeadImportField | undefined {
  if (
    normalized.includes('civilite') ||
    normalized.includes('civility') ||
    normalized.includes('titre')
  ) {
    return 'civility';
  }

  // Prénom avant nom : « prenoms » contient la sous-chaîne « nom »
  if (
    normalized === 'prenoms' ||
    normalized === 'prenom' ||
    normalized.includes('prenom')
  ) {
    return 'firstName';
  }

  if (
    normalized === 'nom' ||
    (normalized.includes('nom') &&
      !normalized.includes('prenom') &&
      !normalized.includes('entreprise') &&
      !normalized.includes('domaine') &&
      !normalized.includes('secteur'))
  ) {
    return 'lastName';
  }

  if (
    normalized === 'contact' ||
    normalized.includes('telephone') ||
    normalized.includes('tel') ||
    normalized.includes('phone')
  ) {
    return 'phone';
  }

  if (normalized.includes('email') || normalized === 'mail') {
    return 'email';
  }

  if (
    normalized.includes('nomentreprise') ||
    normalized.includes('raisonsociale') ||
    (normalized.includes('entreprise') &&
      !normalized.includes('domaine') &&
      !normalized.includes('secteur'))
  ) {
    return 'companyName';
  }

  if (
    normalized.includes('poste') ||
    normalized.includes('fonction') ||
    normalized.includes('jobtitle')
  ) {
    return 'jobTitle';
  }

  // Secteur avant domaine (évite le conflit sur « activites »)
  if (
    normalized.includes('secteur') ||
    normalized === 'secteuractivites'
  ) {
    return 'activitySector';
  }

  if (
    normalized.includes('domainedactivites') ||
    (normalized.includes('domaine') && !normalized.includes('secteur'))
  ) {
    return 'activityDomain';
  }

  if (normalized === 'source' || normalized.includes('sourcelead')) {
    return 'source';
  }

  if (
    normalized.includes('situationgeographique') ||
    normalized.includes('localisation') ||
    normalized.includes('lieu') ||
    normalized.includes('adresse')
  ) {
    return 'location';
  }

  if (normalized.includes('observation') || normalized.includes('note')) {
    return 'observation';
  }

  return undefined;
}

export function createEmptyImportRow(): LeadImportRow {
  return { companyName: '' };
}

export const LEAD_IMPORT_SHEET_NAME = 'Leads';

/** Indique si une ligne d'en-têtes Excel contient au moins une colonne reconnue. */
export function sheetRowHasRecognizedImportHeader(cells: unknown[]): boolean {
  return cells.some((cell) => {
    const text = String(cell ?? '').trim();
    if (!text) return false;
    return mapHeaderToField(normalizeImportHeader(text)) !== undefined;
  });
}

/** Construit la correspondance en-tête Excel → champ logique. */
export function buildImportHeaderMap(
  headerKeys: string[],
): Record<string, LeadImportField> {
  const headerMap: Record<string, LeadImportField> = {};
  for (const key of headerKeys) {
    const field = mapHeaderToField(normalizeImportHeader(key));
    if (field) headerMap[key] = field;
  }
  return headerMap;
}
