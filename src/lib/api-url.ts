/**
 * Préfixe optionnel pour déploiement en sous-dossier (cPanel).
 * Définir NEXT_PUBLIC_BASE_PATH=/mon-dossier dans .env si l'app n'est pas à la racine du domaine.
 */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  if (!raw || raw === '/') return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

/** Construit l'URL d'une route API côté navigateur ou serveur. */
export function apiUrl(path: string): string {
  const base = getBasePath();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
