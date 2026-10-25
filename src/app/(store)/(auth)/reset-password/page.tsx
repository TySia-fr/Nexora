import Link from "next/link";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Choose a new password" };

async function Content({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  if (!token || sp.error) {
    return (
      <p className="text-fg-muted">
        This reset link is invalid or has expired.{" "}
        <Link href="/forgot-password" className="text-fg underline underline-offset-4">
          Request a new one
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <h1 className="text-display-m">Choose a new password</h1>
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
