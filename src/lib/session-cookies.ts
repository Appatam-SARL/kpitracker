/**
 * Cookies de session compatibles cPanel (HTTPS terminé au reverse proxy).
 * COOKIE_SECURE=0 force secure:false si le site est encore en HTTP.
 */
export function sessionCookieOptions(maxAgeSeconds: number) {
  const forceInsecure = process.env.COOKIE_SECURE === '0';
  const secure =
    !forceInsecure &&
    (process.env.COOKIE_SECURE === '1' ||
      process.env.NODE_ENV === 'production');

  return {
    httpOnly: true as const,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
