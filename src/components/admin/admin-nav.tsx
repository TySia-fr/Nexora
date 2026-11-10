"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** 16px line icons drawn on a 24-unit grid, stroke only, so they follow the text colour. */
const icon = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    aria-hidden="true"
  >
    {d}
  </svg>
);

const icons = {
  dashboard: icon(<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />),
  orders: icon(<path d="M5 4h14l-1 16H6L5 4zm4 4a3 3 0 0 0 6 0" />),
  customers: icon(<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />),
  products: icon(<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 0v18M4 7.5l8 4.5 8-4.5" />),
  categories: icon(<path d="M4 6h16M4 12h16M4 18h10" />),
  reviews: icon(<path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.6-.8L12 4z" />),
  coupons: icon(<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7zm10 0v10" />),
  inventory: icon(<path d="M3 9l9-5 9 5v10H3V9zm5 10v-6h8v6" />),
  counts: icon(<path d="M9 5H6v15h12V5h-3M9 3h6v4H9zM9 12l2 2 4-4" />),
  analytics: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
};

const groups: { label: string; items: [string, string, keyof typeof icons][] }[] = [
  {
    label: "Sales",
    items: [
      ["Dashboard", "/admin", "dashboard"],
      ["Orders", "/admin/orders", "orders"],
      ["Customers", "/admin/customers", "customers"],
    ],
  },
  {
    label: "Catalogue",
    items: [
      ["Products", "/admin/products", "products"],
      ["Categories", "/admin/categories", "categories"],
      ["Reviews", "/admin/reviews", "reviews"],
      ["Coupons", "/admin/coupons", "coupons"],
    ],
  },
  {
    label: "Stock",
    items: [
      ["Inventory", "/admin/inventory", "inventory"],
      ["Stock counts", "/admin/inventory/counts", "counts"],
    ],
  },
  { label: "Insights", items: [["Analytics", "/admin/analytics", "analytics"]] },
];

const allHrefs = groups.flatMap((g) => g.items.map(([, href]) => href));

/** The most specific nav entry matching the path is the current one. */
function currentHref(path: string): string | undefined {
  return allHrefs
    .filter((href) => path === href || (href !== "/admin" && path.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

/** Reads the path, so it streams inside a Suspense boundary (see the admin layout). */
export function AdminNav() {
  return <AdminNavLinks current={currentHref(usePathname())} />;
}

/** The static nav, also used as the Suspense fallback before the path is known. */
export function AdminNavLinks({ current }: { current?: string }) {
  return (
    <div className="flex gap-6 overflow-x-auto lg:flex-col lg:overflow-visible">
      {groups.map((g) => (
        <div key={g.label} className="flex shrink-0 flex-col gap-1.5">
          <span className="label-mono hidden px-3 text-fg-subtle lg:block">{g.label}</span>
          <ul role="list" className="flex gap-1 text-sm lg:flex-col">
            {g.items.map(([label, href, key]) => {
              const active = href === current;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 whitespace-nowrap rounded-input px-3 py-2 transition-colors ${
                      active ? "bg-surface text-fg" : "text-fg-muted hover:bg-surface/60 hover:text-fg"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent"
                      />
                    )}
                    {icons[key]}
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
