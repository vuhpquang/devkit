import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tool } from "./index";

const BASE = "https://gitlab.example.com";

describe("GitLab tool", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("asks to connect before anything is filled in, with no defaults", () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByText("Connect to GitLab")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://gitlab.example.com")).toHaveValue("");
    expect(screen.getByRole("button", { name: /Load/ })).toBeDisabled();
  });

  it("switches between pipelines and merge requests", async () => {
    const C = tool.component;
    render(<C />);
    expect(screen.getByLabelText("Scan")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Merge requests" }));
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.queryByLabelText("Scan")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("devkit.gitlab")!).tab).toBe("mrs");
  });

  it("keeps Days and Auto refresh separate for each tab", async () => {
    const C = tool.component;
    render(<C />);
    const days = () => screen.getByRole("spinbutton", { name: "Days" });
    fireEvent.change(days(), { target: { value: "7" } });
    await userEvent.selectOptions(screen.getByLabelText("Auto refresh"), "60");
    await userEvent.click(screen.getByRole("radio", { name: "Merge requests" }));
    expect(days()).toHaveValue(30);
    expect(screen.getByLabelText("Auto refresh")).toHaveValue("0");
    await userEvent.click(screen.getByRole("radio", { name: "Pipelines" }));
    expect(days()).toHaveValue(7);
    expect(screen.getByLabelText("Auto refresh")).toHaveValue("60");
    const saved = JSON.parse(localStorage.getItem("devkit.gitlab")!);
    expect([saved.pipelines.days, saved.pipelines.auto, saved.mrs.days, saved.mrs.auto]).toEqual([7, 60, 30, 0]);
  });

  it("loads merge requests with the token as a query parameter", async () => {
    const calls: string[] = [];
    const tokens: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
        calls.push(url);
        tokens.push(init.headers["PRIVATE-TOKEN"]);
        const u = new URL(url);
        const body = u.pathname.endsWith("/merge_requests/")
          ? u.searchParams.get("author_username")
            ? [
                {
                  id: 7,
                  iid: 3,
                  project_id: 1,
                  title: "Add login page",
                  state: "merged",
                  web_url: `${BASE}/team/app/-/merge_requests/3`,
                  references: { full: "team/app!3" },
                  source_branch: "feature/login",
                  target_branch: "main",
                  created_at: "2026-01-01T00:00:00Z",
                  updated_at: "2026-01-02T00:00:00Z",
                  merged_at: "2026-01-01T02:00:00Z",
                  author: { username: "dev" },
                  reviewers: [],
                },
              ]
            : []
          : [];
        return { ok: true, status: 200, json: async () => body };
      }),
    );
    localStorage.setItem("devkit.gitlab", JSON.stringify({ base: BASE, token: "secret", user: "dev", tab: "mrs" }));
    const C = tool.component;
    render(<C />);
    expect(await screen.findByText("Add login page")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/1 merge requests/));
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(tokens.every((t) => t === "secret")).toBe(true);
    expect(calls.every((c) => !c.includes("secret"))).toBe(true);
    expect(calls.every((c) => new URL(c).pathname === "/api/v4/merge_requests/")).toBe(true);
  });

  it("explains a rejected token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    localStorage.setItem("devkit.gitlab", JSON.stringify({ base: BASE, token: "bad", user: "dev", tab: "mrs" }));
    const C = tool.component;
    render(<C />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/token/);
  });
});
