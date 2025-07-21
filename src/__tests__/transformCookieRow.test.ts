import { describe, expect, it } from "vitest";
import { transformCookieRow } from "../index.ts";

describe("transformCookieRow", () => {
  it("should transform a plain text cookie", () => {
    const row = {
      host_key: ".example.com",
      name: "session_id",
      value: "abc123",
      encrypted_value: null,
      path: "/",
      expires_utc: 13350475200000000, // Chrome timestamp
      is_secure: 1,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, null);

    expect(result).toEqual({
      name: "session_id",
      value: "abc123",
      domain: ".example.com",
      path: "/",
      expires: 1706001600, // Converted Unix timestamp
      secure: true,
      httpOnly: false,
    });
  });

  it("should handle null value with no encryption", () => {
    const row = {
      host_key: "example.com",
      name: "empty_cookie",
      value: null,
      encrypted_value: null,
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, null);

    expect(result).toEqual({
      name: "empty_cookie",
      value: "",
      domain: "example.com",
      path: "/",
      expires: null,
      secure: false,
      httpOnly: false,
    });
  });

  it("should skip encrypted cookie without decryption key", () => {
    const row = {
      host_key: ".example.com",
      name: "encrypted_cookie",
      value: null,
      encrypted_value: Buffer.from("v10encrypted"),
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, null);

    expect(result).toBeNull();
  });

  it("should handle zero expires_utc", () => {
    const row = {
      host_key: "example.com",
      name: "session",
      value: "xyz",
      encrypted_value: null,
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, null);

    expect(result?.expires).toBeNull();
  });

  it("should handle negative expires_utc", () => {
    const row = {
      host_key: "example.com",
      name: "session",
      value: "xyz",
      encrypted_value: null,
      path: "/",
      expires_utc: -1,
      is_secure: 0,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, null);

    expect(result?.expires).toBeNull();
  });

  it("should prefer plaintext value over encrypted when both exist", () => {
    const row = {
      host_key: "example.com",
      name: "mixed_cookie",
      value: "plaintext",
      encrypted_value: Buffer.from("encrypted"),
      path: "/",
      expires_utc: 0,
      is_secure: 1,
      is_httponly: 1,
    };

    const result = transformCookieRow(row, Buffer.from("key"));

    // decryptCookieValue should not be called when plaintext value exists
    expect(result?.value).toBe("plaintext");
  });

  it("should handle empty encrypted_value buffer", () => {
    const row = {
      host_key: "example.com",
      name: "empty_encrypted",
      value: "",
      encrypted_value: Buffer.alloc(0),
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const result = transformCookieRow(row, Buffer.from("key"));

    expect(result).toEqual({
      name: "empty_encrypted",
      value: "",
      domain: "example.com",
      path: "/",
      expires: null,
      secure: false,
      httpOnly: false,
    });
  });

  it("should handle properly encrypted v10 cookie with valid key", () => {
    // Create a properly encrypted test value using the same algorithm
    const crypto = require("node:crypto");
    const plaintext = "test_value";
    const key = Buffer.from("1234567890123456"); // 16 bytes for AES-128
    const iv = Buffer.alloc(16, " ");
    const hostKey = ".example.com";

    // Encrypt the value similar to how Chrome does it
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    cipher.setAutoPadding(false);

    // Add proper SHA256 hash prefix for the host_key
    const hash = crypto.createHash("sha256").update(hostKey).digest();
    const data = Buffer.concat([hash, Buffer.from(plaintext, "utf-8")]);
    const paddingLength = 16 - (data.length % 16);
    const padding = Buffer.alloc(paddingLength, paddingLength);
    const paddedData = Buffer.concat([data, padding]);

    const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

    const v10EncryptedValue = Buffer.concat([Buffer.from("v10"), encrypted]);

    const row = {
      host_key: hostKey,
      name: "encrypted_cookie",
      value: null,
      encrypted_value: v10EncryptedValue,
      path: "/",
      expires_utc: 13350475200000000,
      is_secure: 1,
      is_httponly: 1,
    };

    const result = transformCookieRow(row, key);

    expect(result).toEqual({
      name: "encrypted_cookie",
      value: plaintext,
      domain: ".example.com",
      path: "/",
      expires: 1706001600,
      secure: true,
      httpOnly: true,
    });
  });

  it("should return null for invalid encrypted cookie", () => {
    const row = {
      host_key: ".example.com",
      name: "bad_encrypted",
      value: null,
      encrypted_value: Buffer.from("v10invaliddata"),
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const key = Buffer.from("1234567890123456");
    const result = transformCookieRow(row, key);

    expect(result).toBeNull();
  });

  it("should handle non-v10 encrypted values", () => {
    const row = {
      host_key: ".example.com",
      name: "old_encrypted",
      value: null,
      encrypted_value: Buffer.from("v11somedata"),
      path: "/",
      expires_utc: 0,
      is_secure: 0,
      is_httponly: 0,
    };

    const key = Buffer.from("1234567890123456");
    const result = transformCookieRow(row, key);

    expect(result).toBeNull();
  });
});
