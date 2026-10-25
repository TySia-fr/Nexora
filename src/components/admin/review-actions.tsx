"use client";

import { useState, useTransition } from "react";
import { moderateReviewAction } from "@/server/actions/admin";

export function ReviewActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (decision: "APPROVED" | "REJECTED") =>
    start(async () => {
      const r = await moderateReviewAction(id, decision);
      if (!r.ok) setError(r.message);
    });
  return (
    <div className="flex items-center gap-3 text-xs">
      {status !== "APPROVED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("APPROVED")}
          className="h-9 text-accent hover:underline"
        >
          Approve
        </button>
      )}
      {status !== "REJECTED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("REJECTED")}
          className="h-9 text-fg-muted hover:text-warn"
        >
          Reject
        </button>
      )}
      {error && (
        <span role="alert" className="text-warn">
          {error}
        </span>
      )}
    </div>
  );
}
