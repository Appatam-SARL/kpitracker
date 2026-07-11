export const LEAD_SEARCH_FIELDS = [
  { id: 'firstName', label: 'Prénom' },
  { id: 'lastName', label: 'Nom' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Téléphone' },
  { id: 'companyName', label: "Nom de l'entreprise" },
  { id: 'jobTitle', label: 'Poste / fonction' },
  { id: 'activitySector', label: "Secteur d'activités" },
  { id: 'activityDomains', label: "Domaines d'activités" },
  { id: 'location', label: 'Situation géographique' },
  { id: 'source', label: 'Source' },
  { id: 'civility', label: 'Civilité' },
  { id: 'notes', label: 'Notes / observation' },
  { id: 'crmCompanyName', label: 'Société CRM' },
] as const;

export type LeadSearchFieldId = (typeof LEAD_SEARCH_FIELDS)[number]['id'];

export const DEFAULT_LEAD_SEARCH_FIELDS: LeadSearchFieldId[] = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'jobTitle',
];

export type LeadSearchable = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  activitySector?: string | null;
  activityDomains?: string[] | null;
  location?: string | null;
  source?: string | null;
  civility?: string | null;
  notes?: string | null;
  crmCompanyName?: string | null;
};

function fieldValue(lead: LeadSearchable, field: LeadSearchFieldId): string {
  switch (field) {
    case 'firstName':
      return lead.firstName ?? '';
    case 'lastName':
      return lead.lastName ?? '';
    case 'email':
      return lead.email ?? '';
    case 'phone':
      return lead.phone ?? '';
    case 'companyName':
      return lead.companyName ?? '';
    case 'jobTitle':
      return lead.jobTitle ?? '';
    case 'activitySector':
      return lead.activitySector ?? '';
    case 'activityDomains':
      return (lead.activityDomains ?? []).join(' ');
    case 'location':
      return lead.location ?? '';
    case 'source':
      return lead.source ?? '';
    case 'civility':
      return lead.civility ?? '';
    case 'notes':
      return lead.notes ?? '';
    case 'crmCompanyName':
      return lead.crmCompanyName ?? '';
    default:
      return '';
  }
}

export function leadMatchesSearchQuery(
  lead: LeadSearchable,
  query: string,
  fields: readonly LeadSearchFieldId[],
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  if (fields.length === 0) return false;

  return fields.some((field) =>
    fieldValue(lead, field).toLowerCase().includes(trimmed),
  );
}

export function buildSearchPlaceholder(
  fields: readonly LeadSearchFieldId[],
): string {
  if (fields.length === 0) {
    return 'Sélectionnez au moins un champ de recherche';
  }
  const labels = LEAD_SEARCH_FIELDS.filter((f) => fields.includes(f.id)).map(
    (f) => f.label.toLowerCase(),
  );
  if (labels.length <= 3) {
    return `Rechercher par ${labels.join(', ')}`;
  }
  return `Rechercher dans ${fields.length} champs sélectionnés`;
}
