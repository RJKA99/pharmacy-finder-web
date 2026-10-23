import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddressSearch } from "../AddressSearch";

describe("AddressSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not search for a 1-character query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AddressSearch onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "a");

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searches and lists results for a valid query, then calls onPick when one is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ label: "Mannerheimintie 5, Helsinki, Finland", lat: 60.17, lon: 24.94 }],
        }),
      }),
    );
    const onPick = vi.fn();

    render(<AddressSearch onPick={onPick} />);
    await userEvent.type(screen.getByRole("textbox"), "Mannerheimintie");

    const result = await screen.findByRole("button", { name: /mannerheimintie 5, helsinki/i });
    await userEvent.click(result);

    expect(onPick).toHaveBeenCalledWith({ lat: 60.17, lon: 24.94 });
  });

  it("shows an error message when the search request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<AddressSearch onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "Mannerheimintie");

    await waitFor(() => expect(screen.getByText(/address search failed/i)).toBeInTheDocument());
  });
});
