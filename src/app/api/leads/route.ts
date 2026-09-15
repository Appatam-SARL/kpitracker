/**
 * Compatibilité : /api/leads délègue au pool prospects entreprise GROUP.
 * Préférez /api/prospects pour les nouveaux appels.
 */
export { GET, POST } from '@/app/api/prospects/route';
