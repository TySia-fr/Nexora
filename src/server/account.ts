import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { shippingAddressSchema } from "@/lib/validation/checkout";
import { fieldErrors } from "@/lib/validation/checkout";

export const MAX_ADDRESSES = 10;

export async function listAddresses(userId: string) {
  return db.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
}

export async function addAddress(userId: string, raw: unknown, makeDefault: boolean) {
  const parsed = shippingAddressSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "Check the highlighted fields.", {
      fieldErrors: fieldErrors(parsed.error),
    });
  }
  await db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES)
      throw new AppError("VALIDATION", `You can save up to ${MAX_ADDRESSES} addresses.`);
    const isDefault = makeDefault || count === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const a = parsed.data;
    // userId comes from the session, never from the form (no mass assignment).
    await tx.address.create({
      data: {
        userId,
        fullName: a.fullName,
        line1: a.line1,
        line2: a.line2 ?? null,
        postalCode: a.postalCode,
        city: a.city,
        country: a.country,
        phone: a.phone ?? null,
        isDefault,
      },
    });
  });
}

export async function deleteAddress(userId: string, addressId: string) {
  const { count } = await db.address.deleteMany({ where: { id: addressId, userId } });
  if (count === 0) throw new AppError("NOT_FOUND", "Address not found.");
}

export async function setDefaultAddress(userId: string, addressId: string) {
  await db.$transaction(async (tx) => {
    const owned = await tx.address.findFirst({ where: { id: addressId, userId }, select: { id: true } });
    if (!owned) throw new AppError("NOT_FOUND", "Address not found.");
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}
