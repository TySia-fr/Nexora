import type { OrderStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/cn";

const STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-warn text-warn",
  PAID: "border-accent text-accent",
  SHIPPED: "border-info text-info",
  DELIVERED: "border-fg-subtle text-fg-muted",
  CANCELLED: "border-fg-subtle text-fg-subtle",
  REFUNDED: "border-fg-subtle text-fg-subtle",
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
