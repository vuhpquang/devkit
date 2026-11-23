import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { KEEP_ALIVE } from "../App";

/** Opens a tool from the sidebar by its exact name. */
async function open(name: string) {
  await userEvent.click(screen.getAllByRole("button", { name })[0]);
  expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
}

describe("keeping tools alive", () => {
  beforeEach(() => localStorage.clear());

  it("keeps what was typed in a tool after switching away and back", async () => {
    render(<App />);
    const firstInput = () => screen.getAllByRole("textbox").find((el) => el.tagName === "INPUT") as HTMLInputElement;
    await open("Regex Tester");
    fireEvent.change(firstInput(), { target: { value: "keep me" } });
    await open("UUID Generator");
    await open("Regex Tester");
    expect(firstInput()).toHaveValue("keep me");
  });

  it("hides the tools that aren't open and drops the oldest past the limit", async () => {
    render(<App />);
    const names = ["Hash Generator", "UUID Generator", "Base64", "Lorem Ipsum", "Case Converter", "Number Base", "Regex Tester"];
    expect(names.length).toBe(KEEP_ALIVE + 1);
    for (const n of names) await open(n);
    const mounted = document.querySelectorAll("main [inert]");
    // KEEP_ALIVE tools mounted, all but the open one hidden and inert.
    expect(mounted).toHaveLength(KEEP_ALIVE - 1);
    mounted.forEach((el) => expect(el).toHaveAttribute("hidden"));
  });
});
