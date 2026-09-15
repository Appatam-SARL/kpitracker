import {
  DEFAULT_ACTIVITY_DOMAINS,
  matchCiapListValue,
} from '@/config/lead-options';

export function sanitizeActivityDomain(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed || null;
}

export function normalizeActivityDomainsInput(
  domains: string[] | undefined,
): string[] {
  if (!domains?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of domains) {
    const matched =
      matchCiapListValue(raw, DEFAULT_ACTIVITY_DOMAINS) ??
      sanitizeActivityDomain(raw);
    if (!matched) continue;
    const key = matched.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(matched);
  }
  return result;
}

export type ActivityDomainsValidationResult = {
  domains: string[];
  errors: string[];
};

/** Parse une cellule import (virgules) contre la liste CIAP des domaines. */
export function validateActivityDomainsCell(
  raw: string | undefined,
): ActivityDomainsValidationResult {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { domains: [], errors: [] };
  }

  const parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const domains: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const match = matchCiapListValue(part, DEFAULT_ACTIVITY_DOMAINS);
    if (!match) {
      errors.push(
        `Domaine d'activités « ${part} » non reconnu. Choisissez une valeur dans la liste CIAP.`,
      );
      continue;
    }
    const key = match.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    domains.push(match);
  }

  return { domains, errors };
}

export function mapLeadActivityDomains(
  rows: Array<{ domain: string }> | undefined,
): string[] {
  if (!rows?.length) return [];
  return rows.map((r) => r.domain);
}

export const leadActivityDomainsInclude = {
  activityDomains: {
    select: { domain: true },
    orderBy: { domain: 'asc' as const },
  },
};

export function formatActivityDomainsLabel(
  domains: string[] | undefined | null,
): string {
  if (!domains?.length) return '—';
  return domains.join(', ');
}

export function serializeLeadWithActivityDomains<
  T extends {
    activityDomains?: Array<{ domain: string }>;
    company?: { name: string } | null;
  },
>(lead: T): Omit<T, 'activityDomains' | 'company'> & {
  activityDomains: string[];
  crmCompanyName?: string;
} {
  const { activityDomains, company, ...rest } = lead;
  return {
    ...rest,
    activityDomains: mapLeadActivityDomains(activityDomains),
    ...(company?.name ? { crmCompanyName: company.name } : {}),
  };
}
