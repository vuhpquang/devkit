import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const handoff = vi.hoisted(() => ({ sendTo: vi.fn(), takeHandoff: vi.fn() }));
vi.mock("../../app/handoff", () => handoff);

import { tool, loadOptions } from "./index";

/** The second editor is always the output pane. */
const output = () => document.querySelectorAll(".cm-content")[1] as HTMLElement;

describe("SVG ↔ React", () => {
  beforeEach(() => {
    localStorage.clear();
    handoff.sendTo.mockReset();
    handoff.takeHandoff.mockReset();
  });

  it("converts the sample to a React component and previews it", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    await waitFor(() => expect(output().textContent).toContain("export default Icon;"));
    expect(output().textContent).toContain("strokeWidth");
    expect(screen.getByRole("img", { name: "SVG preview" }).getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByText(/React component/)).toBeInTheDocument();
  });

  it("switches to React Native and back to SVG", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    await userEvent.click(screen.getByRole("radio", { name: "SVG → React Native" }));
    await waitFor(() => expect(output().textContent).toContain('from "react-native-svg"'));
    await userEvent.click(screen.getByRole("radio", { name: "React → SVG" }));
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    await waitFor(() => expect(output().textContent).toContain('<svg xmlns="http://www.w3.org/2000/svg"'));
    expect(screen.getByText(/Left out/)).toBeInTheDocument();
  });

  it("hands the SVG to the image converter", async () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByRole("button", { name: /Convert image/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    await userEvent.click(screen.getByRole("button", { name: /Convert image/ }));
    expect(handoff.sendTo).toHaveBeenCalledWith("image-converter", expect.objectContaining({ kind: "image", name: "Icon.svg", mime: "image/svg+xml" }));
    const bytes = handoff.sendTo.mock.calls[0][1].bytes as Uint8Array;
    expect(new TextDecoder().decode(bytes)).toContain("<svg");
  });

  it("loads SVG handed over by another tool and remembers options", async () => {
    handoff.takeHandoff.mockReturnValue({ kind: "image", name: "my-logo.svg", mime: "image/svg+xml", bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="2" height="2"/></svg>') });
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(output().textContent).toContain("const MyLogo"));
    await userEvent.click(screen.getByRole("button", { name: "memo" }));
    expect(loadOptions().memo).toBe(true);
  });
});
