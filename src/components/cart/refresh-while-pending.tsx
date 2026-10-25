"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-reads the order a few times while Stripe's webhook is on its way. */
export function RefreshWhilePending({ maxAttempts = 10, intervalMs = 3000 }) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt >= maxAttempts) return;
    const t = setTimeout(() => {
      router.refresh();
      setAttempt((a) => a + 1);
    }, intervalMs);
    return () => clearTimeout(t);
  }, [attempt, maxAttempts, intervalMs, router]);
  return null;
}
