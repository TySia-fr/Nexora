import Link from "next/link";
import { listOrders } from "@/server/admin";
import { formatOrderNumber } from "@/server/orders";
import { AdminHeader, Pager, TableBox, pageParam, strParam, td, th } from "@/components/admin/ui";
import { StatusBadge, STATUS_LABEL } from "@/components/ui/status-badge";
import { inputBase } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/generated/prisma/enums";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Orders" };

async function AdminOrdersContent({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams;
  const statusRaw = strParam(sp.status);
  const status = statusRaw && statusRaw in STATUS_LABEL ? (statusRaw as OrderStatus) : undefined;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { orders, total, pageCount } = await listOrders({ status, q, page });
  const href = (p: number) =>
    `/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <AdminHeader title="Orders" meta={`${total} orders`} />
      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Search orders
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Email, name or NX-number"
          className={`${inputBase} h-11 w-72`}
        />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={`${inputBase} h-11`}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary", "sm", "rounded-input")}>
          Filter
        </button>
      </form>
      <TableBox>
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Date</th>
              <th className={th}>Customer</th>
              <th className={th}>Items</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td className={td} colSpan={6}>
                  No orders match.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className={td}>
                  <Link href={`/admin/orders/${o.id}`} className="font-mono hover:text-signal">
                    {formatOrderNumber(o.number)}
                  </Link>
                </td>
                <td className={`${td} text-ash`}>
                  {o.createdAt.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className={td}>
                  {o.shipFullName}
                  <br />
                  <span className="text-xs text-fog">{o.email}</span>
                </td>
                <td className={`${td} text-ash`}>{o._count.items}</td>
                <td className={td}>
                  <StatusBadge status={o.status} />
                </td>
                <td className={`${td} text-right font-mono`}>{formatMoney(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
      <Pager page={page} pageCount={pageCount} href={href} />
    </>
  );
}

export default function AdminOrders(props: PageProps<"/admin/orders">) {
  return (
    <AdminGuard>
      <AdminOrdersContent {...props} />
    </AdminGuard>
  );
}
