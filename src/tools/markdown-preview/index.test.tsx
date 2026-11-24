import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const openExternal = vi.fn();
vi.mock("../../lib/openExternal", () => ({ openExternal: (url: string) => openExternal(url) }));

import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Markdown Preview screen", () => {
  it("renders the sample and opens links outside the app", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    const preview = await screen.findByLabelText("Rendered Markdown");
    expect(within(preview).getByRole("heading", { level: 1, name: "DevKit notes" })).toBeInTheDocument();
    expect(within(preview).getByRole("table")).toBeInTheDocument();
    await userEvent.click(within(preview).getByRole("link", { name: "Ha Phung Quang Vu" }));
    expect(openExternal).toHaveBeenCalledWith("https://vuhpquang.com");
  });
});

describe("Markdown Preview saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the Markdown back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(savedValue(tool.id, "source")).toMatch(/^# DevKit notes/);
    first.unmount();
    renderTool(tool.component, tool.id);
    const preview = await screen.findByLabelText("Rendered Markdown");
    expect(within(preview).getByRole("heading", { level: 1, name: "DevKit notes" })).toBeInTheDocument();
  });
});
