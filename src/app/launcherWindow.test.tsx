import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Launcher } from "./LauncherWindow";

function fakeBridge() {
  let shown: (() => void) | undefined;
  return {
    open: vi.fn(),
    hide: vi.fn(),
    onShow: (cb: () => void) => {
      shown = cb;
      return () => (shown = undefined);
    },
    show: () => act(() => shown?.()),
  };
}

describe("⌥Space launcher window", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("searches and asks the main window to open the chosen tool", () => {
    const bridge = fakeBridge();
    render(<Launcher bridge={bridge} />);
    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "yaml" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(bridge.open).toHaveBeenCalledWith({ toolId: "json-yaml" });
    expect(bridge.hide).toHaveBeenCalled();
  });

  it("hides on Esc and on a click outside the panel", () => {
    const bridge = fakeBridge();
    const { container } = render(<Launcher bridge={bridge} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(bridge.hide).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(container.firstElementChild!);
    expect(bridge.hide).toHaveBeenCalledTimes(2);
  });

  it("starts empty again each time it's shown", () => {
    const bridge = fakeBridge();
    render(<Launcher bridge={bridge} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "yaml" } });
    bridge.show();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("passes a clipboard suggestion's text and mode on", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { readText: vi.fn(async () => "aGVsbG8gZGV2a2l0") } });
    const bridge = fakeBridge();
    render(<Launcher bridge={bridge} />);
    await screen.findByText("From clipboard");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(bridge.open).toHaveBeenCalledWith({ toolId: "base64", text: "aGVsbG8gZGV2a2l0", mode: "decode" });
  });
});
