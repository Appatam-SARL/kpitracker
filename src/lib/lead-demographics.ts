import {
  DEFAULT_ACTIVITY_SECTORS,
  DEFAULT_CIVILITIES,
} from '@/config/lead-options';

export const LABEL_NONE = 'Non renseigné';
export const LABEL_OTHER = 'Autre';
export const LABEL_OTHERS_BUCKET = 'Autres';

export type DemographicRow = { label: string; count: number };

function normalizeAgainstList(
  raw: string | null | undefined,
  canonical: readonly string[],
): string {
  if (raw == null || typeof raw !== 'string') return LABEL_NONE;
  const trimmed = raw.trim();
  if (!trimmed) return LABEL_NONE;

  const lower = trimmed.toLowerCase();
  const exact = canonical.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;

  const partial = canonical.find(
    (c) =>
      c !== LABEL_OTHER &&
      c !== LABEL_NONE &&
      (lower.includes(c.toLowerCase()) || c.toLowerCase().includes(lower)),
  );
  if (partial) return partial;

  if (canonical.includes(LABEL_OTHER as (typeof canonical)[number])) {
    return LABEL_OTHER;
  }
  return trimmed;
}

export function normalizeCivility(raw: string | null | undefined): string {
  return normalizeAgainstList(raw, DEFAULT_CIVILITIES);
}

export function normalizeActivitySector(
  raw: string | null | undefined,
): string {
  return normalizeAgainstList(raw, DEFAULT_ACTIVITY_SECTORS);
}

export function normalizeActivityDomain(
  raw: string | null | undefined,
): string {
  if (raw == null || typeof raw !== 'string') return LABEL_NONE;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed || LABEL_NONE;
}

export function normalizeCompanyName(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return LABEL_NONE;
  const trimmed = raw.trim();
  return trimmed || LABEL_NONE;
}

export function normalizeLocation(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return LABEL_NONE;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed || LABEL_NONE;
}

export function normalizeJobTitle(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== 'string') return LABEL_NONE;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed || LABEL_NONE;
}

/** Agrège des lignes groupBy { field, count } vers des libellés normalisés. */
export function aggregateNormalizedRows(
  rows: Array<{ value: string | null; count: number }>,
  normalize: (raw: string | null | undefined) => string,
): DemographicRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = normalize(row.value);
    counts.set(label, (counts.get(label) ?? 0) + row.count);
  }
  return sortDemographicRows(
    Array.from(counts.entries()).map(([label, count]) => ({ label, count })),
  );
}

/** Top N libellés distincts + bucket « Autres » ; « Non renseigné » en fin de liste. */
export function aggregateTopLabels(
  rows: Array<{ value: string | null; count: number }>,
  normalize: (raw: string | null | undefined) => string,
  topN = 10,
): DemographicRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = normalize(row.value);
    counts.set(label, (counts.get(label) ?? 0) + row.count);
  }

  const entries = Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const noneIdx = entries.findIndex((e) => e.label === LABEL_NONE);
  const none = noneIdx >= 0 ? entries.splice(noneIdx, 1)[0] : null;

  const withoutNone = entries.filter((e) => e.label !== LABEL_OTHERS_BUCKET);
  if (withoutNone.length <= topN) {
    const result = sortDemographicRows(withoutNone);
    if (none) result.push(none);
    return sortDemographicRows(result);
  }

  const top = withoutNone.slice(0, topN);
  const rest = withoutNone.slice(topN);
  const othersCount = rest.reduce((acc, e) => acc + e.count, 0);
  const result: DemographicRow[] = [...top];
  if (othersCount > 0) {
    result.push({ label: LABEL_OTHERS_BUCKET, count: othersCount });
  }
  if (none) result.push(none);
  return sortDemographicRows(result);
}

/** @deprecated Utiliser aggregateTopLabels avec normalizeCompanyName */
export function aggregateCompanyNames(
  rows: Array<{ value: string | null; count: number }>,
  topN = 12,
): DemographicRow[] {
  return aggregateTopLabels(rows, normalizeCompanyName, topN);
}

export function sortDemographicRows(rows: DemographicRow[]): DemographicRow[] {
  return [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function sumDemographicRows(rows: DemographicRow[]): number {
  return rows.reduce((acc, r) => acc + r.count, 0);
}
