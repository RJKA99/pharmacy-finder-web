import { PharmacyFinder } from "@/components/PharmacyFinder";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Pharmacy Finder</h1>
        <p className="mt-2 text-gray-600">
          Find the nearest pharmacies using your current location and open
          data from OpenStreetMap.
        </p>
      </div>
      <PharmacyFinder />
    </main>
  );
}
