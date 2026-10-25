"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Shown when a server component throws. Never exposes the error message itself. */
export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-site flex flex-col items-start gap-6 py-28" role="alert">
      <span className="label-mono text-warn">Something went wrong</span>
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">We couldn&apos;t load this page.</h1>
      <p className="text-fg-muted">
        It&apos;s on our side. Try again in a moment.
        {error.digest && (
          <span className="mt-2 block font-mono text-xs text-fg-subtle">Reference: {error.digest}</span>
        )}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
