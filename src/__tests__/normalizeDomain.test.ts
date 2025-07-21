import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../index.ts";

describe("normalizeDomain", () => {
  it("should remove https:// prefix", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("should remove http:// prefix", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("should remove trailing slash", () => {
    expect(normalizeDomain("example.com/")).toBe("example.com");
  });

  it("should remove www. prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("should handle all transformations combined", () => {
    expect(normalizeDomain("https://www.example.com/")).toBe("example.com");
  });

  it("should convert to lowercase", () => {
    expect(normalizeDomain("EXAMPLE.COM")).toBe("example.com");
  });

  it("should trim whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
  });

  it("should return null for invalid domains without dots", () => {
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("invalid")).toBeNull();
  });

  it("should handle domains with subdomains", () => {
    expect(normalizeDomain("https://sub.example.com")).toBe("sub.example.com");
  });

  it("should handle domains with ports", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com:8080");
  });
});
