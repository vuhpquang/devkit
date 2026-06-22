import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClearButton } from "./Toolbar";

describe("ClearButton", () => {
  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<ClearButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
