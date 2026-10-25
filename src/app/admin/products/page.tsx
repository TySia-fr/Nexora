import Link from "next/link";
import { listProductsAdmin } from "@/server/admin";
import { AdminHeader, Pager, TableBox, pageParam, strParam, td, th } from "@/components/admin/ui";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { inputBase } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import type { ProductStatus } from "@/generated/prisma/enums";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Products" };
const STATUSES: ProductStatus[] = ["ACTIVE", "DRAFT", "ARCHIVED"];

async function AdminProductsContent({ searchParams }: PageProps<"/admin/products">) {
  const sp = await searchParams;
  const q = strParam(sp.q);
  const s = strParam(sp.status);
  const status = STATUSES.find((x) => x === s);
  const page = pageParam(sp.page);
  const { products, total, pageCount } = await listProductsAdmin({ q, status, page });
  const href = (p: number) =>
    `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`;

  return (
    <>
      <AdminHeader
        title="Products"
        meta={`${total} products`}
        action={
          <ButtonLink href="/admin/products/new" variant="inverse" size="sm">
            New product
          </ButtonLink>
        }
      />
      {sp.deleted && (
        <p role="status" className="mb-4 text-sm text-signal">
          Product deleted.
        </p>
      )}
      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Search products
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name or SKU"
          className={`${inputBase} h-11 w-64`}
        />
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select id="status" name="status" defaultValue={status ?? ""} className={`${inputBase} h-11`}>
          <option value="">All statuses</option>
          {STATUSES.map((x) => (
            <option key={x} value={x}>
              {x.toLowerCase()}
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
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Status</th>
              <th className={th}>Variants</th>
              <th className={th}>Stock</th>
              <th className={`${th} text-right`}>From</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td className={td} colSpan={6}>
                  No products match.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const active = p.variants.filter((v) => v.isActive);
              const stock = active.reduce((n, v) => n + v.stock, 0);
              const from = active.length ? Math.min(...active.map((v) => v.priceCents)) : null;
              return (
                <tr key={p.id}>
                  <td className={td}>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-signal">
                      {p.name}
                    </Link>
                    {p.featured && <span className="label-mono ml-2 text-signal">featured</span>}
                  </td>
                  <td className={`${td} text-ash`}>{p.category.name}</td>
                  <td className={`${td} text-ash`}>{p.status.toLowerCase()}</td>
                  <td className={`${td} text-ash`}>{active.length}</td>
                  <td className={`${td} font-mono ${stock === 0 ? "text-amber" : ""}`}>{stock}</td>
                  <td className={`${td} text-right font-mono`}>{from === null ? "—" : formatMoney(from)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableBox>
      <Pager page={page} pageCount={pageCount} href={href} />
    </>
  );
}

export default function AdminProducts(props: PageProps<"/admin/products">) {
  return (
    <AdminGuard>
      <AdminProductsContent {...props} />
    </AdminGuard>
  );
}
