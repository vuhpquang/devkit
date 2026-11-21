import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

describe("PNG Tint Tester", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test/1");
    URL.revokeObjectURL = vi.fn();
  });

  it("starts empty and asks for a PNG", () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("Drop a PNG here")).toBeInTheDocument();
  });

  it("shows the original and the tinted image after opening a file", async () => {
    const C = tool.component;
    render(<C />);
    const file = new File([new Uint8Array([137, 80, 78, 71])], "star.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("PNG file"), { target: { files: [file] } });
    expect(await screen.findByAltText("Original PNG")).toHaveAttribute("src", "blob:test/1");
    expect(screen.getByRole("img", { name: "PNG tinted #eb2f96" })).toBeInTheDocument();
    expect(screen.getByText("star.png")).toBeInTheDocument();
  });

  it("validates the hex field and follows presets", async () => {
    const C = tool.component;
    render(<C />);
    const hex = screen.getByLabelText("Hex colour");
    await userEvent.clear(hex);
    await userEvent.type(hex, "#12");
    expect(screen.getByText(/Use #rgb/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Grey #727272" }));
    expect(hex).toHaveValue("#727272");
    expect(screen.getByRole("button", { name: "Grey #727272" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/Use #rgb/)).not.toBeInTheDocument();
  });

  it("refuses non-web URLs", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.type(screen.getByLabelText("PNG URL"), "javascript:alert(1){Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent(/http\(s\) URL/);
  });
});
