import { Suspense } from "react";
import { requireViewer } from "@/server/session";
import { listAddresses } from "@/server/account";
import { AddressBook } from "@/components/account/address-book";

async function Content() {
  const viewer = await requireViewer("/account/addresses");
  const addresses = await listAddresses(viewer.id);
  return <AddressBook addresses={addresses} />;
}

export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-4xl font-semibold tracking-[-0.03em]">Addresses</h1>
      <Suspense fallback={<div className="h-60 animate-pulse rounded-card bg-graphite" aria-busy="true" />}>
        <Content />
      </Suspense>
    </div>
  );
}
