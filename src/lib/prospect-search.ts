import { formatLeadTypeLabel } from '@/config/lead-options';

export const PROSPECT_SEARCH_FIELDS = [
  { id: 'name', label: "Nom de l'entreprise" },
  { id: 'leadType', label: "Type d'entreprise" },
  { id: 'activitySector', label: "Secteur d'activité" },
  { id: 'location', label: 'Ville' },
  { id: 'source', label: 'Source' },
  { id: 'phone', label: 'Téléphone' },
  { id: 'owner', label: 'Ajouté par' },
  { id: 'contactOwner', label: 'Commercial contact' },
] as const;

export type ProspectSearchFieldId =
  (typeof PROSPECT_SEARCH_FIELDS)[number]['id'];

export const DEFAULT_PROSPECT_SEARCH_FIELDS: ProspectSearchFieldId[] = [
  'name',
  'leadType',
  'activitySector',
  'location',
  'source',
];

export type ProspectSearchable = {
  name: string;
  leadType?: string | null;
  activitySector?: string | null;
  location?: string | null;
  source?: string | null;
  createdBy?: { id: string; name: string } | null;
  contactsPreview?: Array<{
    phone?: string | null;
    ownerName?: string | null;
  }> | null;
};

function fieldValue(
  prospect: ProspectSearchable,
  field: ProspectSearchFieldId,
): string {
  switch (field) {
    case 'name':
      return prospect.name ?? '';
    case 'leadType':
      return formatLeadTypeLabel(prospect.leadType);
    case 'activitySector':
      return prospect.activitySector ?? '';
    case 'location':
      return prospect.location ?? '';
    case 'source':
      return prospect.source ?? '';
    case 'phone':
      return (prospect.contactsPreview ?? [])
        .map((c) => c.phone?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    case 'owner':
      return prospect.createdBy?.name?.trim() ?? '';
    case 'contactOwner':
      return [
        ...new Set(
          (prospect.contactsPreview ?? [])
            .map((c) => c.ownerName?.trim() ?? '')
            .filter(Boolean),
        ),
      ].join(' ');
    default:
      return '';
  }
}

export function prospectMatchesSearchQuery(
  prospect: ProspectSearchable,
  query: string,
  fields: readonly ProspectSearchFieldId[],
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  if (fields.length === 0) return false;

  return fields.some((field) =>
    fieldValue(prospect, field).toLowerCase().includes(trimmed),
  );
}

export function buildProspectSearchPlaceholder(
  fields: readonly ProspectSearchFieldId[],
): string {
  if (fields.length === 0) {
    return 'Sélectionnez au moins un champ de recherche';
  }
  const labels = PROSPECT_SEARCH_FIELDS.filter((f) =>
    fields.includes(f.id),
  ).map((f) => f.label.toLowerCase());
  if (labels.length <= 3) {
    return `Rechercher par ${labels.join(', ')}`;
  }
  return `Rechercher dans ${fields.length} champs sélectionnés`;
}
