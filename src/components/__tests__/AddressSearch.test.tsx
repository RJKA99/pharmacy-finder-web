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
    await userEvent.type(screen.getByRole("combobox"), "a");

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
    await userEvent.type(screen.getByRole("combobox"), "Mannerheimintie");

    const result = await screen.findByRole("option", { name: /mannerheimintie 5, helsinki/i });
    await userEvent.click(result);

    expect(onPick).toHaveBeenCalledWith({ lat: 60.17, lon: 24.94 });
  });

  it("shows an error message when the search request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    render(<AddressSearch onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "Mannerheimintie");

    await waitFor(() => expect(screen.getByText(/address search failed/i)).toBeInTheDocument());
  });

  it("shows a loading indicator while a search is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve))),
    );

    render(<AddressSearch onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole("combobox"), "Mannerheimintie");

    await waitFor(() => expect(screen.getByText(/searching/i)).toBeInTheDocument());
    resolveFetch({ ok: true, json: async () => ({ results: [] }) });
  });

  it("clears the query and results when the clear button is clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ label: "Testikatu 1", lat: 60.1, lon: 24.9 }] }),
      }),
    );

    render(<AddressSearch onPick={vi.fn()} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Testikatu");
    await screen.findByRole("option", { name: /testikatu 1/i });

    await userEvent.click(screen.getByRole("button", { name: /clear search/i }));

    expect(input).toHaveValue("");
    expect(screen.queryByRole("option", { name: /testikatu 1/i })).not.toBeInTheDocument();
  });

  it("closes the results dropdown on Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ label: "Testikatu 1", lat: 60.1, lon: 24.9 }] }),
      }),
    );

    render(<AddressSearch onPick={vi.fn()} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Testikatu");
    await screen.findByRole("option", { name: /testikatu 1/i });

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("option", { name: /testikatu 1/i })).not.toBeInTheDocument();
  });

  it("closes the results dropdown on an outside click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ label: "Testikatu 1", lat: 60.1, lon: 24.9 }] }),
      }),
    );

    render(
      <div>
        <AddressSearch onPick={vi.fn()} />
        <button type="button">outside</button>
      </div>,
    );
    await userEvent.type(screen.getByRole("combobox"), "Testikatu");
    await screen.findByRole("option", { name: /testikatu 1/i });

    await userEvent.click(screen.getByRole("button", { name: "outside" }));

    expect(screen.queryByRole("option", { name: /testikatu 1/i })).not.toBeInTheDocument();
  });

  it("selects the highlighted result with ArrowDown + Enter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { label: "First result", lat: 60.1, lon: 24.9 },
            { label: "Second result", lat: 60.2, lon: 24.8 },
          ],
        }),
      }),
    );
    const onPick = vi.fn();

    render(<AddressSearch onPick={onPick} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "result");
    await screen.findByRole("option", { name: "First result" });

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith({ lat: 60.2, lon: 24.8 });
  });

  it("ignores a stale response that resolves after a newer search", async () => {
    const fetchMock = vi.fn();
    let resolveFirst: (value: unknown) => void = () => {};
    let resolveSecond: (value: unknown) => void = () => {};
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    render(<AddressSearch onPick={vi.fn()} />);
    const input = screen.getByRole("combobox");

    await userEvent.type(input, "Aa");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await userEvent.type(input, "bb");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Second (newer) request resolves first, then the first (now-stale) one.
    resolveSecond({ ok: true, json: async () => ({ results: [{ label: "Fresh", lat: 1, lon: 1 }] }) });
    await screen.findByRole("option", { name: "Fresh" });

    resolveFirst({ ok: true, json: async () => ({ results: [{ label: "Stale", lat: 2, lon: 2 }] }) });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.queryByRole("option", { name: "Stale" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Fresh" })).toBeInTheDocument();
  });
});
