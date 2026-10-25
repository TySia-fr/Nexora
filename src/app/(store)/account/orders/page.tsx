import Link from "next/link";
import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { formatOrderNumber, listOrdersForUser } from "@/server/orders";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

async function Orders({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const viewer = await requireViewer("/account/orders");
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isInteger(raw) && raw > 0 && raw < 1000 ? raw : 1;
  const { orders, pageCount } = await listOrdersForUser(viewer.id, page, 10);

  if (orders.length === 0) {
    return <p className="text-ash">You haven&apos;t placed any orders yet.</p>;
  }
  return (
    <>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="label-mono text-left text-fog">
              <th className="p-4 font-normal">Order</th>
              <th className="p-4 font-normal">Date</th>
              <th className="p-4 font-normal">Items</th>
              <th className="p-4 font-normal">Status</th>
              <th className="p-4 text-right font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="p-4">
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="font-mono underline-offset-4 hover:text-signal hover:underline"
                  >
                    {formatOrderNumber(o.number)}
                  </Link>
                </td>
                <td className="p-4 text-ash">{o.createdAt.toLocaleDateString("en-GB")}</td>
                <td className="p-4 text-ash">{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
                <td className="p-4">
                  <StatusBadge status={o.status} />
                </td>
                <td className="p-4 text-right font-mono">{formatMoney(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex justify-between">
          {page > 1 ? (
            <Link href={`?page=${page - 1}`} className={buttonClasses("secondary", "sm")}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {page < pageCount ? (
            <Link href={`?page=${page + 1}`} className={buttonClasses("secondary", "sm")}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/account/orders">) {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">Orders</h1>
      <Suspense fallback={<div className="h-60 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
