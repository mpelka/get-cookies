import { describe, expect, it } from "vitest";
import { getCookieDbPath } from "../index.ts";

describe("getCookieDbPath", () => {
  it("should return profile path when supportsProfiles is true and profileName is provided", () => {
    const result = getCookieDbPath("/base/path", "Profile1", true);

    expect(result).toBe("/base/path/Profile1/Cookies");
  });

  it("should return root path when supportsProfiles is false", () => {
    const result = getCookieDbPath("/base/path", "Profile1", false);

    expect(result).toBe("/base/path/Cookies");
  });

  it("should return root path when profileName is empty string", () => {
    const result = getCookieDbPath("/base/path", "", true);

    expect(result).toBe("/base/path/Cookies");
  });

  it("should handle Default profile with supportsProfiles true", () => {
    const result = getCookieDbPath("/base/path", "Default", true);

    expect(result).toBe("/base/path/Default/Cookies");
  });

  it("should handle paths with trailing slashes", () => {
    const result = getCookieDbPath("/base/path/", "Profile1", true);

    expect(result).toBe("/base/path/Profile1/Cookies");
  });

  it("should handle paths with spaces", () => {
    const result = getCookieDbPath("/base/path with spaces", "Profile 1", true);

    expect(result).toBe("/base/path with spaces/Profile 1/Cookies");
  });
});
