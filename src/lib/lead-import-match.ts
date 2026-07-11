import { prisma } from '@/lib/prisma';
import { activeOnlyWhere } from '@/lib/trash';

/** Chiffres uniquement pour comparer des numéros mal formatés. */
export function normalizeContactForMatch(value: string): string {
  return value.replace(/\D/g, '');
}

const PHONE_MATCH_SUFFIX_LEN = 8;

/** Compare deux numéros (formats hétérogènes : +225, espaces, tirets). */
export function phonesMatchForImport(a: string, b: string): boolean {
  const da = normalizeContactForMatch(a);
  const db = normalizeContactForMatch(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (
    da.length >= PHONE_MATCH_SUFFIX_LEN &&
    db.length >= PHONE_MATCH_SUFFIX_LEN
  ) {
    return da.slice(-PHONE_MATCH_SUFFIX_LEN) === db.slice(-PHONE_MATCH_SUFFIX_LEN);
  }
  return false;
}

export function normalizeCompanyNameForMatch(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmailForMatch(value: string): string {
  return value.trim().toLowerCase();
}

export type LeadImportMatchInput = {
  companyId: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
};

export type LeadImportMatchResult =
  | { kind: 'none' }
  | { kind: 'single'; leadId: string; assignedTo: string | null }
  | { kind: 'ambiguous' };

function leadMatchesContact(
  lead: { email: string | null; phone: string | null },
  email: string,
  phoneDigits: string,
): boolean {
  const emailMatch =
    !!email &&
    !!lead.email &&
    normalizeEmailForMatch(lead.email) === email;
  const phoneMatch =
    !!phoneDigits && !!lead.phone && phonesMatchForImport(lead.phone, phoneDigits);
  return emailMatch || phoneMatch;
}

/**
 * Recherche un lead existant par entreprise + (email ou téléphone).
 * Sans email ni téléphone → aucune correspondance (création).
 */
export async function findLeadForImportRow(
  input: LeadImportMatchInput,
): Promise<LeadImportMatchResult> {
  const companyName = input.companyName.trim();
  const email = input.email?.trim()
    ? normalizeEmailForMatch(input.email)
    : '';
  const phoneDigits = input.phone?.trim()
    ? normalizeContactForMatch(input.phone)
    : '';

  if (!companyName || (!email && !phoneDigits)) {
    return { kind: 'none' };
  }

  const candidates = await prisma.lead.findMany({
    where: {
      companyId: input.companyId,
      companyName: { equals: companyName, mode: 'insensitive' },
      ...activeOnlyWhere,
    },
    select: { id: true, email: true, phone: true, assignedTo: true },
  });

  const matched = candidates.filter((lead) =>
    leadMatchesContact(lead, email, phoneDigits),
  );

  if (matched.length === 0) return { kind: 'none' };
  if (matched.length > 1) return { kind: 'ambiguous' };

  return {
    kind: 'single',
    leadId: matched[0].id,
    assignedTo: matched[0].assignedTo,
  };
}
