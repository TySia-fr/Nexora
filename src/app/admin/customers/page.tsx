import Link from "next/link";
import { searchCustomers } from "@/server/admin";
import { AdminHeader, Pager, TableBox, pageParam, strParam, td, th } from "@/components/admin/ui";
import { inputBase } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Customers" };

async function AdminCustomersContent({ searchParams }: PageProps<"/admin/customers">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { customers, total, pageCount } = await searchCustomers(q, page);
  return (
    <>
      <AdminHeader title="Customers" meta={`${total} accounts`} />
      <form method="get" className="mb-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search customers
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name or email"
          className={`${inputBase} h-11 w-72`}
        />
        <button type="submit" className={buttonClasses("secondary", "sm", "rounded-input")}>
          Search
        </button>
      </form>
      <TableBox>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Email</th>
              <th className={th}>Joined</th>
              <th className={th}>Orders</th>
              <th className={`${th} text-right`}>Paid total</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td className={td} colSpan={5}>
                  No customers match.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id}>
                <td className={td}>
                  {c.name}
                  {c.role === "ADMIN" && <span className="label-mono ml-2 text-signal">admin</span>}
                </td>
                <td className={`${td} text-ash`}>{c.email}</td>
                <td className={`${td} text-ash`}>{c.createdAt.toLocaleDateString("en-GB")}</td>
                <td className={td}>
                  {c._count.orders > 0 ? (
                    <Link
                      href={`/admin/orders?q=${encodeURIComponent(c.email)}`}
                      className="hover:text-signal"
                    >
                      {c._count.orders}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td className={`${td} text-right font-mono`}>{formatMoney(c.paidCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableBox>
      <Pager
        page={page}
        pageCount={pageCount}
        href={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
      />
    </>
  );
}

export default function AdminCustomers(props: PageProps<"/admin/customers">) {
  return (
    <AdminGuard>
      <AdminCustomersContent {...props} />
    </AdminGuard>
  );
}
