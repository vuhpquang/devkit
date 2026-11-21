import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const img = vi.hoisted(() => ({ convertImage: vi.fn(), imageInfo: vi.fn() }));
vi.mock("../../lib/image", async (orig) => ({ ...(await orig<typeof import("../../lib/image")>()), ...img }));

const handoff = vi.hoisted(() => ({ sendTo: vi.fn(), takeHandoff: vi.fn() }));
vi.mock("../../app/handoff", () => handoff);

import { tool } from "./index";

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>');

describe("Image Converter", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    img.imageInfo.mockReset().mockResolvedValue({ format: "svg", width: 24, height: 24, hasAlpha: true });
    img.convertImage.mockReset().mockImplementation(async (_b: Uint8Array, o: { resize?: { width?: number } }) => ({
      bytes: new Uint8Array(30),
      width: o.resize?.width ?? 24,
      height: o.resize?.width ?? 24,
    }));
    handoff.sendTo.mockReset();
    handoff.takeHandoff.mockReset().mockReturnValue({ kind: "image", name: "icon.svg", mime: "image/svg+xml", bytes: SVG });
  });

  it("shows the empty state without a handoff", () => {
    handoff.takeHandoff.mockReturnValue(undefined);
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("Drop an image to convert")).toBeInTheDocument();
  });

  it("renders an SVG from SVG ↔ React at 2× and converts it to PNG", async () => {
    const C = tool.component;
    render(<C />);
    expect(handoff.takeHandoff).toHaveBeenCalledWith("image-converter");
    await waitFor(() =>
      expect(img.convertImage).toHaveBeenCalledWith(SVG, { format: "png", resize: { width: 48, height: 48, fit: "exact", allowUpscale: true } }),
    );
    expect(await screen.findByText(/48×48/)).toBeInTheDocument();
    expect(screen.getByText("icon.png")).toBeInTheDocument();
  });

  it("JPEG gets quality and a background", async () => {
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(img.convertImage).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("radio", { name: "JPEG" }));
    expect(screen.getByLabelText("Quality")).toBeInTheDocument();
    expect(screen.getByLabelText("Background colour")).toBeInTheDocument();
    await waitFor(() =>
      expect(img.convertImage).toHaveBeenLastCalledWith(SVG, expect.objectContaining({ format: "jpeg", quality: 85, background: [255, 255, 255] })),
    );
  });

  it("ICO uses the chosen sizes and no resize", async () => {
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(img.convertImage).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("radio", { name: "ICO" }));
    await userEvent.click(screen.getByRole("button", { name: "64" }));
    await waitFor(() => expect(img.convertImage).toHaveBeenLastCalledWith(SVG, { format: "ico", icoSizes: [16, 32, 48, 64, 256] }));
  });

  it("hands the result to Image Resize", async () => {
    const C = tool.component;
    render(<C />);
    await screen.findByText(/48×48/);
    await userEvent.click(screen.getByRole("button", { name: "Resize…" }));
    expect(handoff.sendTo).toHaveBeenCalledWith("image-resize", {
      kind: "images",
      files: [{ name: "icon.png", mime: "image/png", bytes: expect.any(Uint8Array) }],
    });
  });

  it("explains a backend error", async () => {
    img.convertImage.mockRejectedValue(new Error("Couldn't read the image: bad"));
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("Couldn't read the image: bad")).toBeInTheDocument();
  });
});
