import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PharmacyFinder } from "../PharmacyFinder";

vi.mock("../PharmacyMap", () => ({
  PharmacyMap: ({
    onOriginPick,
  }: {
    onOriginPick: (origin: { lat: number; lon: number }) => void;
  }) => (
    <button type="button" onClick={() => onOriginPick({ lat: 60.18, lon: 24.95 })}>
      simulate map click
    </button>
  ),
}));

vi.mock("../AddressSearch", () => ({
  AddressSearch: ({ onPick }: { onPick: (origin: { lat: number; lon: number }) => void }) => (
    <button type="button" onClick={() => onPick({ lat: 60.171, lon: 24.941 })}>
      simulate address pick
    </button>
  ),
}));

function mockGeolocation(
  implementation: (success: PositionCallback, error?: PositionErrorCallback) => void,
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

const SAMPLE_PHARMACY = {
  id: "overture:1",
  name: "Testiapteekki",
  lat: 60.171,
  lon: 24.941,
  distanceMeters: 150,
  address: "Testikatu 1",
  source: "overture",
};

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
    await userEvent.click(screen.getByRole("button", { name: /use my location/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/doesn't support location/i);
  });

  it("shows a permission-denied message when the user blocks location access", async () => {
    mockGeolocation((_success, error) => {
      error?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /use my location/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/permission was denied/i);
  });

  it("searches and renders the pharmacy list after picking an address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pharmacies: [SAMPLE_PHARMACY],
          searchRadiusMeters: 1500,
          generatedAt: new Date().toISOString(),
        }),
      }),
    );

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /simulate address pick/i }));

    await waitFor(() => expect(screen.getByText("Testiapteekki")).toBeInTheDocument());
  });

  it("searches after a simulated map click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          pharmacies: [SAMPLE_PHARMACY],
          searchRadiusMeters: 1500,
          generatedAt: new Date().toISOString(),
        }),
      }),
    );

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /simulate map click/i }));

    await waitFor(() => expect(screen.getByText("Testiapteekki")).toBeInTheDocument());
  });

  it("fetches and displays directions when a pharmacy's Directions button is clicked", async () => {
    mockGeolocation((success) => success(samplePosition()));
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/pharmacies")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pharmacies: [SAMPLE_PHARMACY],
            searchRadiusMeters: 1500,
            generatedAt: new Date().toISOString(),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          coordinates: [[60.17, 24.94], [60.171, 24.941]],
          distanceMeters: 150,
          durationSeconds: 120,
          steps: [{ instruction: "Head north", distanceMeters: 150 }],
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /use my location/i }));
    await waitFor(() => expect(screen.getByText("Testiapteekki")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /^directions$/i }));

    expect(await screen.findByText(/walking directions to testiapteekki/i)).toBeInTheDocument();
    expect(screen.getByText(/head north/i)).toBeInTheDocument();
  });

  it("shows a network error when the pharmacy API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<PharmacyFinder />);
    await userEvent.click(screen.getByRole("button", { name: /simulate address pick/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the pharmacy lookup/i);
  });
});
