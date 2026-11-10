import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/server/session";
import { isAppError } from "@/server/errors";
import { MAX_UPLOAD_BYTES, uploadProductImage } from "@/server/media";
import { CATALOG_TAG } from "@/server/catalog";
import { env } from "@/lib/env";

/**
 * Image upload. A route handler rather than a Server Action because Server Actions cap
 * request bodies at 1 MB for every action; raising that globally would widen the
 * attack surface of all of them. This one endpoint accepts up to 8 MB, admin only.
 */
export async function POST(request: Request, { params }: RouteContext<"/admin/products/[id]/images">) {
  // Server Actions check the Origin for us; a route handler has to do it itself (CSRF).
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(env.APP_URL).host) {
    return Response.json({ ok: false, message: "Cross-site request refused." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ ok: false, message: "Images must be 8 MB or smaller." }, { status: 413 });
  }
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ ok: false, message: "Choose an image." }, { status: 400 });
    const imageId = await uploadProductImage(admin.id, id, file, form.get("alt"));
    // updateTag is for Server Actions only; expire the tag immediately instead.
    revalidateTag(CATALOG_TAG, { expire: 0 });
    revalidatePath("/products/[slug]", "page");
    return Response.json({ ok: true, imageId });
  } catch (e) {
    if (isAppError(e)) return Response.json({ ok: false, message: e.message }, { status: e.status });
    console.error("[nexora] image upload failed", e);
    return Response.json({ ok: false, message: "Upload failed. Try again." }, { status: 500 });
  }
}
