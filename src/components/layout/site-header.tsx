import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Search, User } from "lucide-react";
import { getCategories } from "@/server/catalog";
import { getCartOwner } from "@/server/session";
import { getCartItemCount } from "@/server/cart";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CartLink } from "@/components/layout/cart-link";

async function CategoryNav() {
  await connection();
  const categories = await getCategories();
  return (
    <>
      <ul className="hidden flex-1 flex-wrap gap-7 text-sm text-fg-muted lg:flex" role="list">
        {categories.map((c) => (
          <li key={c.slug}>
            <Link href={`/categories/${c.slug}`} className="py-2 hover:text-fg">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
      <MobileNav categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />
    </>
  );
}

async function CartCount() {
  const owner = await getCartOwner();
  const count = owner ? await getCartItemCount(owner) : 0;
  return <CartLink count={count} />;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
      <nav aria-label="Main" className="container-site flex h-16 items-center gap-6 lg:gap-10">
        <Link href="/" className="text-lg font-bold tracking-[0.18em] md:text-xl" aria-label="NEXORA home">
          NEXORA
        </Link>
        <Suspense fallback={<div className="hidden flex-1 lg:block" />}>
          <CategoryNav />
        </Suspense>
        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link
            href="/search"
            aria-label="Search"
            className="flex size-11 items-center justify-center hover:text-accent"
          >
            <Search className="size-5" strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="hidden size-11 items-center justify-center hover:text-accent sm:flex"
          >
            <User className="size-5" strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Suspense fallback={<CartLink count={null} />}>
            <CartCount />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
