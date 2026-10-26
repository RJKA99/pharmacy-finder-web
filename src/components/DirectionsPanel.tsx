import { formatDistance, formatDuration } from "@/lib/format";
import type { DirectionsResult, TravelMode } from "@/lib/types";

const TRAVEL_MODES: TravelMode[] = ["foot", "bike", "car"];
const MODE_LABELS: Record<TravelMode, string> = { foot: "Walking", bike: "Cycling", car: "Driving" };

export function DirectionsPanel({
  pharmacyName,
  directions,
  mode,
  onModeChange,
  onClose,
}: {
  pharmacyName: string;
  directions: DirectionsResult;
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  onClose: () => void;
}) {
  const selected = directions[mode];

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium text-gray-900 dark:text-gray-100">Directions to {pharmacyName}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close directions"
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex gap-2" role="tablist" aria-label="Travel mode">
        {TRAVEL_MODES.map((candidateMode) => {
          const result = directions[candidateMode];
          const isSelected = mode === candidateMode;
          return (
            <button
              key={candidateMode}
              type="button"
              role="tab"
              aria-selected={isSelected}
              disabled={!result}
              onClick={() => onModeChange(candidateMode)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50 ${
                isSelected
                  ? "border-emerald-600 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900"
                  : "border-gray-300 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              }`}
            >
              <span className="block font-medium text-gray-900 dark:text-gray-100">
                {MODE_LABELS[candidateMode]}
              </span>
              <span className="block text-gray-500 dark:text-gray-400">
                {result
                  ? `${formatDistance(result.distanceMeters)} · ${formatDuration(result.durationSeconds)}`
                  : "Unavailable"}
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <>
          {selected.isOpenOnArrival === false && (
            <p
              role="alert"
              className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              Heads up: this pharmacy may be closed by the time you arrive.
            </p>
          )}

          {selected.steps.length > 0 && (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
              {selected.steps.map((step, index) => (
                <li key={index}>
                  {step.instruction}{" "}
                  <span className="text-gray-500 dark:text-gray-500">
                    ({formatDistance(step.distanceMeters)})
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {MODE_LABELS[mode]} directions aren&apos;t available right now.
        </p>
      )}
    </div>
  );
}
