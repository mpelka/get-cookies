import * as crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptCookieValue } from "../index.ts";

describe("decryptCookieValue", () => {
  // Helper to create test encrypted data
  function createV10EncryptedValue(
    plaintext: string,
    key: Buffer,
    options: { hashPrefix?: boolean; hostKey?: string } = {},
  ): Buffer {
    const iv = Buffer.alloc(16, " ");
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);

    // Add hash prefix if needed
    let data = Buffer.from(plaintext, "utf-8");
    if (options.hashPrefix !== false) {
      const hash = options.hostKey ? crypto.createHash("sha256").update(options.hostKey).digest() : Buffer.alloc(32, 0); // Dummy hash prefix
      data = Buffer.concat([hash, data]);
    }

    // Add PKCS7 padding
    const blockSize = 16;
    const paddingLength = blockSize - (data.length % blockSize);
    const padding = Buffer.alloc(paddingLength, paddingLength);
    const paddedData = Buffer.concat([data, padding]);

    const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

    // Add v10 prefix
    return Buffer.concat([Buffer.from("v10"), encrypted]);
  }

  it("should return null for null buffer", () => {
    const result = decryptCookieValue(null as any, Buffer.from("key"), "example.com");
    expect(result).toBeNull();
  });

  it("should return null for empty buffer", () => {
    const result = decryptCookieValue(Buffer.alloc(0), Buffer.from("key"), "example.com");
    expect(result).toBeNull();
  });

  it("should return null for non-v10 encrypted value", () => {
    const encryptedValue = Buffer.from("v11somedata");
    const result = decryptCookieValue(encryptedValue, Buffer.from("key"), "example.com");

    expect(result).toBeNull();
  });

  it("should decrypt modern v10 cookie with valid SHA256 hash", () => {
    const key = Buffer.from("1234567890123456"); // 16 bytes
    const plaintext = "test cookie value";
    const hostKey = ".example.com";
    const encryptedValue = createV10EncryptedValue(plaintext, key, { hostKey });

    const result = decryptCookieValue(encryptedValue, key, hostKey);

    expect(result).toBe(plaintext);
  });

  it("should decrypt older v10 cookie without valid hash as full content", () => {
    const key = Buffer.from("1234567890123456"); // 16 bytes
    const plaintext = "test cookie value";
    const encryptedValue = createV10EncryptedValue(plaintext, key, {
      hashPrefix: true,
    }); // Dummy hash

    const result = decryptCookieValue(encryptedValue, key, ".different.com");

    // The dummy hash should not match, so we get the full content including the dummy prefix
    expect(result).toContain(plaintext);
    expect(result?.length).toBeGreaterThan(plaintext.length); // Includes the dummy hash bytes
  });

  it("should handle different padding values", () => {
    const key = Buffer.from("1234567890123456");
    const plaintext = "x"; // Short value to test padding
    const hostKey = "example.com";
    const encryptedValue = createV10EncryptedValue(plaintext, key, { hostKey });

    const result = decryptCookieValue(encryptedValue, key, hostKey);

    expect(result).toBe(plaintext);
  });

  it("should handle value without hash prefix", () => {
    const key = Buffer.from("1234567890123456");
    const plaintext = "short"; // Less than 32 bytes
    const encryptedValue = createV10EncryptedValue(plaintext, key, {
      hashPrefix: false,
    });

    const result = decryptCookieValue(encryptedValue, key, "example.com");

    // Should not try to validate hash since length < 32
    expect(result).toBe(plaintext);
  });

  it("should handle decryption errors gracefully", () => {
    const key = Buffer.from("1234567890123456");
    const invalidEncryptedValue = Buffer.concat([
      Buffer.from("v10"),
      Buffer.from("invalid encrypted data that will cause decryption to fail"),
    ]);

    const result = decryptCookieValue(invalidEncryptedValue, key, "example.com");

    expect(result).toBeNull();
  });

  it("should handle buffer too short for v10 prefix", () => {
    const shortBuffer = Buffer.from("v1"); // Only 2 bytes
    const result = decryptCookieValue(shortBuffer, Buffer.from("key"), "example.com");

    expect(result).toBeNull();
  });

  it("should handle zero padding byte", () => {
    const key = Buffer.from("1234567890123456");
    const iv = Buffer.alloc(16, " ");
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);

    // Create data with zero padding byte (invalid padding)
    const hostKey = "example.com";
    const hash = crypto.createHash("sha256").update(hostKey).digest();
    const data = Buffer.concat([hash, Buffer.from("test")]);
    const paddedData = Buffer.concat([data, Buffer.alloc(12, 0)]); // Zero padding

    const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

    const encryptedValue = Buffer.concat([Buffer.from("v10"), encrypted]);
    const result = decryptCookieValue(encryptedValue, key, hostKey);

    // Should handle zero padding by not removing any bytes, includes null bytes
    expect(result).toBe(`test${"\0".repeat(12)}`);
  });

  it("should handle padding value greater than 16", () => {
    const key = Buffer.from("1234567890123456");
    const iv = Buffer.alloc(16, " ");
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);

    // Create data with invalid padding value > 16
    const hostKey = "example.com";
    const hash = crypto.createHash("sha256").update(hostKey).digest();
    const data = Buffer.concat([hash, Buffer.from("test")]);
    const paddedData = Buffer.concat([data, Buffer.alloc(11, 0), Buffer.from([20])]); // Padding byte = 20

    const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

    const encryptedValue = Buffer.concat([Buffer.from("v10"), encrypted]);
    const result = decryptCookieValue(encryptedValue, key, hostKey);

    // Should not remove padding when value > 16
    expect(result).toBeTruthy();
    expect(result).toContain("test");
  });

  it("should handle modern cookie with matching SHA256 hash", () => {
    const key = Buffer.from("1234567890123456");
    const plaintext = "my_secure_token";
    const hostKey = ".github.com";
    const encryptedValue = createV10EncryptedValue(plaintext, key, { hostKey });

    const result = decryptCookieValue(encryptedValue, key, hostKey);

    expect(result).toBe(plaintext);
  });

  it("should handle different host_key producing different hash", () => {
    const key = Buffer.from("1234567890123456");
    const plaintext = "session_token";
    const originalHostKey = ".example.com";
    const wrongHostKey = ".different.com";

    // Encrypt with one host key
    const encryptedValue = createV10EncryptedValue(plaintext, key, {
      hostKey: originalHostKey,
    });

    // Try to decrypt with different host key
    const result = decryptCookieValue(encryptedValue, key, wrongHostKey);

    // Should treat as older format since hash doesn't match
    expect(result).toBeTruthy();
    expect(result).not.toBe(plaintext); // Will include the hash prefix
  });
});
