import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductAdmin, listCategoriesAdmin } from "@/server/admin";
import { AdminHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { AdminGuard } from "@/components/admin/admin-guard";

const pairs = (value: unknown, a: string, b: string) =>
  Array.isArray(value)
    ? value.map((x: Record<string, unknown>) => `${String(x[a] ?? "")}: ${String(x[b] ?? "")}`).join("\n")
    : "";

async function EditProductContent({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProductAdmin(id), listCategoriesAdmin()]);
  if (!product) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <>
      <AdminHeader
        title={product.name}
        meta={`Product · ${product.status.toLowerCase()}`}
        action={
          product.status === "ACTIVE" ? (
            <Link href={`/products/${product.slug}`} className="text-sm text-ash hover:text-signal">
              View in store →
            </Link>
          ) : undefined
        }
      />
      {saved && (
        <p role="status" className="mb-6 text-sm text-signal">
          Saved. The storefront updates on the next request.
        </p>
      )}
      <ProductForm
        key={product.updatedAt.toISOString()}
        categories={categories}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          tagline: product.tagline,
          description: product.description,
          categoryId: product.categoryId,
          status: product.status,
          featured: product.featured,
          specs: pairs(product.specs, "label", "value"),
          features: pairs(product.features, "title", "body"),
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            colorHex: v.colorHex ?? "",
            price: (v.priceCents / 100).toFixed(2),
            stock: String(v.stock),
            isActive: v.isActive,
          })),
        }}
      />
      <p className="mt-8 text-xs text-fog">
        Images are generated from the catalog definition (scripts/render/render-products.ts). Image upload is
        not implemented.
      </p>
    </>
  );
}

export default function EditProduct(props: PageProps<"/admin/products/[id]">) {
  return (
    <AdminGuard>
      <EditProductContent {...props} />
    </AdminGuard>
  );
}
