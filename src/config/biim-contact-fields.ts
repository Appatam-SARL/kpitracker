export const BIIM_COMPANY_NAME = 'BIIM';

export const BIIM_DOCUMENT_NONE = 'Aucun document';

export const BIIM_DOCUMENT_OPTIONS = [
  'Agrément du Ministère du Tourisme',
  'Fiche de contrôle de police',
  'Autorisation Burida',
  BIIM_DOCUMENT_NONE,
] as const;

export type BiimDocumentOption = (typeof BIIM_DOCUMENT_OPTIONS)[number];

export const BIIM_UPLOADABLE_DOCUMENTS = BIIM_DOCUMENT_OPTIONS.filter(
  (doc) => doc !== BIIM_DOCUMENT_NONE,
);

export const BIIM_YES_NO_OPTIONS = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
] as const;

export type BiimYesNoValue = (typeof BIIM_YES_NO_OPTIONS)[number]['value'];

export function isBiimCompanyName(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return (
    normalized === 'biim' ||
    normalized.startsWith('biim ') ||
    normalized.includes(' biim')
  );
}

export function parseBiimYesNo(
  value: unknown,
): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'oui' || raw === 'true' || raw === '1') return true;
  if (raw === 'non' || raw === 'false' || raw === '0') return false;
  return null;
}

export function biimYesNoToFormValue(
  value: boolean | null | undefined,
): '' | BiimYesNoValue {
  if (value === true) return 'oui';
  if (value === false) return 'non';
  return '';
}

export function formatBiimYesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Oui';
  if (value === false) return 'Non';
  return '—';
}

export function normalizeBiimDocuments(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    return [];
  }
  const allowed = new Set<string>(BIIM_DOCUMENT_OPTIONS);
  const docs = value
    .map((item) => String(item ?? '').trim())
    .filter((item) => item && allowed.has(item));
  if (docs.includes(BIIM_DOCUMENT_NONE)) {
    return [BIIM_DOCUMENT_NONE];
  }
  return Array.from(new Set(docs));
}
