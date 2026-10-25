import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-site flex flex-col items-start gap-6 py-28">
      <span className="label-mono text-fg-subtle">404</span>
      <h1 className="text-display-l">This page isn&apos;t here.</h1>
      <p className="text-fg-muted">It may have moved, or the product may no longer be available.</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/products">Browse products</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search
        </ButtonLink>
      </div>
    </div>
  );
}
