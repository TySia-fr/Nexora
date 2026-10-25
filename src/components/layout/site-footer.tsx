import Link from "next/link";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Shop",
    links: [
      ["All products", "/products"],
      ["Audio", "/categories/audio"],
      ["Phones", "/categories/phones"],
      ["Wearables", "/categories/wearables"],
      ["Speakers", "/categories/speakers"],
      ["Accessories", "/categories/accessories"],
    ],
  },
  {
    title: "Help",
    links: [
      ["Shipping", "/shipping"],
      ["Returns", "/returns"],
      ["Contact", "/contact"],
      ["Your orders", "/account/orders"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="container-site grid grid-cols-2 gap-10 py-16 md:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-1">
          <span className="font-bold tracking-[0.18em]">NEXORA</span>
          <p className="max-w-xs text-[13px] leading-relaxed text-fg-subtle">{site.footerNote}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <span className="label-mono text-fg-subtle">{col.title}</span>
            {col.links.map(([label, href]) => (
              <Link key={href} href={href} className="text-sm text-fg-muted hover:text-accent">
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="container-site label-mono flex flex-wrap justify-between gap-4 border-t border-line py-6 text-fg-subtle">
        <span>© 2026 NEXORA — portfolio project</span>
        <span>EUR · English</span>
      </div>
    </footer>
  );
}
