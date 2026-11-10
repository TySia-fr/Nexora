import { readMedia } from "@/server/media";

/**
 * Uploaded product images (see src/server/media.ts). Names are random and never reused,
 * so responses can be cached for a year.
 */
export async function GET(_request: Request, { params }: RouteContext<"/media/[file]">) {
  const { file } = await params;
  try {
    const body = await readMedia(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found.", { status: 404 });
  }
}
