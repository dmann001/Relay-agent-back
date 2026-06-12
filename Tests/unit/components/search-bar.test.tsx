/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { SearchBar } from "@/components/search-bar";

describe("SearchBar", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("debounces search input", () => {
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);

    fireEvent.change(screen.getByPlaceholderText("Search emails..."), {
      target: { value: "invoice" },
    });
    expect(onSearch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(350);
    expect(onSearch).toHaveBeenLastCalledWith("invoice");
  });

  it("searches immediately on Enter and clears the query", () => {
    const onSearch = jest.fn();
    render(<SearchBar onSearch={onSearch} />);
    const input = screen.getByPlaceholderText("Search emails...");

    fireEvent.change(input, { target: { value: "urgent" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearch).toHaveBeenCalledWith("urgent");

    fireEvent.click(screen.getByTitle("Clear search"));
    expect(input).toHaveValue("");
  });

  it("disables input while a search is running", () => {
    render(<SearchBar isSearching />);
    expect(screen.getByPlaceholderText("Search emails...")).toBeDisabled();
  });
});
