import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PharmacyFinder } from "../PharmacyFinder";

function mockGeolocation(
  implementation: (
    success: PositionCallback,
    error?: PositionErrorCallback,
  ) => void,
) {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn(implementation) },
  });
}

function samplePosition(): GeolocationPosition {
  return {
    coords: {
      latitude: 60.17,
      longitude: 24.94,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return this;
      },
    },
    timestamp: Date.now(),
    toJSON() {
      return this;
    },
  } as GeolocationPosition;
}

describe("PharmacyFinder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows an error when geolocation is unsupported", async () => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /find nearest pharmacy/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't support location/i);
  });

  it("shows a permission-denied message when the user blocks location access", async () => {
    mockGeolocation((_success, error) => {
      error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /find nearest pharmacy/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission was denied/i);
  });

  it("shows a network error when the API call fails", async () => {
    mockGeolocation((success) => success(samplePosition()));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /find nearest pharmacy/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach/i);
  });

  it("renders the pharmacy list and map on success", async () => {
    mockGeolocation((success) => success(samplePosition()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pharmacies: [
            {
              id: "osm:node/1",
              name: "Testiapteekki",
              lat: 60.171,
              lon: 24.941,
              distanceMeters: 150,
              address: "Testikatu 1",
              source: "osm",
            },
          ],
          searchRadiusMeters: 1500,
          generatedAt: new Date().toISOString(),
        }),
      }),
    );

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /find nearest pharmacy/i }));

    await waitFor(() => expect(screen.getByText("Testiapteekki")).toBeInTheDocument());
    expect(screen.getByTitle(/map of nearby pharmacies/i)).toBeInTheDocument();
  });
});
