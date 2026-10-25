import Link from "next/link";
import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { listOrdersForUser, formatOrderNumber } from "@/server/orders";
import { NameForm, PasswordForm } from "@/components/account/profile-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatMoney } from "@/lib/money";

async function Overview() {
  const viewer = await requireViewer("/account");
  const { orders } = await listOrdersForUser(viewer.id, 1, 3);
  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-col gap-2">
        <span className="label-mono text-fg-subtle">Signed in as {viewer.email}</span>
        <h1 className="text-display-m">Hello, {viewer.name.split(" ")[0]}.</h1>
      </header>

      <section aria-labelledby="recent-orders" className="flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <h2 id="recent-orders" className="text-xl font-semibold">
            Recent orders
          </h2>
          <Link href="/account/orders" className="text-sm text-fg-muted hover:text-accent">
            All orders →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No orders yet.{" "}
            <Link href="/products" className="text-fg underline underline-offset-4">
              Browse products
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line" role="list">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/account/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface"
                >
                  <span className="font-mono text-sm">{formatOrderNumber(o.number)}</span>
                  <StatusBadge status={o.status} />
                  <span className="text-sm text-fg-subtle">{o.createdAt.toLocaleDateString("en-GB")}</span>
                  <span className="font-mono text-sm">{formatMoney(o.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="profile" className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 id="profile" className="text-xl font-semibold">
            Profile
          </h2>
          <NameForm name={viewer.name} />
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Password</h2>
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-card bg-well" aria-busy="true" />}>
      <Overview />
    </Suspense>
  );
}
