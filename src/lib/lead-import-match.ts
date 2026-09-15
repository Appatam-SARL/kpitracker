import { prisma } from '@/lib/prisma';
import { normalizeProspectName } from '@/lib/prospect-name';
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
  return normalizeProspectName(value);
}

export function normalizeEmailForMatch(value: string): string {
  return value.trim().toLowerCase();
}

export type LeadImportMatchInput = {
  /** Ignoré (pool GROUP) — conservé pour compat appelants. */
  companyId?: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
};

export type LeadImportMatchResult =
  | { kind: 'none' }
  | { kind: 'single'; leadId: string; assignedTo: string | null }
  | { kind: 'ambiguous' };

function contactMatches(
  contact: { email: string | null; phone: string | null },
  email: string,
  phoneDigits: string,
): boolean {
  const emailMatch =
    !!email &&
    !!contact.email &&
    normalizeEmailForMatch(contact.email) === email;
  const phoneMatch =
    !!phoneDigits &&
    !!contact.phone &&
    phonesMatchForImport(contact.phone, phoneDigits);
  return emailMatch || phoneMatch;
}

/**
 * Recherche un prospect existant par entreprise + (email ou téléphone contact).
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

  const nameNormalized = normalizeProspectName(companyName);
  const prospect = await prisma.prospect.findFirst({
    where: { nameNormalized, ...activeOnlyWhere },
    select: {
      id: true,
      contacts: {
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          phone: true,
          createdById: true,
        },
      },
    },
  });

  if (!prospect) return { kind: 'none' };

  const matched = prospect.contacts.filter((c) =>
    contactMatches(c, email, phoneDigits),
  );

  if (matched.length === 0) return { kind: 'none' };
  if (matched.length > 1) return { kind: 'ambiguous' };

  return {
    kind: 'single',
    leadId: prospect.id,
    assignedTo: matched[0].createdById,
  };
}
