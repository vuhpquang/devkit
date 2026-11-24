import { beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderTool, savedValue } from "../../test/renderTool";
import { tool } from "./index";

describe("Case Converter screen", () => {
  it("converts the sample into every case", async () => {
    const C = tool.component;
    render(<C />);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(await screen.findByText("xmlHttpRequestUserIdForĐườngPhố")).toBeInTheDocument();
    expect(screen.getByText("xml_http_request_user_id_for_đường_phố")).toBeInTheDocument();
    expect(screen.getByText("8 words")).toBeInTheDocument();
  });
});

describe("Case Converter saved input", () => {
  beforeEach(() => localStorage.clear());

  it("brings the input back after a relaunch", async () => {
    const first = renderTool(tool.component, tool.id);
    await userEvent.click(screen.getByRole("button", { name: /Sample/ }));
    expect(savedValue(tool.id, "input")).toBe("XMLHttpRequest user_id for Đường Phố");
    first.unmount();
    renderTool(tool.component, tool.id);
    expect(await screen.findByText("xmlHttpRequestUserIdForĐườngPhố")).toBeInTheDocument();
  });
});
