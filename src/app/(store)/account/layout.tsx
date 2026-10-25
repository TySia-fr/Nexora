import type { Metadata } from "next";
import Link from "next/link";
import { signOutAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

const links = [
  ["Overview", "/account"],
  ["Orders", "/account/orders"],
  ["Wishlist", "/account/wishlist"],
  ["Addresses", "/account/addresses"],
] as const;

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="container-site flex flex-wrap gap-x-14 gap-y-8 py-12">
      <nav aria-label="Account" className="flex w-full flex-row flex-wrap gap-2 lg:w-52 lg:flex-col lg:gap-1">
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-input px-3 py-2.5 text-sm text-fg-muted hover:bg-surface hover:text-fg"
          >
            {label}
          </Link>
        ))}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-input px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-surface hover:text-fg"
          >
            Sign out
          </button>
        </form>
      </nav>
      <div className="min-w-0 flex-[999_1_560px]">{children}</div>
    </div>
  );
}
