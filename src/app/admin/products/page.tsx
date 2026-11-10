import { listProductsAdmin, PRODUCT_SORTS, type ProductSort } from "@/server/admin";
import { ProductTable } from "@/components/admin/product-table";
import { AdminHeader, Pager, pageParam, strParam } from "@/components/admin/ui";
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
  const so = strParam(sp.sort);
  const sort = (Object.keys(PRODUCT_SORTS) as ProductSort[]).find((x) => x === so) ?? "updated";
  const page = pageParam(sp.page);
  const { products, total, pageCount } = await listProductsAdmin({ q, status, sort, page });
  const href = (p: number) =>
    `/admin/products?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(sort !== "updated" ? { sort } : {}),
      page: String(p),
    })}`;

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
        <p role="status" className="mb-4 text-sm text-accent">
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
        <label htmlFor="sort" className="sr-only">
          Sort
        </label>
        <select id="sort" name="sort" defaultValue={sort} className={`${inputBase} h-11`}>
          <option value="updated">Recently updated</option>
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
        </select>
        <button type="submit" className={buttonClasses("secondary", "sm", "rounded-input")}>
          Filter
        </button>
      </form>
      <ProductTable
        rows={products.map((p) => {
          const active = p.variants.filter((v) => v.isActive);
          const from = active.length ? Math.min(...active.map((v) => v.priceCents)) : null;
          return {
            id: p.id,
            name: p.name,
            featured: p.featured,
            category: p.category.name,
            status: p.status,
            variants: active.length,
            stock: active.reduce((n, v) => n + v.stock, 0),
            from: from === null ? "—" : formatMoney(from),
            image: p.images[0] ?? null,
          };
        })}
      />
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
