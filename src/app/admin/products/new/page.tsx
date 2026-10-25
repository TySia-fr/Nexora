import { listCategoriesAdmin } from "@/server/admin";
import { AdminHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "New product" };

async function NewProductContent() {
  const categories = await listCategoriesAdmin();
  return (
    <>
      <AdminHeader title="New product" meta="Products" />
      <ProductForm
        categories={categories}
        initial={{
          name: "",
          slug: "",
          tagline: "",
          description: "",
          categoryId: "",
          status: "DRAFT",
          featured: false,
          specs: "",
          features: "",
          variants: [],
        }}
      />
    </>
  );
}

export default function NewProduct() {
  return (
    <AdminGuard>
      <NewProductContent />
    </AdminGuard>
  );
}
