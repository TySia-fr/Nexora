import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import { adjustStock, createCoupon, deleteProduct, saveProduct } from "@/server/admin";
import { db, makeCategory, makeProduct, makeUser, resetDatabase } from "./helpers";

// The signed-in viewer is controlled per test.
const viewer = vi.hoisted(() => ({ current: null as null | { id: string; role: "CUSTOMER" | "ADMIN" } }));
vi.mock("@/server/session", () => ({
  requireAdmin: async () => {
    if (!viewer.current) throw new AppError("UNAUTHENTICATED", "Please sign in.");
    if (viewer.current.role !== "ADMIN") throw new AppError("FORBIDDEN", "You don't have access to this.");
    return viewer.current;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const productForm = (categoryId: string, over: Record<string, unknown> = {}) => ({
  name: "Test Phone",
  slug: "test-phone",
  tagline: "Phone",
  description: "A phone.",
  categoryId,
  status: "ACTIVE",
  featured: false,
  specs: "Display: 6.1 in\nWeight: 170 g",
  features: "",
  variants: [{ sku: "tp-128", name: "128 GB", colorHex: "", price: "799", stock: "5", isActive: true }],
  ...over,
});

describe("admin authorization", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects anonymous and customer callers for every privileged action", async () => {
    const actions = await import("@/server/actions/admin");
    const category = await makeCategory();
    const p = await makeProduct({ categoryId: category.id });
    const calls = [
      () => actions.transitionOrderAction("x", "SHIPPED"),
      () => actions.deleteProductAction(p.id),
      () => actions.adjustStockAction(p.variants[0]!.id, 100),
      () => actions.setCouponActiveAction("x", true),
      () => actions.moderateReviewAction("x", "APPROVED"),
      () => actions.deleteCategoryAction(category.id),
    ];
    for (const who of [null, { id: (await makeUser()).id, role: "CUSTOMER" as const }]) {
      viewer.current = who;
      for (const call of calls) {
        const r = await call();
        expect(r.ok).toBe(false);
        expect(["UNAUTHENTICATED", "FORBIDDEN"]).toContain(!r.ok && r.code);
      }
    }
    // Nothing changed.
    expect((await db.productVariant.findUniqueOrThrow({ where: { id: p.variants[0]!.id } })).stock).toBe(10);
    expect(await db.product.count()).toBe(1);
  });

  it("lets an admin act, and audits it", async () => {
    const actions = await import("@/server/actions/admin");
    const admin = await makeUser("ADMIN");
    viewer.current = { id: admin.id, role: "ADMIN" };
    const category = await makeCategory();
    const p = await makeProduct({ categoryId: category.id });
    const r = await actions.adjustStockAction(p.variants[0]!.id, 5);
    expect(r).toEqual({ ok: true, data: { stock: 15 } });
    expect(await db.auditLog.count({ where: { actorId: admin.id, action: "stock.adjust" } })).toBe(1);
  });
});

describe("admin catalog rules", () => {
  let actorId: string;
  let categoryId: string;
  beforeEach(async () => {
    await resetDatabase();
    actorId = (await makeUser("ADMIN")).id;
    categoryId = (await makeCategory("phones")).id;
  });

  it("creates a product with parsed specs and integer prices", async () => {
    const id = await saveProduct(actorId, null, productForm(categoryId));
    const p = await db.product.findUniqueOrThrow({ where: { id }, include: { variants: true } });
    expect(p.specs).toEqual([
      { label: "Display", value: "6.1 in" },
      { label: "Weight", value: "170 g" },
    ]);
    expect(p.variants[0]).toMatchObject({ sku: "TP-128", priceCents: 79900, stock: 5 });
  });

  it("rejects bad input with field errors", async () => {
    await expect(
      saveProduct(
        actorId,
        null,
        productForm(categoryId, {
          slug: "Not A Slug",
          variants: [{ sku: "x", name: "", price: "abc", stock: "-1", isActive: true }],
        }),
      ),
    ).rejects.toSatisfy((e: unknown) => {
      const f = ((e as AppError).details?.fieldErrors ?? {}) as Record<string, string>;
      return "slug" in f && "variants.0.sku" in f && "variants.0.price" in f && "variants.0.stock" in f;
    });
  });

  it("rejects duplicate slugs and SKUs", async () => {
    await saveProduct(actorId, null, productForm(categoryId));
    await expect(saveProduct(actorId, null, productForm(categoryId))).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("keeps ordered variants (deactivated) and deletes unordered ones when removed", async () => {
    const id = await saveProduct(
      actorId,
      null,
      productForm(categoryId, {
        variants: [
          { sku: "TP-A", name: "A", price: "10", stock: "1", isActive: true },
          { sku: "TP-B", name: "B", price: "10", stock: "1", isActive: true },
        ],
      }),
    );
    const [a] = await db.productVariant.findMany({ where: { productId: id }, orderBy: { position: "asc" } });
    const order = await db.order.create({
      data: {
        email: "x@y.z",
        subtotalCents: 1000,
        shippingCents: 0,
        totalCents: 1000,
        shippingMethod: "STANDARD",
        shipFullName: "X",
        shipLine1: "1",
        shipPostalCode: "34000",
        shipCity: "M",
        shipCountry: "FR",
        items: {
          create: {
            variantId: a!.id,
            productId: id,
            productSlug: "test-phone",
            productName: "Test Phone",
            variantName: "A",
            sku: "TP-A",
            unitPriceCents: 1000,
            quantity: 1,
            lineTotalCents: 1000,
          },
        },
      },
    });
    await saveProduct(
      actorId,
      id,
      productForm(categoryId, {
        variants: [{ sku: "TP-C", name: "C", price: "12", stock: "3", isActive: true }],
      }),
    );
    const variants = await db.productVariant.findMany({ where: { productId: id } });
    expect(variants.map((v) => [v.sku, v.isActive]).sort()).toEqual([
      ["TP-A", false],
      ["TP-C", true],
    ]);
    expect(await db.orderItem.count({ where: { orderId: order.id } })).toBe(1);

    // And a product that was ordered can't be deleted.
    await expect(deleteProduct(actorId, id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("never lets stock go below zero", async () => {
    const p = await makeProduct({ categoryId, variants: [{ priceCents: 100, stock: 2 }] });
    await expect(adjustStock(actorId, p.variants[0]!.id, -3)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await adjustStock(actorId, p.variants[0]!.id, -2)).toBe(0);
  });

  it("validates coupons", async () => {
    await expect(createCoupon(actorId, { code: "BAD", type: "PERCENT", value: "150" })).rejects.toMatchObject(
      { code: "VALIDATION" },
    );
    await expect(
      createCoupon(actorId, {
        code: "DATES",
        type: "FIXED",
        value: "10",
        startsAt: "2026-12-01",
        endsAt: "2026-11-01",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await createCoupon(actorId, { code: "ten-off", type: "FIXED", value: "10,50", minSubtotal: "50" });
    expect(await db.coupon.findUniqueOrThrow({ where: { code: "TEN-OFF" } })).toMatchObject({
      value: 1050,
      minSubtotalCents: 5000,
    });
  });
});
