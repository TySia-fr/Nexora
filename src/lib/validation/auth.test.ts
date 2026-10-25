import { describe, expect, it } from "vitest";
import { safeRedirectPath, signUpSchema } from "./auth";

describe("safeRedirectPath (open-redirect guard)", () => {
  it.each([
    ["/account/orders", "/account/orders"],
    ["/products/halo-one?variant=X", "/products/halo-one?variant=X"],
    ["https://evil.example", "/account"],
    ["//evil.example", "/account"],
    ["/\\evil.example", "/account"],
    ["javascript:alert(1)", "/account"],
    ["/%0d%0aLocation:evil", "/%0d%0aLocation:evil"],
    [undefined, "/account"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe("signUpSchema", () => {
  it("requires matching passwords of at least 10 characters", () => {
    expect(
      signUpSchema.safeParse({ name: "A", email: "a@b.co", password: "short", confirm: "short" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        name: "A",
        email: "a@b.co",
        password: "long-enough-1",
        confirm: "different-1",
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        name: "A",
        email: "A@B.co",
        password: "long-enough-1",
        confirm: "long-enough-1",
      }).data?.email,
    ).toBe("a@b.co");
  });

  it("ignores fields like role", () => {
    const r = signUpSchema.safeParse({
      name: "A",
      email: "a@b.co",
      password: "long-enough-1",
      confirm: "long-enough-1",
      role: "ADMIN",
    });
    expect(r.success && "role" in r.data).toBe(false);
  });
});
