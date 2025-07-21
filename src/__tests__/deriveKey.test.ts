import { describe, expect, it } from "vitest";
import { deriveKey } from "../index.ts";

describe("deriveKey", () => {
  it("should derive a 16-byte key from password", () => {
    const password = Buffer.from("testpassword", "utf-8");
    const key = deriveKey(password);

    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(16);
  });

  it("should produce deterministic output for same input", () => {
    const password = Buffer.from("testpassword", "utf-8");
    const key1 = deriveKey(password);
    const key2 = deriveKey(password);

    expect(key1.equals(key2)).toBe(true);
  });

  it("should produce different keys for different passwords", () => {
    const password1 = Buffer.from("password1", "utf-8");
    const password2 = Buffer.from("password2", "utf-8");
    const key1 = deriveKey(password1);
    const key2 = deriveKey(password2);

    expect(key1.equals(key2)).toBe(false);
  });

  it("should handle empty password", () => {
    const password = Buffer.from("", "utf-8");
    const key = deriveKey(password);

    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(16);
  });

  it("should handle binary data in password", () => {
    const password = Buffer.from([0x00, 0xff, 0x7f, 0x80]);
    const key = deriveKey(password);

    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(16);
  });

  it("should produce expected output for known input", () => {
    // This tests that the function uses the correct salt, iterations, and algorithm
    const password = Buffer.from("test", "utf-8");
    const key = deriveKey(password);

    // Expected output calculated using the same parameters:
    // salt: "saltysalt", iterations: 1003, keyLength: 16, algorithm: "sha1"
    const expectedHex = "63009c1422826bb1e156c7a1a4f5b5a8";
    expect(key.toString("hex")).toBe(expectedHex);
  });
});
