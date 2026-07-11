import { apiUrl } from '@/lib/api-url';

/** fetch() vers l'API avec basePath et cookies (prod cPanel / sous-dossier). */
export function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
  });
}

/** Message d'erreur lisible quand l'API ne renvoie pas de JSON (souvent cPanel / proxy). */
export async function readApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  const text = await res.text();
  if (text) {
    try {
      const data = JSON.parse(text) as { error?: string };
      if (data.error) return data.error;
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        if (res.status === 404) {
          return "API introuvable (404). Vérifiez que l'application Node.js est démarrée sur cPanel.";
        }
        if (res.status === 502 || res.status === 503) {
          return "Serveur indisponible. Redémarrez l'application Node.js dans cPanel.";
        }
        return `Réponse serveur invalide (HTTP ${res.status}). Consultez les logs Node.js.`;
      }
      if (text.length < 200) return text;
    }
  }

  if (res.status === 404) {
    return 'API introuvable. Vérifiez le déploiement Node.js (server.js) sur cPanel.';
  }
  if (res.status >= 500) {
    return 'Erreur serveur. Testez /api/health puis consultez les logs cPanel.';
  }

  return fallback;
}
