import { describe, it, expect, beforeEach } from "vitest";
import { renderTool, savedValue } from "../../test/renderTool";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("URL Parser screen", () => {
  it("lists parts and decoded query parameters of the sample", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("api.example.com")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Query parameters" });
    expect(within(table).getByText("đà nẵng")).toBeInTheDocument();
    expect(within(table).getAllByText("repeated")).toHaveLength(2);
  });

  it("assumes https and reports invalid URLs", async () => {
    const C = tool.component;
    render(<C />);
    const input = screen.getByLabelText("URL");
    await userEvent.type(input, "example.com/a");
    expect(await screen.findByText(/No scheme given/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "not a url");
    expect(await screen.findByRole("alert")).toHaveTextContent(/Not a valid URL/);
  });
});

describe("URL Parser remembers", () => {
  beforeEach(() => localStorage.clear());

  it("the URL across a relaunch", async () => {
    const { unmount } = renderTool(tool.component, tool.id);
    await userEvent.type(screen.getByLabelText("URL"), "https://example.com/x");
    expect(savedValue(tool.id, "input")).toBe("https://example.com/x");
    unmount();
    renderTool(tool.component, tool.id);
    expect(screen.getByLabelText("URL")).toHaveValue("https://example.com/x");
  });
});
