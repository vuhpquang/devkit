import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";
import { tools } from "../tools/registry";

describe("Sidebar", () => {
  it("shows the search box and every tool", () => {
    render(<Sidebar activeId={null} onSelect={vi.fn()} query="" onQuery={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    for (const t of tools) expect(screen.getByRole("button", { name: new RegExp(t.name.replace(/[/()]/g, ".")) })).toBeInTheDocument();
  });

  it("shows ranked results for a query and opens the first on Enter", async () => {
    const onSelect = vi.fn();
    const onQuery = vi.fn();
    render(<Sidebar activeId={null} onSelect={onSelect} query="yaml" onQuery={onQuery} />);
    expect(screen.getByText("1 result")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "{Enter}");
    expect(onSelect).toHaveBeenCalledWith("json-yaml");
  });

  it("goes home from All tools", async () => {
    const onSelect = vi.fn();
    render(<Sidebar activeId="uuid" onSelect={onSelect} query="" onQuery={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /All tools/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
