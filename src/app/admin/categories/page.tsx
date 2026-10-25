import { listCategoriesAdmin } from "@/server/admin";
import { AdminHeader } from "@/components/admin/ui";
import { CategoryRow } from "@/components/admin/category-forms";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Categories" };

async function AdminCategoriesContent() {
  const categories = await listCategoriesAdmin();
  return (
    <>
      <AdminHeader title="Categories" meta={`${categories.length} categories`} />
      <p className="mb-4 text-sm text-fg-muted">A category can only be deleted once it has no products.</p>
      {categories.map((c) => (
        <CategoryRow
          key={`${c.id}-${c.updatedAt.toISOString()}`}
          category={{ ...c, productCount: c._count.products }}
        />
      ))}
      <h2 className="mt-10 mb-2 font-semibold">New category</h2>
      <CategoryRow category={{ name: "", slug: "", description: "", position: categories.length + 1 }} />
    </>
  );
}

export default function AdminCategories() {
  return (
    <AdminGuard>
      <AdminCategoriesContent />
    </AdminGuard>
  );
}
