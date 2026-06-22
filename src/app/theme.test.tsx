import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme";

function Probe() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme("dark")}>theme:{theme}</button>;
}

describe("theme", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to system and persists changes", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByText("theme:system")).toBeInTheDocument();
    act(() => screen.getByRole("button").click());
    expect(localStorage.getItem("devkit.theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
