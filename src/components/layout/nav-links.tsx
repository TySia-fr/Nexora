"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Fixed-size dot that pulses only while this link's navigation is actually pending. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute top-2.5 right-1 size-1 rounded-full bg-signal opacity-0 transition-opacity duration-150",
        pending && "animate-blink opacity-100",
      )}
    />
  );
}

/** Desktop category links with a hairline under the active section. */
export function NavLinks({ categories }: { categories: { slug: string; name: string }[] }) {
  const pathname = usePathname();
  const items = [
    { href: "/products", name: "Shop all" },
    ...categories.map((c) => ({ href: `/categories/${c.slug}`, name: c.name })),
  ];
  return (
    <ul className="hidden flex-1 items-center justify-center gap-1 text-[13px] lg:flex" role="list">
      {items.map((item) => {
        // "Shop all" is the listing itself, not every product page under /products/.
        const active = item.href === "/products" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center px-3 text-fg-muted transition-colors duration-150 hover:text-fg",
                active && "text-fg",
              )}
            >
              {item.name}
              <PendingDot />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-3 bottom-2 h-px origin-left scale-x-0 bg-fg transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-x-100",
                  active && "scale-x-100",
                )}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
