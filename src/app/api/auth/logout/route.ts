import { getCurrentUser } from '@/lib/auth';
import { logUserAction, USER_ACTION_CODES } from '@/lib/user-action-log';
import { NextResponse } from "next/server";

/** POST /api/auth/logout - Supprime le cookie de session */
export async function POST() {
  const user = await getCurrentUser();
  if (user) {
    await logUserAction({
      user,
      action: USER_ACTION_CODES.AUTH_LOGOUT,
      summary: 'Déconnexion du CRM',
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("auth_role", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set("must_change_password", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
