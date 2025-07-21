import * as os from "node:os";
import { describe, expect, it, vi } from "vitest";
import { getBrowserBasePath } from "../index.ts";

vi.mock("node:os", () => ({
  homedir: vi.fn(),
}));

describe("getBrowserBasePath", () => {
  const mockHomedir = vi.mocked(os.homedir);

  it("should construct correct path for Chrome config", () => {
    mockHomedir.mockReturnValue("/Users/testuser");
    const chromeConfig = {
      id: "chrome",
      name: "Google Chrome",
      macOsBaseDir: "Google/Chrome",
      keyringAccount: "Chrome",
      keyringService: "Chrome Safe Storage",
      supportsProfiles: true,
    };

    const result = getBrowserBasePath(chromeConfig);
    expect(result).toBe("/Users/testuser/Library/Application Support/Google/Chrome");
  });

  it("should construct correct path for Chromium config", () => {
    mockHomedir.mockReturnValue("/Users/testuser");
    const chromiumConfig = {
      id: "chromium",
      name: "Chromium",
      macOsBaseDir: "Chromium",
      keyringAccount: "Chromium",
      keyringService: "Chromium Safe Storage",
      supportsProfiles: true,
    };

    const result = getBrowserBasePath(chromiumConfig);
    expect(result).toBe("/Users/testuser/Library/Application Support/Chromium");
  });

  it("should handle different home directories", () => {
    mockHomedir.mockReturnValue("/home/linux-user");
    const config = {
      id: "test",
      name: "Test Browser",
      macOsBaseDir: "Test/Browser",
      keyringAccount: "Test",
      keyringService: "Test Safe Storage",
      supportsProfiles: true,
    };

    const result = getBrowserBasePath(config);
    expect(result).toBe("/home/linux-user/Library/Application Support/Test/Browser");
  });

  it("should handle home directory with spaces", () => {
    mockHomedir.mockReturnValue("/Users/test user");
    const config = {
      id: "test",
      name: "Test Browser",
      macOsBaseDir: "Test Browser",
      keyringAccount: "Test",
      keyringService: "Test Safe Storage",
      supportsProfiles: false,
    };

    const result = getBrowserBasePath(config);
    expect(result).toBe("/Users/test user/Library/Application Support/Test Browser");
  });
});
