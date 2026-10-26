import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PharmacyList } from "../PharmacyList";

const PHARMACY = {
  id: "overture:1",
  name: "Testiapteekki",
  lat: 60.17,
  lon: 24.94,
  distanceMeters: 1800,
  address: "Testikatu 1, 00100 Helsinki",
  source: "overture" as const,
};

describe("PharmacyList", () => {
  it("shows an empty-state message when there are no pharmacies", () => {
    render(<PharmacyList pharmacies={[]} onDirections={vi.fn()} loadingDirectionsId={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no pharmacies found/i);
  });

  it("renders name, address and distance for each pharmacy", () => {
    render(
      <PharmacyList
        pharmacies={[PHARMACY]}
        onDirections={vi.fn()}
        loadingDirectionsId={null}
      />,
    );

    expect(screen.getByText("Testiapteekki")).toBeInTheDocument();
    expect(screen.getByText("Testikatu 1, 00100 Helsinki")).toBeInTheDocument();
    expect(screen.getByText("1.8 km")).toBeInTheDocument();
  });

  it("calls onDirections with the pharmacy when its button is clicked", async () => {
    const onDirections = vi.fn();
    render(
      <PharmacyList pharmacies={[PHARMACY]} onDirections={onDirections} loadingDirectionsId={null} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /directions/i }));
    expect(onDirections).toHaveBeenCalledWith(PHARMACY);
  });

  it("shows a loading state only for the pharmacy whose directions are being fetched", () => {
    render(
      <PharmacyList
        pharmacies={[PHARMACY]}
        onDirections={vi.fn()}
        loadingDirectionsId={PHARMACY.id}
      />,
    );

    expect(screen.getByRole("button", { name: /loading/i })).toBeDisabled();
  });

  it("highlights the active pharmacy's row", () => {
    const other = { ...PHARMACY, id: "overture:2", name: "Toinen apteekki" };
    render(
      <PharmacyList
        pharmacies={[PHARMACY, other]}
        onDirections={vi.fn()}
        loadingDirectionsId={null}
        activePharmacyId={PHARMACY.id}
      />,
    );

    expect(screen.getByText("Testiapteekki").closest("li")).toHaveClass("bg-emerald-50");
    expect(screen.getByText("Toinen apteekki").closest("li")).not.toHaveClass("bg-emerald-50");
  });
});
