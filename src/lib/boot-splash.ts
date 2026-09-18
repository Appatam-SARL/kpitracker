/** Masque le splash HTML du layout sans le retirer du DOM (évite les crashs React). */
export function hideBootSplash(): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('crm-boot-splash');
  if (!el || el.dataset.hidden === '1') return;

  el.dataset.hidden = '1';
  el.style.transition = 'opacity 200ms ease';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.setAttribute('aria-hidden', 'true');

  window.setTimeout(() => {
    if (el.isConnected) {
      el.style.display = 'none';
    }
  }, 200);
}
