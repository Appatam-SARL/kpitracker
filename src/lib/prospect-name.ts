/** Normalise un nom d'entreprise pour recherche / unicité (casse, accents, espaces). */
export function normalizeProspectName(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

export function displayProspectName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed || 'Sans nom';
}
