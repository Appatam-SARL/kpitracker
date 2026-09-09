import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
  DEFAULT_LEAD_SOURCES,
  DEFAULT_LEAD_TYPES,
} from '@/config/lead-options';
import { validateActivityDomainsCell } from '@/lib/lead-activity-domains';
import { parseLeadType } from '@/lib/lead-type';
import type { LeadTypeClient } from '@prisma/client';

export type LeadImportListFields = {
  civility?: string;
  activitySector?: string;
  activityDomain?: string;
  /** Alias rétrocompatibilité anciens imports */
  domain?: string;
  source?: string;
  leadType?: string;
};

export type LeadImportListValidationResult = {
  errors: string[];
  civility: string | null;
  activitySector: string | null;
  activityDomains: string[];
  source: string | null;
  leadType: LeadTypeClient | null;
};

const LIST_FIELD_CONFIG: ReadonlyArray<{
  key: 'civility' | 'activitySector' | 'source';
  label: string;
  options: readonly string[];
  resolve: (row: LeadImportListFields) => string | undefined;
}> = [
  {
    key: 'civility',
    label: 'Civilité',
    options: DEFAULT_CIVILITIES,
    resolve: (row) => row.civility,
  },
  {
    key: 'activitySector',
    label: "Secteur d'activités",
    options: DEFAULT_ACTIVITY_SECTORS,
    resolve: (row) => row.activitySector,
  },
  {
    key: 'source',
    label: 'Source',
    options: DEFAULT_LEAD_SOURCES,
    resolve: (row) => row.source,
  },
];

function formatAllowedValues(options: readonly string[]): string {
  return options.join(', ');
}

function matchListValue(
  raw: string | undefined,
  options: readonly string[],
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const exact = options.find((option) => option.toLowerCase() === lower);
  return exact ?? null;
}

function listFieldError(
  label: string,
  value: string,
  options: readonly string[],
): string {
  return `${label} « ${value} » non reconnue. Choisissez une valeur dans la liste : ${formatAllowedValues(options)}.`;
}

/**
 * Valide civilité, secteur, domaines, source et type de client contre lead-options.
 */
export function validateAndNormalizeLeadImportLists(
  row: LeadImportListFields,
): LeadImportListValidationResult {
  const errors: string[] = [];
  const normalized: LeadImportListValidationResult = {
    errors,
    civility: null,
    activitySector: null,
    activityDomains: [],
    source: null,
    leadType: null,
  };

  for (const { key, label, options, resolve } of LIST_FIELD_CONFIG) {
    const raw = resolve(row);
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    const match = matchListValue(trimmed, options);
    if (match) {
      normalized[key] = match;
      continue;
    }

    errors.push(listFieldError(label, trimmed, options));
  }

  const leadTypeRaw = row.leadType?.trim();
  if (leadTypeRaw) {
    const parsed = parseLeadType(leadTypeRaw);
    if (parsed) {
      normalized.leadType = parsed;
    } else if (parsed === undefined) {
      errors.push(
        listFieldError('Type de client', leadTypeRaw, DEFAULT_LEAD_TYPES),
      );
    }
  }

  const domainCell = row.activityDomain ?? row.domain;
  const domainValidation = validateActivityDomainsCell(domainCell);
  normalized.activityDomains = domainValidation.domains;
  errors.push(...domainValidation.errors);

  return normalized;
}

/** Numéro de ligne Excel (ligne 1 = en-têtes, première donnée = ligne 2). */
export function excelRowNumber(dataIndex: number): number {
  return dataIndex + 2;
}
