import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { site } from "@/lib/site";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-signal px-4 py-2 font-semibold text-on-signal focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <p className="theme-dark label-mono flex items-center justify-center gap-2.5 px-4 py-2.5 text-center text-fg-muted">
        <span className="size-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
        {site.announcement}
      </p>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
