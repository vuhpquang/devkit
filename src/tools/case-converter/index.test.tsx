import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
