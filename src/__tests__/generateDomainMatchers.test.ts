import { describe, expect, it } from "vitest";
import { generateDomainMatchers } from "../index.ts";

describe("generateDomainMatchers", () => {
  it("should generate matchers for top-level domain", () => {
    const result = generateDomainMatchers("github.com");

    expect(result).toEqual(["github.com", ".github.com"]);
  });

  it("should generate matchers for subdomain", () => {
    const result = generateDomainMatchers("sub.example.com");

    expect(result).toEqual(["sub.example.com", ".sub.example.com", ".example.com"]);
  });

  it("should generate matchers for deep subdomain", () => {
    const result = generateDomainMatchers("api.v2.service.example.com");

    expect(result).toEqual([
      "api.v2.service.example.com",
      ".api.v2.service.example.com",
      ".v2.service.example.com",
      ".service.example.com",
      ".example.com",
    ]);
  });

  it("should handle single part domain (TLD only)", () => {
    const result = generateDomainMatchers("localhost");

    expect(result).toEqual(["localhost", ".localhost"]);
  });

  it("should generate matchers for country code TLD", () => {
    const result = generateDomainMatchers("bbc.co.uk");

    expect(result).toEqual(["bbc.co.uk", ".bbc.co.uk", ".co.uk"]);
  });

  it("should handle empty domain parts correctly", () => {
    const result = generateDomainMatchers("example.com");

    expect(result).toEqual(["example.com", ".example.com"]);

    // Should not include just "." or empty strings
    expect(result.every((m) => m.length > 1)).toBe(true);
  });

  it("should generate correct matchers for www subdomain", () => {
    const result = generateDomainMatchers("www.example.com");

    expect(result).toEqual(["www.example.com", ".www.example.com", ".example.com"]);
  });

  it("should handle numeric subdomains", () => {
    const result = generateDomainMatchers("api1.example.com");

    expect(result).toEqual(["api1.example.com", ".api1.example.com", ".example.com"]);
  });

  it("should handle hyphenated domains", () => {
    const result = generateDomainMatchers("my-subdomain.example-site.com");

    expect(result).toEqual(["my-subdomain.example-site.com", ".my-subdomain.example-site.com", ".example-site.com"]);
  });
});
