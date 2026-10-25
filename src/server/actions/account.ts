"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { auth } from "@/server/auth";
import { addAddress, deleteAddress, setDefaultAddress } from "@/server/account";
import { getViewer } from "@/server/session";
import { enforceRateLimit } from "@/server/rate-limit";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { passwordSchema } from "@/lib/validation/auth";
import { fieldErrors } from "@/lib/validation/checkout";

export type FormState = ActionResult | null;

async function viewerOrThrow() {
  const viewer = await getViewer();
  if (!viewer) throw new AppError("UNAUTHENTICATED", "Please sign in again.");
  return viewer;
}

export async function updateNameAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await viewerOrThrow();
    const name = z.string().trim().min(1, "Enter your name.").max(100).safeParse(form.get("name"));
    if (!name.success)
      throw new AppError("VALIDATION", name.error.issues[0]!.message, {
        fieldErrors: { name: name.error.issues[0]!.message },
      });
    await auth.api.updateUser({ body: { name: name.data }, headers: await headers() });
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await enforceRateLimit("change-password", 5, 5 * 60_000);
    await viewerOrThrow();
    const parsed = z
      .object({
        current: z.string().min(1, "Enter your current password."),
        password: passwordSchema,
        confirm: z.string(),
      })
      .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." })
      .safeParse({
        current: form.get("current"),
        password: form.get("password"),
        confirm: form.get("confirm"),
      });
    if (!parsed.success)
      throw new AppError("VALIDATION", "Check the highlighted fields.", {
        fieldErrors: fieldErrors(parsed.error),
      });
    const ok = await auth.api
      .changePassword({
        body: {
          currentPassword: parsed.data.current,
          newPassword: parsed.data.password,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      })
      .then(() => true)
      .catch(() => false);
    if (!ok)
      throw new AppError("VALIDATION", "Current password is incorrect.", {
        fieldErrors: { current: "Current password is incorrect." },
      });
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const viewer = await viewerOrThrow();
    await addAddress(
      viewer.id,
      {
        fullName: form.get("fullName"),
        line1: form.get("line1"),
        line2: form.get("line2") ?? undefined,
        postalCode: form.get("postalCode"),
        city: form.get("city"),
        country: "FR",
        phone: form.get("phone") ?? undefined,
      },
      form.get("isDefault") === "on",
    );
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  try {
    const viewer = await viewerOrThrow();
    await deleteAddress(viewer.id, z.string().max(64).parse(id));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult> {
  try {
    const viewer = await viewerOrThrow();
    await setDefaultAddress(viewer.id, z.string().max(64).parse(id));
    refresh();
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
