"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestResetAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

function useErrors(state: AuthState) {
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const banner = state && !state.ok && Object.keys(fe).length === 0 ? state.message : null;
  return { fe, banner };
}

function Banner({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-card border border-warn/60 p-3.5 text-sm text-warn">
      {text}
    </p>
  ) : null;
}

function TextField({
  name,
  label,
  error,
  ...props
}: { name: string; label: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <Field id={name} label={label} error={error}>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
    </Field>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signInAction, null);
  const { fe, banner } = useErrors(state);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Banner text={banner} />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state?.email}
        error={fe.email}
        required
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={fe.password}
        required
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <Link
        href="/forgot-password"
        className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUpAction, null);
  const { fe, banner } = useErrors(state);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />
      <Banner text={banner} />
      <TextField
        name="name"
        label="Name"
        autoComplete="name"
        defaultValue={state?.name}
        error={fe.name}
        required
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        defaultValue={state?.email}
        error={fe.email}
        required
      />
      <TextField
        name="password"
        label="Password (10+ characters)"
        type="password"
        autoComplete="new-password"
        error={fe.password}
        required
        minLength={10}
      />
      <TextField
        name="confirm"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={fe.confirm}
        required
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestResetAction, null);
  if (state?.ok) {
    return (
      <p role="status" className="rounded-card border border-line-strong p-4 text-sm text-fg-muted">
        If an account exists for that address, a reset link is on its way. It expires in 30 minutes.
      </p>
    );
  }
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {!emailEnabled && (
        <p role="note" className="rounded-card border border-warn/60 p-3.5 text-sm text-warn">
          Email delivery isn&apos;t configured on this deployment, so reset links can&apos;t be sent yet.
        </p>
      )}
      <Banner text={state && !state.ok ? state.message : null} />
      <TextField name="email" label="Email" type="email" autoComplete="email" required />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPasswordAction, null);
  const { fe, banner } = useErrors(state);
  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <Banner text={banner ?? (fe.token ? "This reset link is invalid. Request a new one." : null)} />
      <TextField
        name="password"
        label="New password (10+ characters)"
        type="password"
        autoComplete="new-password"
        error={fe.password}
        required
      />
      <TextField
        name="confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={fe.confirm}
        required
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
