import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DirectionsPanel } from "../DirectionsPanel";
import type { DirectionsResult } from "@/lib/types";

const DIRECTIONS: DirectionsResult = {
  foot: {
    coordinates: [[60.17, 24.94]],
    distanceMeters: 500,
    durationSeconds: 360,
    steps: [{ instruction: "Head north", distanceMeters: 500 }],
    isOpenOnArrival: true,
  },
  bike: {
    coordinates: [[60.17, 24.94]],
    distanceMeters: 520,
    durationSeconds: 120,
    steps: [{ instruction: "Head north", distanceMeters: 520 }],
    isOpenOnArrival: true,
  },
  car: null,
};

describe("DirectionsPanel", () => {
  it("shows the selected mode's distance, duration and steps", () => {
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="foot"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Head north")).toBeInTheDocument();
    expect(screen.getByText("Head north").closest("li")).toHaveTextContent("Head north (500 m)");
  });

  it("disables the tab for a mode that failed to compute", () => {
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="foot"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: /driving/i })).toBeDisabled();
  });

  it("calls onModeChange when a different available mode is clicked", async () => {
    const onModeChange = vi.fn();
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="foot"
        onModeChange={onModeChange}
        onClose={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: /cycling/i }));
    expect(onModeChange).toHaveBeenCalledWith("bike");
  });

  it("shows a warning when the pharmacy may be closed on arrival", () => {
    const directionsClosingSoon: DirectionsResult = {
      ...DIRECTIONS,
      foot: { ...DIRECTIONS.foot!, isOpenOnArrival: false },
    };

    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={directionsClosingSoon}
        mode="foot"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/may be closed by the time you arrive/i);
  });

  it("shows no warning when the pharmacy will still be open on arrival", () => {
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="foot"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a fallback message when the selected mode itself is unavailable", () => {
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="car"
        onModeChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/driving directions aren't available right now/i)).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <DirectionsPanel
        pharmacyName="Testiapteekki"
        directions={DIRECTIONS}
        mode="foot"
        onModeChange={vi.fn()}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /close directions/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
