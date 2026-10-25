"use client";

import { useActionState } from "react";
import { changePasswordAction, updateNameAction, type FormState } from "@/server/actions/account";
import { Field, Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

function Status({ state, success }: { state: FormState; success: string }) {
  if (!state) return null;
  return (
    <p role="status" className={state.ok ? "text-[13px] text-signal" : "text-[13px] text-amber"}>
      {state.ok ? success : state.fieldErrors ? "" : state.message}
    </p>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNameAction, null);
  const err = state && !state.ok ? state.fieldErrors?.name : undefined;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="name" label="Name" error={err}>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" aria-invalid={Boolean(err)} />
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
          Save name
        </button>
        <Status state={state} success="Saved." />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field id="current" label="Current password" error={fe.current}>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(fe.current)}
        />
      </Field>
      <Field id="password" label="New password (10+ characters)" error={fe.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(fe.password)}
        />
      </Field>
      <Field id="confirm" label="Confirm new password" error={fe.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(fe.confirm)}
        />
      </Field>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
          Change password
        </button>
        <Status state={state} success="Password changed. Other devices were signed out." />
      </div>
    </form>
  );
}
