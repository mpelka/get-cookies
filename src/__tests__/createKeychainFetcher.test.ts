import { describe, expect, it, vi } from "vitest";
import { createKeychainFetcher } from "../index.ts";

describe("createKeychainFetcher", () => {
  it("should return a function", () => {
    const fetcher = createKeychainFetcher();
    expect(typeof fetcher).toBe("function");
  });

  it("should return password buffer on success", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      callback(null, "mypassword\n", "");
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(mockExecFile).toHaveBeenCalledWith(
      "security",
      ["find-generic-password", "-w", "-a", "TestAccount", "-s", "TestService"],
      expect.any(Function),
    );
    expect(result).toEqual(Buffer.from("mypassword", "utf-8"));
  });

  it("should return null when item not found in keychain", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      const error = new Error("Item not found");
      callback(error, "", "The specified item could not be found in the keychain");
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(result).toBeNull();
  });

  it("should return null on other errors", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      const error = new Error("Permission denied");
      callback(error, "", "Permission denied");
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(result).toBeNull();
  });

  it("should handle error without stderr", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      const error = new Error("Unknown error");
      callback(error, "", undefined);
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(result).toBeNull();
  });

  it("should trim whitespace from password", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      callback(null, "  password123  \n\n", "");
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(result).toEqual(Buffer.from("password123", "utf-8"));
  });

  it("should handle empty password", async () => {
    const mockExecFile = vi.fn((cmd, args, callback) => {
      callback(null, "", "");
    });

    const fetcher = createKeychainFetcher(mockExecFile as any);
    const result = await fetcher("TestAccount", "TestService");

    expect(result).toEqual(Buffer.from("", "utf-8"));
  });
});
