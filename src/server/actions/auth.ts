"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { mergeGuestCart } from "@/server/cart";
import { clearGuestToken, getGuestToken } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { fieldErrors } from "@/lib/validation/checkout";
import { resetSchema, safeRedirectPath, signInSchema, signUpSchema } from "@/lib/validation/auth";

export type AuthState = (ActionResult & { email?: string; name?: string }) | null;

async function afterSignIn(userId: string) {
  const token = await getGuestToken();
  if (token) {
    await mergeGuestCart(token, userId);
    await clearGuestToken();
  }
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  let destination: string;
  try {
    await enforceRateLimit("sign-in", 5, 60_000);
    const parsed = signInSchema.safeParse({ email, password: form.get("password") });
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Check the highlighted fields.", {
        fieldErrors: fieldErrors(parsed.error),
      });
    }
    const result = await auth.api
      .signInEmail({ body: parsed.data, headers: await headers() })
      .catch(() => null);
    // One message for unknown email and wrong password: no account enumeration.
    if (!result) throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.");
    await afterSignIn(result.user.id);
    destination = safeRedirectPath(form.get("next"));
  } catch (e) {
    return { ...toActionError(e), email };
  }
  redirect(destination);
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "");
  const name = String(form.get("name") ?? "");
  let destination: string;
  try {
    await enforceRateLimit("sign-up", 3, 60_000);
    const parsed = signUpSchema.safeParse({
      name,
      email,
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Check the highlighted fields.", {
        fieldErrors: fieldErrors(parsed.error),
      });
    }
    // Only name, email and password are passed on: `role` can't be set here.
    const result = await auth.api
      .signUpEmail({
        body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
        headers: await headers(),
      })
      .catch(() => null);
    if (!result) {
      throw new AppError(
        "CONFLICT",
        "We couldn't create an account with these details. If you already have one, sign in or reset your password.",
      );
    }
    await afterSignIn(result.user.id);
    destination = safeRedirectPath(form.get("next"));
  } catch (e) {
    return { ...toActionError(e), email, name };
  }
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function requestResetAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  try {
    await enforceRateLimit("reset-request", 3, 5 * 60_000);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (email) {
      await auth.api
        .requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() })
        .catch((e: unknown) => console.error("[nexora] reset request failed", e));
    }
    // Same answer whether or not the account exists.
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resetPasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  try {
    await enforceRateLimit("reset", 5, 5 * 60_000);
    const parsed = resetSchema.safeParse({
      token: form.get("token"),
      password: form.get("password"),
      confirm: form.get("confirm"),
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION", "Check the highlighted fields.", {
        fieldErrors: fieldErrors(parsed.error),
      });
    }
    const ok = await auth.api
      .resetPassword({
        body: { token: parsed.data.token, newPassword: parsed.data.password },
        headers: await headers(),
      })
      .then(() => true)
      .catch(() => false);
    if (!ok)
      throw new AppError("VALIDATION", "This reset link is invalid or has expired. Request a new one.");
  } catch (e) {
    return toActionError(e);
  }
  redirect("/sign-in?reset=1");
}
