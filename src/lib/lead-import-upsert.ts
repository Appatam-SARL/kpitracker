import type { LeadImportListValidationResult } from '@/lib/lead-import-validation';

export type LeadImportRowData = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  companyName: string;
  jobTitle: string | null;
  location: string | null;
  notes: string | null;
  civility: string | null;
  source: string | null;
  activitySector: string | null;
  activityDomains: string[];
};

export function buildLeadDataFromImportRow(
  row: {
    phone?: string;
    email?: string;
    jobTitle?: string;
    location?: string;
    observation?: string;
  },
  companyName: string,
  firstName: string,
  lastName: string,
  listValidation: LeadImportListValidationResult,
): LeadImportRowData {
  return {
    firstName,
    lastName,
    phone: row.phone?.trim() || null,
    email: row.email?.trim() || null,
    companyName,
    jobTitle: row.jobTitle?.trim() || null,
    location: row.location?.trim() || null,
    notes: row.observation?.trim() || null,
    civility: listValidation.civility,
    source: listValidation.source,
    activitySector: listValidation.activitySector,
    activityDomains: listValidation.activityDomains,
  };
}

export function resolveImportNames(
  row: { firstName?: string; lastName?: string },
  companyName: string,
): { firstName: string; lastName: string } {
  let firstName = row.firstName?.trim() || '';
  let lastName = row.lastName?.trim() || '';

  if (!firstName && !lastName) {
    return { firstName: 'Contact', lastName: companyName };
  }
  if (!firstName) firstName = 'Contact';
  if (!lastName) lastName = companyName;
  return { firstName, lastName };
}
