import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Search, User } from "lucide-react";
import { getCategories } from "@/server/catalog";
import { getCartOwner } from "@/server/session";
import { getCartItemCount } from "@/server/cart";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CartLink } from "@/components/layout/cart-link";
import { NavLinks } from "@/components/layout/nav-links";
import { LogoMark, Wordmark } from "@/components/brand/logo";

async function CategoryNav() {
  await connection();
  const categories = (await getCategories()).map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <>
      <NavLinks categories={categories} />
      <MobileNav categories={categories} />
    </>
  );
}

async function CartCount() {
  const owner = await getCartOwner();
  const count = owner ? await getCartItemCount(owner) : 0;
  return <CartLink count={count} />;
}

const iconLink =
  "flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors duration-150 hover:bg-well hover:text-fg";

export function SiteHeader() {
  return (
    <header className="header-enter sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md backdrop-saturate-150">
      <nav aria-label="Main" className="container-site flex h-16 items-center gap-2 sm:gap-4">
        <Link
          href="/"
          className="logo-link -ml-1 flex h-11 items-center gap-2.5 px-1"
          aria-label="NEXORA home"
        >
          <LogoMark className="size-[22px]" />
          {/* Below 360 px the mark alone carries the brand; the link keeps its label. */}
          <Wordmark className="logo-word max-[359px]:hidden" />
        </Link>
        <Suspense fallback={<div className="hidden flex-1 lg:block" />}>
          <CategoryNav />
        </Suspense>
        <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
          <Link href="/search" aria-label="Search" className={iconLink}>
            <Search className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Link href="/account" aria-label="Account" className={`${iconLink} hidden sm:flex`}>
            <User className="size-[18px]" strokeWidth={1.6} aria-hidden="true" />
          </Link>
          <Suspense fallback={<CartLink count={null} />}>
            <CartCount />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}
