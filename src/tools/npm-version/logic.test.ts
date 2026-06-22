import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetch } from "@tauri-apps/plugin-http";
import { fetchPackageInfo } from "./logic";

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}));

const mockFetch = vi.mocked(fetch);

beforeEach(() => {
  mockFetch.mockReset();
});

const npmReactResponse = {
  name: "react",
  description: "React is a JavaScript library for building user interfaces.",
  "dist-tags": { latest: "18.2.0" },
  versions: {
    "18.2.0": {},
    "18.1.0": {},
    "17.0.2": {},
  },
  homepage: "https://reactjs.org/",
  license: "MIT",
  author: { name: "React Team" },
  keywords: ["react"],
  time: {
    "18.2.0": "2022-06-14T19:26:53.756Z",
    "18.1.0": "2022-05-22T20:45:25.836Z",
  },
};

describe("fetchPackageInfo", () => {
  it('returns NpmPackageInfo shape for "react"', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => npmReactResponse,
    } as unknown as Response);

    const result = await fetchPackageInfo("react");

    expect(result.name).toBe("react");
    expect(result.latest).toBe("18.2.0");
    expect(result.versions).toContain("18.2.0");
    expect(result.versions).toContain("18.1.0");
    expect(result.versions).toContain("17.0.2");
    expect(result.description).toBe(
      "React is a JavaScript library for building user interfaces."
    );
    expect(result.license).toBe("MIT");
    expect(result.author).toBe("React Team");
    expect(result.publishedAt).toBe("2022-06-14T19:26:53.756Z");
  });

  it("throws when package name is empty", async () => {
    await expect(fetchPackageInfo("")).rejects.toThrow(
      "Package name is required"
    );
    await expect(fetchPackageInfo("   ")).rejects.toThrow(
      "Package name is required"
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws a not-found error when the registry returns 404", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as unknown as Response);

    await expect(
      fetchPackageInfo("nonexistent-pkg-xyz")
    ).rejects.toThrow('Package "nonexistent-pkg-xyz" not found');
  });

  it("throws on other non-ok HTTP statuses", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);

    await expect(fetchPackageInfo("react")).rejects.toThrow(
      "Registry returned status 500"
    );
  });
});
