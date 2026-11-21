import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { About, APP, AUTHOR, copyright } from "./About";
import pkg from "../../package.json";

describe("About", () => {
  it("follows app-shell's About: icon, name, tagline, version (build), actions, author footer", () => {
    render(<About open onClose={vi.fn()} />);
    expect(screen.getByRole("img", { name: "DevKit icon" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "DevKit" })).toBeInTheDocument();
    expect(screen.getByText(APP.tagline)).toBeInTheDocument();
    expect(screen.getByText(`Version ${pkg.version} (${APP.build})`)).toBeInTheDocument();
    expect(screen.getByText("Not checked yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for Updates" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What's New" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Report Issue" })).toBeInTheDocument();
    expect(screen.getByText(/Made by/).parentElement).toHaveTextContent("Made by Ha Phung Quang Vu");
    for (const name of ["vuhpquang.com", "GitHub", "LinkedIn", "Source code"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
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

  it("opens What's New from its button", async () => {
    const onWhatsNew = vi.fn();
    render(<About open onClose={vi.fn()} onWhatsNew={onWhatsNew} />);
    await userEvent.click(screen.getByRole("button", { name: "What's New" }));
    expect(onWhatsNew).toHaveBeenCalled();
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
