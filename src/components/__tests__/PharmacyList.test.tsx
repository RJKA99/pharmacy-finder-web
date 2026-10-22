import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PharmacyList } from "../PharmacyList";

describe("PharmacyList", () => {
  it("shows an empty-state message when there are no pharmacies", () => {
    render(<PharmacyList pharmacies={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/no pharmacies found/i);
  });

  it("renders name, address and distance for each pharmacy", () => {
    render(
      <PharmacyList
        pharmacies={[
          {
            id: "osm:node/1",
            name: "Testiapteekki",
            lat: 60.17,
            lon: 24.94,
            distanceMeters: 1800,
            address: "Testikatu 1, 00100 Helsinki",
            source: "overture",
          },
        ]}
      />,
    );

    expect(screen.getByText("Testiapteekki")).toBeInTheDocument();
    expect(screen.getByText("Testikatu 1, 00100 Helsinki")).toBeInTheDocument();
    expect(screen.getByText("1.8 km")).toBeInTheDocument();
  });
});
