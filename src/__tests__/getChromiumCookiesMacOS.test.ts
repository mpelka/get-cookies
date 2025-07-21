import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import sqlite3 from "sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChromiumCookiesMacOS } from "../index.ts";

// Mock node modules
vi.mock("node:os");
vi.mock("node:fs");
vi.mock("node:child_process");

// Mock sqlite3
vi.mock("sqlite3", () => {
  const MockDatabase = vi.fn();
  MockDatabase.prototype.all = vi.fn();
  MockDatabase.prototype.close = vi.fn();

  const mockModule = {
    Database: MockDatabase,
    OPEN_READONLY: 1,
  };

  return {
    default: mockModule,
    ...mockModule, // Also export as named exports
  };
});

// Variable to hold test cookies
let testCookies: any[] = [];

describe("getChromiumCookiesMacOS", () => {
  let mockDatabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    testCookies = []; // Reset test cookies

    // Create mock database instance
    mockDatabase = {
      all: vi.fn((sql, callback) => callback(null, testCookies)),
      close: vi.fn((callback) => callback(null)),
    };

    // Make Database constructor return our mock
    vi.mocked(sqlite3.Database).mockImplementation(() => mockDatabase);

    // Mock OS functions
    vi.mocked(os.platform).mockReturnValue("darwin");
    vi.mocked(os.homedir).mockReturnValue("/Users/testuser");
    vi.mocked(os.tmpdir).mockReturnValue("/tmp");

    // Mock FS functions
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdtempSync).mockReturnValue("/tmp/test-cookies-123");
    vi.mocked(fs.copyFileSync).mockImplementation(() => {});
    vi.mocked(fs.unlinkSync).mockImplementation(() => {});
    vi.mocked(fs.rmdirSync).mockImplementation(() => {});

    // Mock execFile for keychain access
    vi.mocked(child_process.execFile).mockImplementation(((cmd: any, args: any, callback: any) => {
      // Simulate successful keychain fetch
      callback(null, "test_password\n", "");
    }) as any);
  });

  it("should retrieve cookies from Chrome on macOS", async () => {
    testCookies = [
      {
        host_key: ".example.com",
        name: "test_cookie",
        value: "test_value",
        encrypted_value: null,
        path: "/",
        expires_utc: 13350475200000000,
        is_secure: 1,
        is_httponly: 0,
      },
    ];

    const result = await getChromiumCookiesMacOS("chrome");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "test_cookie",
      value: "test_value",
      domain: ".example.com",
      path: "/",
      expires: 1706001600,
      secure: true,
      httpOnly: false,
    });

    // Verify key function calls
    expect(fs.copyFileSync).toHaveBeenCalled();
    expect(child_process.execFile).toHaveBeenCalledWith(
      "security",
      ["find-generic-password", "-w", "-a", "Chrome", "-s", "Chrome Safe Storage"],
      expect.any(Function),
    );
  });

  it("should throw when neither profile nor root path exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false); // All paths don't exist

    await expect(getChromiumCookiesMacOS("chrome", "Profile 1")).rejects.toThrow(
      "Cookies database not found for Google Chrome (Profile: Profile 1)",
    );
  });

  it("should throw when path doesn't exist for non-profile browser", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(getChromiumCookiesMacOS("chrome", "")).rejects.toThrow(
      "Cookies database not found at /Users/testuser/Library/Application Support/Google/Chrome/Cookies",
    );
  });

  it("should filter cookies by domain using smart domain matching", async () => {
    testCookies = [
      {
        host_key: ".github.com",
        name: "github_main",
        value: "value1",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: "github.com",
        name: "github_exact",
        value: "value2",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: ".api.github.com",
        name: "github_api",
        value: "value3",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: ".example.com",
        name: "example_cookie",
        value: "value4",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 0,
        is_httponly: 0,
      },
    ];

    const result = await getChromiumCookiesMacOS("chrome", "Default", "github.com");

    // Should only get github.com cookies, not example.com
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name).sort()).toEqual(["github_exact", "github_main"]);

    // Verify no api.github.com cookies were included
    expect(result.find((c) => c.name === "github_api")).toBeUndefined();
    expect(result.find((c) => c.name === "example_cookie")).toBeUndefined();
  });

  it("should match subdomain cookies when filtering by subdomain", async () => {
    testCookies = [
      {
        host_key: ".api.github.com",
        name: "api_exact_with_dot",
        value: "value1",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: "api.github.com",
        name: "api_exact",
        value: "value2",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: ".github.com",
        name: "github_parent",
        value: "value3",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 1,
        is_httponly: 0,
      },
      {
        host_key: ".other.com",
        name: "other_cookie",
        value: "value4",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 0,
        is_httponly: 0,
      },
    ];

    const result = await getChromiumCookiesMacOS("chrome", "Default", "api.github.com");

    // Should get api.github.com cookies AND parent domain cookies
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.name).sort()).toEqual(["api_exact", "api_exact_with_dot", "github_parent"]);
  });

  it("should handle invalid domain filter gracefully", async () => {
    testCookies = [
      {
        host_key: ".example.com",
        name: "test_cookie",
        value: "test_value",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 0,
        is_httponly: 0,
      },
    ];

    // Invalid domain (no dots) should return all cookies with a warning
    const result = await getChromiumCookiesMacOS("chrome", "Default", "localhost");

    expect(result).toHaveLength(1);
  });

  it("should return empty array when no cookies match domain filter", async () => {
    testCookies = [
      {
        host_key: ".example.com",
        name: "example_cookie",
        value: "value1",
        encrypted_value: null,
        path: "/",
        expires_utc: 0,
        is_secure: 0,
        is_httponly: 0,
      },
    ];

    const result = await getChromiumCookiesMacOS("chrome", "Default", "github.com");

    expect(result).toHaveLength(0);
  });
});
