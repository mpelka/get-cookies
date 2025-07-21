import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sqlite3 from "sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChromiumCookieDatabase } from "../index.ts";

// Mock all Node.js modules
vi.mock("node:fs");
vi.mock("node:os");

// Mock sqlite3 with a factory function
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

describe("ChromiumCookieDatabase", () => {
  let mockDatabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database instance
    mockDatabase = {
      all: vi.fn(),
      close: vi.fn(),
    };

    // Make Database constructor return our mock
    vi.mocked(sqlite3.Database).mockImplementation(() => mockDatabase);

    // Mock fs functions
    vi.mocked(fs.mkdtempSync).mockReturnValue("/tmp/test-cookies-123");
    vi.mocked(fs.copyFileSync).mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => {});
    vi.mocked(fs.rmdirSync).mockImplementation(() => {});

    // Mock os functions
    vi.mocked(os.tmpdir).mockReturnValue("/tmp");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create temp directory and copy database file", () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      expect(fs.mkdtempSync).toHaveBeenCalledWith(path.join(os.tmpdir(), "chromium-cookies-"));
      expect(fs.copyFileSync).toHaveBeenCalledWith("/original/path/Cookies", "/tmp/test-cookies-123/Cookies.sqlite");
    });

    it("should use custom temp directory if provided", () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies", "/custom/temp/dir");

      expect(fs.mkdtempSync).not.toHaveBeenCalled();
      expect(fs.copyFileSync).toHaveBeenCalledWith("/original/path/Cookies", "/custom/temp/dir/Cookies.sqlite");
    });
  });

  describe("open", () => {
    it("should open database in readonly mode", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      await db.open();

      expect(sqlite3.Database).toHaveBeenCalledWith("/tmp/test-cookies-123/Cookies.sqlite", sqlite3.OPEN_READONLY);
    });
  });

  describe("queryCookies", () => {
    it("should throw error if database not opened", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      await expect(db.queryCookies()).rejects.toThrow("Database not opened");
    });

    it("should query and return cookie rows", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");
      await db.open();

      const mockRows = [
        { host_key: ".example.com", name: "cookie1" },
        { host_key: ".example.com", name: "cookie2" },
      ];

      mockDatabase.all.mockImplementation((sql: string, callback: Function) => {
        callback(null, mockRows);
      });

      const result = await db.queryCookies();

      expect(mockDatabase.all).toHaveBeenCalledWith(
        expect.stringContaining("SELECT host_key, name, value, encrypted_value"),
        expect.any(Function),
      );
      expect(result).toEqual(mockRows);
    });

    it("should handle query errors", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");
      await db.open();

      const mockError = new Error("Query failed");
      mockDatabase.all.mockImplementation((sql: string, callback: Function) => {
        callback(mockError, null);
      });

      await expect(db.queryCookies()).rejects.toThrow("Query failed");
    });
  });

  describe("close", () => {
    it("should close database and cleanup temp files", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");
      await db.open();

      mockDatabase.close.mockImplementation((callback: Function) => {
        callback(null);
      });

      await db.close();

      expect(mockDatabase.close).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/test-cookies-123/Cookies.sqlite");
      expect(fs.rmdirSync).toHaveBeenCalledWith("/tmp/test-cookies-123");
    });

    it("should handle database close errors", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");
      await db.open();

      const closeError = new Error("Close failed");
      mockDatabase.close.mockImplementation((callback: Function) => {
        callback(closeError);
      });

      await expect(db.close()).rejects.toThrow("Close failed");

      // Cleanup won't happen because the error is thrown before reaching cleanup code
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it("should work when database was never opened", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      await db.close();

      // Database close should not be called
      expect(mockDatabase.close).not.toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/test-cookies-123/Cookies.sqlite");
      expect(fs.rmdirSync).toHaveBeenCalledWith("/tmp/test-cookies-123");
    });

    it("should handle temp file cleanup errors gracefully", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        throw new Error("Unlink failed");
      });

      await db.close();

      // rmdirSync won't be called because the error is caught
      expect(fs.rmdirSync).not.toHaveBeenCalled();
    });

    it("should handle missing temp files gracefully", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // tempPath doesn't exist
        .mockReturnValueOnce(false); // tempDir doesn't exist

      await db.close();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(fs.rmdirSync).not.toHaveBeenCalled();
    });

    it("should handle temp directory removal errors", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      vi.mocked(fs.rmdirSync).mockImplementation(() => {
        throw new Error("Rmdir failed");
      });

      await db.close();
    });

    it("should handle when only temp directory exists but not file", async () => {
      const db = new ChromiumCookieDatabase("/original/path/Cookies");

      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false) // tempPath doesn't exist
        .mockReturnValueOnce(true); // tempDir exists

      await db.close();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
      expect(fs.rmdirSync).toHaveBeenCalledWith("/tmp/test-cookies-123");
    });
  });
});
