"use client";

import { useActionState, useTransition } from "react";
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  type FormState,
} from "@/server/actions/account";
import { Field, Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

type Address = {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  isDefault: boolean;
};

function AddressCard({ a }: { a: Address }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line p-5" aria-busy={pending}>
      <address className="text-sm leading-relaxed not-italic text-mist">
        <span className="text-paper">{a.fullName}</span>
        <br />
        {a.line1}
        {a.line2 && (
          <>
            <br />
            {a.line2}
          </>
        )}
        <br />
        {a.postalCode} {a.city}, {a.country}
      </address>
      <div className="flex flex-wrap items-center gap-4 text-[13px]">
        {a.isDefault ? (
          <span className="label-mono text-signal">Default</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => void (await setDefaultAddressAction(a.id)))}
            className="h-9 text-ash hover:text-paper"
          >
            Make default
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await deleteAddressAction(a.id)))}
          className="h-9 text-ash hover:text-amber"
        >
          Delete<span className="sr-only"> address for {a.fullName}</span>
        </button>
      </div>
    </li>
  );
}

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addAddressAction, null);
  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const err = (k: string) => fe[k];

  return (
    <div className="flex flex-col gap-12">
      {addresses.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2" role="list">
          {addresses.map((a) => (
            <AddressCard key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ash">No saved addresses yet. Saved addresses pre-fill checkout.</p>
      )}

      <form
        action={action}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
        key={state?.ok ? "reset" : "form"}
      >
        <h2 className="text-xl font-semibold sm:col-span-2">Add an address</h2>
        {state && !state.ok && !state.fieldErrors && (
          <p role="alert" className="text-sm text-amber sm:col-span-2">
            {state.message}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-sm text-signal sm:col-span-2">
            Address saved.
          </p>
        )}
        {(
          [
            ["fullName", "Full name", "name", true],
            ["line1", "Address", "address-line1", true],
            ["line2", "Apartment, building (optional)", "address-line2", true],
            ["postalCode", "Postal code", "postal-code", false],
            ["city", "City", "address-level2", false],
            ["phone", "Phone (optional)", "tel", true],
          ] as const
        ).map(([name, label, ac, wide]) => (
          <div key={name} className={wide ? "sm:col-span-2" : undefined}>
            <Field id={`addr-${name}`} label={label} error={err(name)}>
              <Input id={`addr-${name}`} name={name} autoComplete={ac} aria-invalid={Boolean(err(name))} />
            </Field>
          </div>
        ))}
        <label className="flex items-center gap-2.5 text-sm sm:col-span-2">
          <input type="checkbox" name="isDefault" className="size-4 accent-signal" /> Use as default
        </label>
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("inverse", "md", "justify-self-start")}
        >
          {pending ? "Saving…" : "Save address"}
        </button>
      </form>
    </div>
  );
}
