import { listCategoriesAdmin, listCoupons } from "@/server/admin";
import { AdminHeader, TableBox, td, th } from "@/components/admin/ui";
import { CouponCreateForm, CouponToggle } from "@/components/admin/coupon-forms";
import { formatMoney } from "@/lib/money";
import { AdminGuard } from "@/components/admin/admin-guard";

export const metadata = { title: "Coupons" };

async function AdminCouponsContent() {
  const [coupons, categories] = await Promise.all([listCoupons(), listCategoriesAdmin()]);
  const now = new Date();
  return (
    <>
      <AdminHeader title="Coupons" meta={`${coupons.length} coupons`} />
      <div className="mb-10">
        <CouponCreateForm categories={categories} />
      </div>
      <TableBox>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr>
              <th className={th}>Code</th>
              <th className={th}>Discount</th>
              <th className={th}>Rules</th>
              <th className={th}>Used</th>
              <th className={th}>State</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => {
              const expired = c.endsAt !== null && c.endsAt <= now;
              const state = !c.isActive
                ? "disabled"
                : expired
                  ? "expired"
                  : c.startsAt && c.startsAt > now
                    ? "scheduled"
                    : "live";
              return (
                <tr key={c.id}>
                  <td className={`${td} font-mono`}>{c.code}</td>
                  <td className={td}>{c.type === "PERCENT" ? `${c.value}%` : formatMoney(c.value)}</td>
                  <td className={`${td} text-xs text-fg-muted`}>
                    {c.minSubtotalCents > 0 && <>Min {formatMoney(c.minSubtotalCents)} · </>}
                    {c.category ? `${c.category.name} only` : "All products"}
                    {c.endsAt && <> · ends {c.endsAt.toLocaleDateString("en-GB")}</>}
                  </td>
                  <td className={`${td} font-mono`}>
                    {c.redemptionCount}
                    {c.maxRedemptions !== null && ` / ${c.maxRedemptions}`}
                  </td>
                  <td className={`${td} label-mono ${state === "live" ? "text-accent" : "text-fg-subtle"}`}>
                    {state}
                  </td>
                  <td className={td}>
                    <CouponToggle id={c.id} active={c.isActive} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableBox>
    </>
  );
}

export default function AdminCoupons() {
  return (
    <AdminGuard>
      <AdminCouponsContent />
    </AdminGuard>
  );
}
