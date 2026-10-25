import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="container-site flex max-w-md flex-col gap-8 py-20">{children}</div>;
}
