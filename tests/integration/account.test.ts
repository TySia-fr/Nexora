import { beforeEach, describe, expect, it } from "vitest";
import { addAddress, deleteAddress, listAddresses, setDefaultAddress } from "@/server/account";
import { addToCart } from "@/server/cart";
import { createOrderFromCart, getOrderForUser, listOrdersForUser } from "@/server/orders";
import { db, makeCategory, makeProduct, makeUser, resetDatabase, validCheckout } from "./helpers";

const address = { fullName: "A B", line1: "1 rue X", postalCode: "34000", city: "Montpellier", country: "FR" };

describe("account isolation", () => {
  beforeEach(resetDatabase);

  it("a user can't read another user's order", async () => {
    const alice = await makeUser();
    const mallory = await makeUser();
    const p = await makeProduct({ categoryId: (await makeCategory()).id });
    await addToCart({ userId: alice.id }, p.variants[0]!.id, 1);
    const order = await createOrderFromCart({ userId: alice.id }, validCheckout(), alice.id);
    expect(await getOrderForUser(alice.id, order.id)).not.toBeNull();
    expect(await getOrderForUser(mallory.id, order.id)).toBeNull();
    expect((await listOrdersForUser(mallory.id)).total).toBe(0);
  });

  it("a user can't delete or modify another user's address", async () => {
    const alice = await makeUser();
    const mallory = await makeUser();
    await addAddress(alice.id, address, false);
    const [a] = await listAddresses(alice.id);
    await expect(deleteAddress(mallory.id, a!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDefaultAddress(mallory.id, a!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.address.count()).toBe(1);
  });

  it("keeps exactly one default address", async () => {
    const u = await makeUser();
    await addAddress(u.id, address, false);
    await addAddress(u.id, { ...address, line1: "2 rue Y" }, true);
    const list = await listAddresses(u.id);
    expect(list.filter((x) => x.isDefault)).toHaveLength(1);
    expect(list[0]!.line1).toBe("2 rue Y");
    await expect(addAddress(u.id, { ...address, postalCode: "97100" }, false)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
