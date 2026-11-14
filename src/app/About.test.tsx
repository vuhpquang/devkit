import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { About, AUTHOR, copyright } from "./About";

describe("About", () => {
  it("shows the shared author identity", () => {
    render(<About open onClose={vi.fn()} />);
    expect(screen.getByText("DevKit")).toBeInTheDocument();
    expect(screen.getByText(/Made by/).parentElement).toHaveTextContent("Made by Ha Phung Quang Vu");
    expect(screen.getByRole("button", { name: "vuhpquang.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GitHub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LinkedIn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report an issue" })).toBeInTheDocument();
    expect(screen.getByText("© 2026 Ha Phung Quang Vu")).toBeInTheDocument();
  });

  it("uses the exact author values", () => {
    expect(AUTHOR.name).toBe("Ha Phung Quang Vu");
    expect(AUTHOR.website).toBe("https://vuhpquang.com");
    expect(AUTHOR.github).toBe("https://github.com/vuhpquang");
    expect(AUTHOR.linkedIn).toBe("https://www.linkedin.com/in/vuhpquang/");
    expect(copyright(2026, 2026)).toBe("© 2026 Ha Phung Quang Vu");
    expect(copyright(2025, 2026)).toBe("© 2025–2026 Ha Phung Quang Vu");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<About open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<About open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
