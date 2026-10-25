"use client";

import { useActionState } from "react";
import { subscribeAction, type NewsletterState } from "@/server/actions/newsletter";
import { inputClasses } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeAction, null);
  const error = state && !state.ok ? state.message : null;
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <label htmlFor="newsletter-email" className="label-mono text-fog">
        Email address
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(error)}
          aria-describedby="newsletter-status"
          className={cn(inputClasses, "h-13 min-w-0 flex-1 basis-56")}
        />
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("inverse", "md", "h-13 rounded-input")}
        >
          {pending ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      <p
        id="newsletter-status"
        role="status"
        className={cn("min-h-5 text-[13px]", error ? "text-amber" : "text-signal")}
      >
        {error ?? (state?.ok ? "Thanks — you're on the list for the next launch." : "")}
      </p>
    </form>
  );
}
