import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deleteImage, moveImage, readMedia, uploadProductImage, updateImageAlt } from "@/server/media";
import { setProductsStatus } from "@/server/admin";
import { AppError } from "@/server/errors";
import { db, makeCategory, makeProduct, makeUser, resetDatabase } from "./helpers";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "nexora-uploads-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(() => rm(dir, { recursive: true, force: true }));
beforeEach(async () => {
  await resetDatabase();
  for (const f of await readdir(dir)) await rm(join(dir, f));
});

async function png(width = 3000, height = 1500): Promise<File> {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#336699" } })
    .withMetadata({ exif: { IFD0: { Copyright: "secret-serial-123" } } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buf)], "photo.png", { type: "image/png" });
}

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

describe("product image uploads", () => {
  it("re-encodes to WebP, caps the size, strips metadata and appends after existing images", async () => {
    const admin = await makeUser("ADMIN");
    const product = await makeProduct({ categoryId: (await makeCategory()).id });
    const before = await db.productImage.count({ where: { productId: product.id } });

    const id = await uploadProductImage(admin.id, product.id, await png(), "Blue test image");
    const image = await db.productImage.findUniqueOrThrow({ where: { id } });
    expect(image.url).toMatch(/^\/media\/[a-f0-9]{24}\.webp$/);
    expect([image.width, image.height]).toEqual([2000, 1000]);
    expect(image.position).toBeGreaterThanOrEqual(before);

    const file = await readMedia(image.url.slice("/media/".length));
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(await db.auditLog.count({ where: { action: "product.image.upload" } })).toBe(1);
  });

  it("refuses files that are not images, whatever they claim, and writes nothing", async () => {
    const admin = await makeUser("ADMIN");
    const product = await makeProduct({ categoryId: (await makeCategory()).id });
    const fake = new File(["<script>alert(1)</script>"], "x.png", { type: "image/png" });
    await expectAppError(uploadProductImage(admin.id, product.id, fake, "Fake image"), "VALIDATION");
    await expectAppError(uploadProductImage(admin.id, product.id, await png(10, 10), "x"), "VALIDATION");
    expect(await readdir(dir)).toEqual([]);
  });

  it("never serves a path outside the upload folder", async () => {
    await expectAppError(readMedia("../../etc/passwd"), "NOT_FOUND");
    await expectAppError(readMedia("abc.webp"), "NOT_FOUND");
  });

  it("reorders, renames and deletes, removing only uploaded files", async () => {
    const admin = await makeUser("ADMIN");
    const product = await makeProduct({ categoryId: (await makeCategory()).id });
    await db.productImage.deleteMany({ where: { productId: product.id } });
    const a = await uploadProductImage(admin.id, product.id, await png(400, 400), "First image");
    const b = await uploadProductImage(admin.id, product.id, await png(400, 400), "Second image");
    await moveImage(admin.id, b, -1);
    const order = await db.productImage.findMany({
      where: { productId: product.id },
      orderBy: { position: "asc" },
    });
    expect(order.map((i) => i.id)).toEqual([b, a]);

    await updateImageAlt(admin.id, a, "Renamed image");
    expect((await db.productImage.findUniqueOrThrow({ where: { id: a } })).alt).toBe("Renamed image");

    await deleteImage(admin.id, a);
    expect(await readdir(dir)).toHaveLength(1);
  });
});

describe("bulk product status", () => {
  it("changes every selected product in one audited step", async () => {
    const admin = await makeUser("ADMIN");
    const { id: categoryId } = await makeCategory();
    const p1 = await makeProduct({ categoryId });
    const p2 = await makeProduct({ categoryId });
    expect(await setProductsStatus(admin.id, { ids: [p1.id, p2.id], status: "DRAFT" })).toBe(2);
    expect(await db.product.count({ where: { status: "DRAFT" } })).toBe(2);
    await expectAppError(setProductsStatus(admin.id, { ids: [], status: "DRAFT" }), "VALIDATION");
    await expectAppError(setProductsStatus(admin.id, { ids: [p1.id], status: "DELETED" }), "VALIDATION");
  });
});
