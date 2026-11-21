import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const img = vi.hoisted(() => ({ convertImage: vi.fn(), imageInfo: vi.fn() }));
vi.mock("../../lib/image", async (orig) => ({ ...(await orig<typeof import("../../lib/image")>()), ...img }));

const handoff = vi.hoisted(() => ({ sendTo: vi.fn(), takeHandoff: vi.fn() }));
vi.mock("../../app/handoff", () => handoff);

import { tool } from "./index";

const file = (name: string, mime: string) => ({ name, mime, bytes: new Uint8Array(1000) });

describe("Image Resize", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:thumb");
    URL.revokeObjectURL = vi.fn();
    img.imageInfo.mockReset().mockResolvedValue({ format: "jpeg", width: 1920, height: 1080, hasAlpha: false });
    img.convertImage.mockReset().mockResolvedValue({ bytes: new Uint8Array(400), width: 1280, height: 720 });
    handoff.takeHandoff.mockReset().mockReturnValue({ kind: "images", files: [file("a.jpg", "image/jpeg"), file("b.jpg", "image/jpeg")] });
  });

  it("previews the new size and resizes every image", async () => {
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(screen.getAllByText("1280×720")).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Resize all" }));
    await waitFor(() => expect(img.convertImage).toHaveBeenCalledTimes(2));
    expect(img.convertImage).toHaveBeenCalledWith(expect.any(Uint8Array), {
      format: "jpeg",
      quality: 85,
      resize: { width: 1280, fit: "fit", allowUpscale: false },
    });
    expect(await screen.findByText("a@1280x720.jpg")).toBeInTheDocument();
    expect(screen.getByText("b@1280x720.jpg")).toBeInTheDocument();
    expect(screen.getAllByText("−60 %")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Save all…" })).toBeEnabled();
  });

  it("uses presets and the output format", async () => {
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(img.imageInfo).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole("button", { name: "50 %" }));
    await userEvent.click(screen.getByRole("radio", { name: "WebP" }));
    await waitFor(() => expect(screen.getAllByText("960×540")).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Resize all" }));
    await waitFor(() =>
      expect(img.convertImage).toHaveBeenCalledWith(expect.any(Uint8Array), { format: "webp", quality: 85, resize: { percent: 50, allowUpscale: false } }),
    );
  });

  it("refuses an unsafe suffix and removes rows", async () => {
    const C = tool.component;
    render(<C />);
    await waitFor(() => expect(img.imageInfo).toHaveBeenCalledTimes(2));
    const suffix = screen.getByLabelText("File name suffix");
    await userEvent.clear(suffix);
    await userEvent.type(suffix, "/../x");
    expect(screen.getByRole("button", { name: "Resize all" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Remove a.jpg" }));
    expect(screen.queryByText("a.jpg")).toBeNull();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });

  it("starts empty without a handoff", () => {
    handoff.takeHandoff.mockReturnValue(undefined);
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("Drop images to resize")).toBeInTheDocument();
  });
});
