import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { requireAdminPage } from "@/server/session";

/**
 * Every admin page renders through this guard. Layouts are not enough: they
 * don't re-render on client navigation, and each page segment is prerendered
 * on its own, so the role check has to live in the page.
 */
async function Guard({ children }: { children: ReactNode }) {
  await connection();
  await requireAdminPage();
  return <>{children}</>;
}

export function AdminGuard({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}
