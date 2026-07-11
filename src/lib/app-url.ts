/** URL publique de l’app (évite les crash si NEXT_PUBLIC_APP_URL est sans https://). */
export function resolveAppUrl(fallback = "http://localhost:3000"): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function resolveMetadataBase(): URL {
  try {
    return new URL(resolveAppUrl());
  } catch {
    return new URL("http://localhost:3000");
  }
}
