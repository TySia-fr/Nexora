import Link from "next/link";

// Fallback for URLs outside every route group (no store header here).
export default function GlobalNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-start justify-center gap-6 p-8 md:p-24">
      <span className="label-mono text-fog">404</span>
      <h1 className="text-5xl font-semibold tracking-[-0.03em]">This page isn&apos;t here.</h1>
      <Link href="/" className="text-signal underline underline-offset-4">
        Go to the NEXORA store
      </Link>
    </main>
  );
}
