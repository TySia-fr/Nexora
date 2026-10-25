import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/auth-forms";
import { safeRedirectPath } from "@/lib/validation/auth";

export const metadata = { title: "Create account" };

async function Content({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const next = safeRedirectPath((await searchParams).next);
  return (
    <>
      <SignUpForm next={next} />
      <p className="text-sm text-fg-muted">
        Already have an account?{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}`}
          className="text-fg underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
      <p className="text-xs leading-relaxed text-fg-subtle">
        We store your name, email and a salted hash of your password. See the{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
    </>
  );
}

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <>
      <h1 className="text-display-m">Create account</h1>
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
