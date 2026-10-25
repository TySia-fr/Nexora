import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { env } from "@/lib/env";
import type { CartOwner } from "@/server/cart";

export const GUEST_CART_COOKIE = "nx_cart";
const GUEST_TOKEN = /^[0-9a-f-]{36}$/;

export type Viewer = { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" };

/** The signed-in user, re-read from the database (role is never taken from the cookie). */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  return user;
}

export async function requireViewer(returnTo: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return viewer;
}

/** For pages: redirects. Admin status is checked on every request, on the server. */
export async function requireAdminPage(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "ADMIN") redirect("/");
  return viewer;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("UNAUTHENTICATED", "Please sign in.");
  if (viewer.role !== "ADMIN") throw new AppError("FORBIDDEN", "You don't have access to this.");
  return viewer;
}

async function readGuestToken(): Promise<string | null> {
  const value = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  return value && GUEST_TOKEN.test(value) ? value : null;
}

/** Cart owner for reads. Returns null when the visitor has no cart yet. */
export async function getCartOwner(): Promise<CartOwner | null> {
  const viewer = await getViewer();
  if (viewer) return { userId: viewer.id };
  const token = await readGuestToken();
  return token ? { guestToken: token } : null;
}

/**
 * Cart owner for writes (server actions only): creates the guest cookie on
 * first use. The token is random and only identifies a cart; it grants no
 * access to anything else.
 */
export async function ensureCartOwner(): Promise<CartOwner> {
  const owner = await getCartOwner();
  if (owner) return owner;
  const token = crypto.randomUUID();
  (await cookies()).set(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return { guestToken: token };
}

export async function getGuestToken(): Promise<string | null> {
  return readGuestToken();
}

export async function clearGuestToken(): Promise<void> {
  (await cookies()).delete(GUEST_CART_COOKIE);
}
