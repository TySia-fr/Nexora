import Link from "next/link";
import { site } from "@/lib/site";
import { LogoMark } from "@/components/brand/logo";

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
    <footer className="theme-dark mt-auto">
      <div className="container-site grid grid-cols-2 gap-x-6 gap-y-12 pt-20 pb-14 md:grid-cols-12">
        <div className="col-span-2 flex flex-col gap-5 md:col-span-5">
          <LogoMark className="size-7" />
          <p className="max-w-xs text-[13px] leading-relaxed text-fg-subtle">{site.footerNote}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3 md:col-span-2">
            <span className="label-mono mb-1 text-fg-subtle">{col.title}</span>
            {col.links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="self-start text-sm text-fg-muted transition-colors duration-150 hover:text-fg"
              >
                {label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      {/* Brand signature: the wordmark at display size, edge to edge of the content column. */}
      <div className="container-site" aria-hidden="true">
        {/* textLength stretches the word to exactly the container width at every size. */}
        <svg viewBox="0 0 1000 172" className="block w-full fill-fg" role="presentation">
          <text
            x="0"
            y="160"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            className="font-display text-[212px] font-semibold [font-stretch:125%]"
          >
            NEXORA
          </text>
        </svg>
      </div>
      <div className="container-site label-mono flex flex-wrap justify-between gap-4 border-t border-line py-6 text-fg-subtle">
        <span>© 2026 NEXORA — portfolio project, no real orders</span>
        <span className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
          EUR · English · Precision electronics
        </span>
      </div>
    </footer>
  );
}
