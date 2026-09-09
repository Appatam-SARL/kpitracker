import { GROUP_SCOPE_ROLES } from '@/lib/group-scope-roles';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ROLES_ADMIN_MANAGER_PAGES = new Set<string>([
  'ADMIN',
  'MANAGER',
  ...GROUP_SCOPE_ROLES,
]);

const AUTH_COOKIE = 'auth_session';
const AUTH_ROLE_COOKIE = 'auth_role';
const MUST_CHANGE_PASSWORD_COOKIE = 'must_change_password';

/** Routes accessibles sans connexion */
const PUBLIC_PATHS = ['/login', '/login/mfa', '/forgot-password', '/reset-password'];

/** Pages réservées à ADMIN et MANAGER (AGENT refusé selon roles-and-permissions) */
const ADMIN_OR_MANAGER_PATHS = ['/users', '/settings', '/products-services', '/corbeille'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAdminOrManagerOnlyPath(pathname: string): boolean {
  return ADMIN_OR_MANAGER_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Redirection compatible reverse proxy cPanel (évite new URL(..., request.url) invalide). */
function redirectTo(request: NextRequest, pathname: string, search?: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search ?? '';
  return NextResponse.redirect(url);
}

function runMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasAuth = request.cookies.has(AUTH_COOKIE);
  const role = request.cookies.get(AUTH_ROLE_COOKIE)?.value;
  const mustChangePassword =
    request.cookies.get(MUST_CHANGE_PASSWORD_COOKIE)?.value === '1';

  // Fichiers statiques et API exclues
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    if (
      mustChangePassword &&
      pathname !== '/api/profile/password' &&
      pathname !== '/api/auth/logout' &&
      pathname !== '/api/forgot-password' &&
      pathname !== '/api/reset-password'
    ) {
      return NextResponse.json(
        { error: 'Changement de mot de passe requis' },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const isTokenResetPath = pathname === '/reset-password/confirm';

  if (hasAuth && mustChangePassword) {
    if (pathname !== '/reset-password' && !isTokenResetPath) {
      return redirectTo(request, '/reset-password');
    }
    return NextResponse.next();
  }

  // Déjà connecté ET sur une page publique → redirection vers le dashboard
  // (sauf le lien e-mail de réinitialisation, utilisable même si une session existe)
  if (hasAuth && isPublicPath(pathname) && !isTokenResetPath) {
    return redirectTo(request, '/');
  }

  // Non connecté ET page protégée → redirection vers login
  if (!hasAuth && !isPublicPath(pathname)) {
    const from = pathname + request.nextUrl.search;
    return redirectTo(
      request,
      '/login',
      from ? `?from=${encodeURIComponent(from)}` : '',
    );
  }

  // Pages Utilisateurs / Paramètres : ADMIN, MANAGER et rôles groupe (pas AGENT)
  if (hasAuth && isAdminOrManagerOnlyPath(pathname)) {
    if (role && !ROLES_ADMIN_MANAGER_PAGES.has(role)) {
      return redirectTo(request, '/');
    }
  }

  return NextResponse.next();
}

export function middleware(request: NextRequest) {
  try {
    return runMiddleware(request);
  } catch (err) {
    console.error('[middleware] erreur', err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};