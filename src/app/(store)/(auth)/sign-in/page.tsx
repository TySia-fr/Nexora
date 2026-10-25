import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/validation/auth";

export const metadata = { title: "Sign in" };

async function Content({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next);
  return (
    <>
      {sp.reset === "1" && (
        <p role="status" className="rounded-card border border-line-strong p-3.5 text-sm text-accent">
          Password updated. Sign in with your new password.
        </p>
      )}
      <SignInForm next={next} />
      <p className="text-sm text-fg-muted">
        New here?{" "}
        <Link
          href={`/sign-up?next=${encodeURIComponent(next)}`}
          className="text-fg underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <>
      <h1 className="text-display-m">Sign in</h1>
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
