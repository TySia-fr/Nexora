import type { OrderStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";

const STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-amber text-amber",
  PAID: "border-signal text-signal",
  SHIPPED: "border-sky text-sky",
  DELIVERED: "border-fog text-ash",
  CANCELLED: "border-fog text-fog",
  REFUNDED: "border-fog text-fog",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("label-mono inline-flex rounded-full border px-2 py-1 text-[10px]", STYLES[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
