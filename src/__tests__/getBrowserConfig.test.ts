import { describe, expect, it } from "vitest";
import { getBrowserConfig } from "../index.ts";

describe("getBrowserConfig", () => {
  it("should return config for chrome", () => {
    const config = getBrowserConfig("chrome");
    expect(config).toEqual({
      id: "chrome",
      name: "Google Chrome",
      macOsBaseDir: "Google/Chrome",
      keyringAccount: "Chrome",
      keyringService: "Chrome Safe Storage",
      supportsProfiles: true,
    });
  });

  it("should return config for chromium", () => {
    const config = getBrowserConfig("chromium");
    expect(config).toEqual({
      id: "chromium",
      name: "Chromium",
      macOsBaseDir: "Chromium",
      keyringAccount: "Chromium",
      keyringService: "Chromium Safe Storage",
      supportsProfiles: true,
    });
  });

  it("should throw error for unsupported browser", () => {
    expect(() => getBrowserConfig("firefox")).toThrowError("Unsupported browser: firefox. Supported: chrome, chromium");
  });

  it("should throw error for empty string", () => {
    expect(() => getBrowserConfig("")).toThrowError("Unsupported browser: . Supported: chrome, chromium");
  });
});
