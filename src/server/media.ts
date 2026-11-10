import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import sharp, { type OutputInfo } from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

/**
 * Product image uploads.
 *
 * Files never go into public/: the production image is read-only and rebuilt on every
 * deploy. They live in UPLOAD_DIR (a Docker volume in production) and are served by
 * /media/[file]. Every upload is decoded and re-encoded by sharp, which strips metadata
 * (GPS, camera serials) and rejects anything that isn't really an image, whatever its
 * name or MIME type claims.
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 12;
const MAX_EDGE = 2000;
const MEDIA_PREFIX = "/media/";
/** Generated names only: 24 hex characters + .webp. Anything else is refused. */
export const MEDIA_FILE = /^[a-f0-9]{24}\.webp$/;

export function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR || join(process.cwd(), "uploads"));
}

function filePath(name: string): string {
  if (!MEDIA_FILE.test(name)) throw new AppError("NOT_FOUND", "Not found.");
  const dir = uploadDir();
  const path = resolve(dir, name);
  if (!path.startsWith(dir + sep)) throw new AppError("NOT_FOUND", "Not found.");
  return path;
}

export async function readMedia(name: string): Promise<Buffer> {
  try {
    return await readFile(filePath(name));
  } catch {
    throw new AppError("NOT_FOUND", "Not found.");
  }
}

const altSchema = z.string().trim().min(3, "Describe the image in a few words.").max(160);

async function audit(actorId: string, action: string, entityId: string, data?: object) {
  await db.auditLog.create({
    data: { actorId, action, entity: "Product", entityId, data: data as Prisma.InputJsonValue },
  });
}

export async function uploadProductImage(
  actorId: string,
  productId: string,
  file: File,
  rawAlt: unknown,
): Promise<string> {
  const alt = altSchema.safeParse(rawAlt);
  if (!alt.success) throw new AppError("VALIDATION", alt.error.issues[0].message);
  if (file.size === 0) throw new AppError("VALIDATION", "Choose an image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "Images must be 8 MB or smaller.");

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, _count: { select: { images: true } } },
  });
  if (!product) throw new AppError("NOT_FOUND", "Product not found.");
  if (product._count.images >= MAX_IMAGES_PER_PRODUCT) {
    throw new AppError("CONFLICT", `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images.`);
  }

  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate() // apply EXIF orientation before the metadata is dropped
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError("VALIDATION", "That file isn't an image we can read (use JPEG, PNG, WebP or AVIF).");
  }

  const name = `${randomBytes(12).toString("hex")}.webp`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(filePath(name), output.data, { flag: "wx" });

  try {
    const last = await db.productImage.aggregate({ where: { productId }, _max: { position: true } });
    const image = await db.productImage.create({
      data: {
        productId,
        url: `${MEDIA_PREFIX}${name}`,
        alt: alt.data,
        width: output.info.width,
        height: output.info.height,
        position: (last._max.position ?? -1) + 1,
      },
      select: { id: true },
    });
    await audit(actorId, "product.image.upload", productId, { imageId: image.id, bytes: output.data.length });
    return image.id;
  } catch (e) {
    await rm(filePath(name), { force: true });
    throw e;
  }
}

export async function updateImageAlt(actorId: string, imageId: string, rawAlt: unknown): Promise<void> {
  const alt = altSchema.safeParse(rawAlt);
  if (!alt.success) throw new AppError("VALIDATION", alt.error.issues[0].message);
  const image = await db.productImage.update({
    where: { id: imageId },
    data: { alt: alt.data },
    select: { productId: true },
  });
  await audit(actorId, "product.image.alt", image.productId, { imageId });
}

/** Moves an image one place earlier (-1) or later (+1); position 0 is the cover. */
export async function moveImage(actorId: string, imageId: string, direction: -1 | 1): Promise<void> {
  await db.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!image) throw new AppError("NOT_FOUND", "Image not found.");
    const siblings = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    const i = siblings.findIndex((s) => s.id === imageId);
    const j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    // Renumber all of them: seeded positions may have gaps or ties.
    for (const [position, s] of siblings.entries()) {
      await tx.productImage.update({ where: { id: s.id }, data: { position } });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "product.image.move",
        entity: "Product",
        entityId: image.productId,
        data: { imageId, direction },
      },
    });
  });
}

export async function deleteImage(actorId: string, imageId: string): Promise<void> {
  const image = await db.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw new AppError("NOT_FOUND", "Image not found.");
  await db.productImage.delete({ where: { id: imageId } });
  // Only uploaded files are removed; seeded images in public/ belong to the build.
  if (image.url.startsWith(MEDIA_PREFIX)) {
    await rm(filePath(image.url.slice(MEDIA_PREFIX.length)), { force: true });
  }
  await audit(actorId, "product.image.delete", image.productId, { imageId, url: image.url });
}
