import { connection, NextResponse } from "next/server";
import { db } from "@/server/db";

/** Liveness + database reachability, for Docker and uptime checks. No details leaked. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "degraded" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
