export const PROSPECT_SOCIAL_NETWORKS = [
  'Facebook',
  'Instagram',
  'LinkedIn',
  'X (Twitter)',
  'TikTok',
  'YouTube',
  'WhatsApp',
  'Autre',
] as const;

export type ProspectSocialNetwork =
  (typeof PROSPECT_SOCIAL_NETWORKS)[number];

export type ProspectSocialLink = {
  network: string;
  url: string;
};

export function normalizeProspectSocialLinks(
  links:
    | Array<{ network?: string | null; url?: string | null }>
    | null
    | undefined,
): ProspectSocialLink[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => ({
      network: String(link?.network ?? '').trim(),
      url: String(link?.url ?? '').trim(),
    }))
    .filter((link) => link.network && link.url);
}
