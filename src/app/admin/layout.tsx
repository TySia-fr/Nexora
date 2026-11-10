import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { Suspense } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · NEXORA" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="theme-dark min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-line bg-canvas lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <nav aria-label="Admin" className="flex h-full flex-col gap-6 p-4 lg:p-5">
          <div className="flex items-center justify-between px-1">
            <Link href="/admin" className="flex items-center gap-2.5" aria-label="NEXORA admin dashboard">
              <LogoMark className="size-5" />
              <Wordmark />
            </Link>
            <span className="label-mono rounded-full border border-line px-2 py-0.5 text-accent">Admin</span>
          </div>
          <Suspense fallback={<AdminNavLinks />}>
            <AdminNav />
          </Suspense>
          <Link
            href="/"
            className="mt-auto hidden items-center justify-between rounded-input border border-line px-3 py-2.5 text-sm text-fg-muted hover:text-fg lg:flex"
          >
            View storefront <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </aside>
      <main id="main" className="min-w-0 p-5 md:p-8 lg:p-10">
        <div className="mx-auto max-w-[1280px]">
          {/* Each page checks the admin role itself (see AdminGuard). */}
          {children}
        </div>
      </main>
    </div>
  );
}
