import { describe, expect, it, vi } from "vitest";
import { isDomainMatch } from "../index.ts";

describe("isDomainMatch", () => {
  it("should match exact domain", () => {
    expect(isDomainMatch("example.com", "example.com")).toBe(true);
  });

  it("should match domain with dot prefix", () => {
    expect(isDomainMatch(".example.com", "example.com")).toBe(true);
  });

  it("should be case insensitive", () => {
    expect(isDomainMatch("EXAMPLE.COM", "example.com")).toBe(true);
    expect(isDomainMatch(".EXAMPLE.COM", "example.com")).toBe(true);
  });

  it("should not match different domains", () => {
    expect(isDomainMatch("other.com", "example.com")).toBe(false);
    expect(isDomainMatch("sub.example.com", "example.com")).toBe(false);
  });
});
