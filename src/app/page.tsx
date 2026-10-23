import { PharmacyFinder } from "@/components/PharmacyFinder";

// Nonce-based CSP requires dynamic rendering: the nonce only exists per
// request (set by middleware.ts), so a statically prerendered page would
// ship with no nonce on its scripts at all and fail to hydrate.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Pharmacy Finder</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Find the nearest pharmacies in Finland. Use your current location,
          search for an address, or click anywhere on the map to set a
          starting point - then get walking directions to any result.
        </p>
      </div>
      <PharmacyFinder />
    </main>
  );
}
