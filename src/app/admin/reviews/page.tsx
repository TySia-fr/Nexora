import Link from "next/link";
import { listReviewsAdmin } from "@/server/admin";
import { AdminHeader, Pager, pageParam, strParam } from "@/components/admin/ui";
import { ReviewActions } from "@/components/admin/review-actions";
import { cn } from "@/lib/cn";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Reviews" };
const TABS = ["PENDING", "APPROVED", "REJECTED"] as const;

async function AdminReviewsContent({ searchParams }: PageProps<"/admin/reviews">) {
  const sp = await searchParams;
  const status = TABS.find((t) => t === strParam(sp.status)) ?? "PENDING";
  const page = pageParam(sp.page);
  const { reviews, total, pageCount } = await listReviewsAdmin(status, page);
  return (
    <>
      <AdminHeader title="Reviews" meta={`${total} ${status.toLowerCase()}`} />
      <nav aria-label="Review status" className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/reviews?status=${t}`}
            aria-current={t === status ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-sm",
              t === status ? "border-paper" : "border-line-strong text-ash",
            )}
          >
            {t.toLowerCase()}
          </Link>
        ))}
      </nav>
      {reviews.length === 0 && <p className="text-sm text-ash">Nothing here.</p>}
      <ul className="flex flex-col" role="list">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 border-t border-line py-5">
            <div className="flex flex-wrap justify-between gap-3">
              <span className="font-medium">
                {r.title} <span className="font-mono text-xs text-signal">{r.rating}/5</span>
              </span>
              <ReviewActions id={r.id} status={r.status} />
            </div>
            <p className="text-sm text-ash">{r.body}</p>
            <span className="label-mono text-fog">
              {r.product.name} · {r.user.name} ({r.user.email}) ·{" "}
              {r.verifiedPurchase ? "verified purchase" : "not verified"} ·{" "}
              {r.createdAt.toLocaleDateString("en-GB")}
            </span>
          </li>
        ))}
      </ul>
      <Pager page={page} pageCount={pageCount} href={(p) => `/admin/reviews?status=${status}&page=${p}`} />
    </>
  );
}

export default function AdminReviews(props: PageProps<"/admin/reviews">) {
  return (
    <AdminGuard>
      <AdminReviewsContent {...props} />
    </AdminGuard>
  );
}
