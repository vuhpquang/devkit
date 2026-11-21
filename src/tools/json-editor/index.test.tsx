import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The real editor is a Svelte app that jsdom can't lay out; a stub keeps the content in memory.
const editors: { props: Record<string, unknown>; content: unknown; destroyed: boolean }[] = [];
vi.mock("vanilla-jsoneditor", () => ({
  Mode: { tree: "tree", text: "text", table: "table" },
  createJSONEditor: ({ props }: { props: Record<string, unknown> }) => {
    const e = { props: { ...props }, content: props.content, destroyed: false };
    editors.push(e);
    return {
      get: () => e.content,
      set: (c: unknown) => {
        e.content = c;
      },
      updateProps: (p: Record<string, unknown>) => Object.assign(e.props, p),
      scrollTo: () => Promise.resolve(),
      destroy: async () => {
        e.destroyed = true;
      },
    };
  },
}));
vi.mock("vanilla-jsoneditor/themes/jse-theme-dark.css", () => ({}));

import { tool } from "./index";

const live = () => editors.filter((e) => !e.destroyed);

describe("JSON Editor tool", () => {
  beforeEach(() => {
    editors.length = 0;
    localStorage.clear();
  });

  it("mounts one editor holding an empty object", () => {
    const C = tool.component;
    render(<C />);
    expect(live()).toHaveLength(1);
    expect(live()[0].content).toEqual({ json: {} });
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("switches to Compare and back, keeping the left editor", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("radio", { name: "Compare" }));
    expect(live()).toHaveLength(2);
    expect(screen.getByText("Left")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Compare" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Edit" }));
    expect(live()).toHaveLength(1);
    expect(screen.getByText("Document")).toBeInTheDocument();
  });

  it("counts the differences of the sample and steps through them", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const C = tool.component;
    render(<C />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("radio", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: /Sample/ }));
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("status")).toHaveTextContent("6 differences");
    await user.click(screen.getByRole("button", { name: "Next difference" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 / 6");
    // the editors got a class callback that highlights the current difference
    const right = live()[1];
    const onClassName = right.props.onClassName as (p: string[]) => string | undefined;
    expect(onClassName(["version"])).toBe("jse-diff-changed jse-diff-current");
    vi.useRealTimers();
  });

  it("copies left to right and reports no differences", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const C = tool.component;
    render(<C />);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByRole("radio", { name: "Compare" }));
    await user.click(screen.getByRole("button", { name: /Sample/ }));
    await user.click(screen.getByRole("button", { name: "Copy left to right" }));
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("status")).toHaveTextContent("No differences");
    vi.useRealTimers();
  });
});
