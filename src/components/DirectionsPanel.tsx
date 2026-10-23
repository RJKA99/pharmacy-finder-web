import { formatDistance, formatDuration } from "@/lib/format";
import type { RouteResult } from "@/lib/types";

export function DirectionsPanel({
  pharmacyName,
  route,
  onClose,
}: {
  pharmacyName: string;
  route: RouteResult;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            Walking directions to {pharmacyName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatDistance(route.distanceMeters)} · {formatDuration(route.durationSeconds)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close directions"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {route.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          {route.steps.map((step, index) => (
            <li key={index}>
              {step.instruction}{" "}
              <span className="text-gray-500 dark:text-gray-500">
                ({formatDistance(step.distanceMeters)})
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
