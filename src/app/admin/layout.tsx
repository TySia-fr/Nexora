import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · NEXORA" },
  robots: { index: false, follow: false },
};

const nav = [
  ["Dashboard", "/admin"],
  ["Orders", "/admin/orders"],
  ["Products", "/admin/products"],
  ["Categories", "/admin/categories"],
  ["Coupons", "/admin/coupons"],
  ["Reviews", "/admin/reviews"],
  ["Customers", "/admin/customers"],
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-wrap">
      <nav aria-label="Admin" className="flex w-full flex-col gap-6 border-line p-6 lg:w-60 lg:border-r">
        <div className="flex items-baseline justify-between lg:flex-col lg:gap-1">
          <Link href="/" className="font-bold tracking-[0.18em]">
            NEXORA
          </Link>
          <span className="label-mono text-signal">Admin</span>
        </div>
        <ul className="flex flex-wrap gap-1 text-sm lg:flex-col" role="list">
          {nav.map(([label, href]) => (
            <li key={href}>
              <Link
                href={href}
                className="block rounded-input px-3 py-2.5 text-mist hover:bg-graphite hover:text-paper"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main" className="min-w-0 flex-[999_1_720px] p-6 lg:p-10">
        {/* Each page checks the admin role itself (see AdminGuard). */}
        {children}
      </main>
    </div>
  );
}
