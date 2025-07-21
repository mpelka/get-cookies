import { execFile } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as sqlite3 from "sqlite3";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | null;
  secure: boolean;
  httpOnly: boolean;
}

export interface ChromiumBrowserConfig {
  id: string;
  name: string;
  macOsBaseDir: string;
  keyringAccount: string;
  keyringService: string;
  supportsProfiles: boolean;
}

interface CookieRow {
  host_key: string;
  name: string;
  value: string | null;
  encrypted_value: Buffer | null;
  path: string;
  expires_utc: number;
  is_secure: number;
  is_httponly: number;
}

const CHROMIUM_BROWSERS_CONFIG_MACOS: ChromiumBrowserConfig[] = [
  {
    id: "chrome",
    name: "Google Chrome",
    macOsBaseDir: "Google/Chrome",
    keyringAccount: "Chrome",
    keyringService: "Chrome Safe Storage",
    supportsProfiles: true,
  },
  {
    id: "chromium",
    name: "Chromium",
    macOsBaseDir: "Chromium",
    keyringAccount: "Chromium",
    keyringService: "Chromium Safe Storage",
    supportsProfiles: true,
  },
];

const CRYPTO_CONSTANTS = {
  SALT: Buffer.from("saltysalt"),
  ITERATIONS: 1003,
  KEY_LENGTH: 16,
  ALGORITHM: "aes-128-cbc" as const,
  IV: Buffer.alloc(16, " "),
  V10_PREFIX: "v10",
  HASH_PREFIX_LENGTH: 32,
  MAX_PADDING: 16,
} as const;

const CHROME_EPOCH_DIFF_SECONDS = 11644473600;
const MICROSECONDS_PER_SECOND = 1000000;
const SUPPORTED_CHROMIUM_BROWSERS_MACOS = CHROMIUM_BROWSERS_CONFIG_MACOS.map((b) => b.id);

const SHOW_LOGS = process.env.NODE_ENV === "development";

export class ChromiumCookieDatabase {
  private db: sqlite3.Database | null = null;
  private tempPath: string;

  constructor(
    originalPath: string,
    private tempDir: string = fs.mkdtempSync(path.join(os.tmpdir(), "chromium-cookies-")),
  ) {
    this.tempPath = path.join(tempDir, "Cookies.sqlite");
    fs.copyFileSync(originalPath, this.tempPath);
  }

  async open(): Promise<void> {
    this.db = new sqlite3.Database(this.tempPath, sqlite3.OPEN_READONLY);
  }

  async queryCookies(): Promise<CookieRow[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) throw new Error("Database not opened");
      this.db.all(
        `SELECT host_key, name, value, encrypted_value, path, 
         expires_utc, is_secure, is_httponly FROM cookies`,
        (err, rows) => {
          if (err) {
            if (SHOW_LOGS) console.error("[debug] SQLite query error:", err);
            reject(err);
          } else {
            resolve(rows as CookieRow[]);
          }
        },
      );
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      await new Promise<void>((resolve, reject) => {
        if (!this.db) throw new Error("Database not opened");
        this.db.close((err) => {
          if (err) {
            if (SHOW_LOGS) console.error("[debug] Error closing database:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    // Cleanup temp files
    try {
      if (fs.existsSync(this.tempPath)) {
        fs.unlinkSync(this.tempPath);
      }
      if (fs.existsSync(this.tempDir)) {
        fs.rmdirSync(this.tempDir);
      }
    } catch (e: any) {
      if (SHOW_LOGS) console.error("[debug] Cleanup error:", e.message);
    }
  }
}

export const normalizeDomain = (domain: string): string | null => {
  const cleaned = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/^www\./, "");
  const result = cleaned.includes(".") ? cleaned : null;

  return result;
};

export const isDomainMatch = (hostKey: string, normalizedDomain: string): boolean => {
  const key = hostKey.toLowerCase();
  const matches = key === normalizedDomain || key === `.${normalizedDomain}`;

  return matches;
};

export const generateDomainMatchers = (domain: string): string[] => {
  const matchers: string[] = [];
  const parts = domain.split(".");

  // Add the exact domain
  matchers.push(domain);

  // Add with leading dot
  matchers.push(`.${domain}`);

  // Add parent domains with leading dots
  for (let i = 1; i < parts.length; i++) {
    const parentDomain = parts.slice(i).join(".");
    if (parentDomain.includes(".")) {
      // Ensure it's still a valid domain
      matchers.push(`.${parentDomain}`);
    }
  }

  return matchers;
};

export const getBrowserConfig = (browserId: string): ChromiumBrowserConfig => {
  const config = CHROMIUM_BROWSERS_CONFIG_MACOS.find((b) => b.id === browserId);
  if (!config) {
    throw new Error(`Unsupported browser: ${browserId}. Supported: ${SUPPORTED_CHROMIUM_BROWSERS_MACOS.join(", ")}`);
  }
  return config;
};

export const getBrowserBasePath = (config: ChromiumBrowserConfig): string => {
  return path.join(os.homedir(), "Library", "Application Support", config.macOsBaseDir);
};

export const getCookieDbPath = (basePath: string, profileName: string, supportsProfiles: boolean): string => {
  let dbPath: string;
  if (supportsProfiles && profileName) {
    dbPath = path.join(basePath, profileName, "Cookies");
  } else {
    dbPath = path.join(basePath, "Cookies");
  }

  return dbPath;
};

export const deriveKey = (password: Buffer): Buffer => {
  return crypto.pbkdf2Sync(
    password,
    CRYPTO_CONSTANTS.SALT,
    CRYPTO_CONSTANTS.ITERATIONS,
    CRYPTO_CONSTANTS.KEY_LENGTH,
    "sha1",
  );
};

export const decryptCookieValue = (encryptedValue: Buffer, derivedKey: Buffer, host_key: string): string | null => {
  if (!encryptedValue || encryptedValue.length === 0) {
    return null;
  }

  const version = encryptedValue.slice(0, 3).toString();
  if (version !== CRYPTO_CONSTANTS.V10_PREFIX) {
    // Skipping non-v10 encrypted value
    return null;
  }

  // Attempting to decrypt v10 cookie value...
  try {
    const ciphertext = encryptedValue.slice(3);
    const decipher = crypto.createDecipheriv(CRYPTO_CONSTANTS.ALGORITHM, derivedKey, CRYPTO_CONSTANTS.IV);
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Remove padding
    const paddingLength = decrypted[decrypted.length - 1];
    if (paddingLength > 0 && paddingLength <= CRYPTO_CONSTANTS.MAX_PADDING) {
      decrypted = decrypted.slice(0, -paddingLength);
    }

    // Check for SHA256 hash prefix (modern cookies)
    if (decrypted.length >= CRYPTO_CONSTANTS.HASH_PREFIX_LENGTH) {
      const expectedHash = crypto.createHash("sha256").update(host_key).digest();
      const actualHash = decrypted.slice(0, CRYPTO_CONSTANTS.HASH_PREFIX_LENGTH);

      if (actualHash.equals(expectedHash)) {
        // Modern cookie with valid hash
        decrypted = decrypted.slice(CRYPTO_CONSTANTS.HASH_PREFIX_LENGTH);
      } else {
        // Older format without hash or hash mismatch
      }
    }

    return decrypted.toString("utf-8");
  } catch (e: any) {
    if (SHOW_LOGS) console.warn(`[debug] Decryption failed: ${e.message}`);
    return null;
  }
};

export const transformCookieRow = (row: CookieRow, derivedKey: Buffer | null): Cookie | null => {
  let value = row.value || "";

  // Try to decrypt if needed
  if (!value && row.encrypted_value && row.encrypted_value.length > 0) {
    if (derivedKey) {
      const decrypted = decryptCookieValue(row.encrypted_value, derivedKey, row.host_key);
      if (!decrypted) {
        return null;
      }
      value = decrypted;
    } else {
      return null;
    }
  }

  // Convert Chrome timestamp to Unix timestamp
  let expiresTimestamp: number | null = null;
  if (row.expires_utc > 0) {
    expiresTimestamp = Math.floor(row.expires_utc / MICROSECONDS_PER_SECOND - CHROME_EPOCH_DIFF_SECONDS);
  }

  return {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path,
    expires: expiresTimestamp,
    secure: !!row.is_secure,
    httpOnly: !!row.is_httponly,
  };
};

export const createKeychainFetcher = (execFileFn = execFile) => {
  return (account: string, service: string): Promise<Buffer | null> => {
    return new Promise((resolve) => {
      execFileFn("security", ["find-generic-password", "-w", "-a", account, "-s", service], (error, stdout, stderr) => {
        if (error) {
          if (SHOW_LOGS && stderr?.includes("The specified item could not be found in the keychain")) {
            console.log("[debug] Keychain item not found");
          } else if (SHOW_LOGS) {
            console.error(`[debug] Keychain error: ${stderr || error.message}`);
          }
          resolve(null);
          return;
        }
        resolve(Buffer.from(stdout.trim(), "utf-8"));
      });
    });
  };
};

export async function getChromiumCookiesMacOS(
  browserId: string,
  profileName = "Default",
  domainFilter?: string,
): Promise<Cookie[]> {
  if (os.platform() !== "darwin") {
    throw new Error("This function is designed for macOS only.");
  }

  // Get browser configuration
  const browserConfig = getBrowserConfig(browserId);

  // Normalize domain filter and generate matchers
  const normalizedDomain = domainFilter ? normalizeDomain(domainFilter) : null;
  let domainMatchers: Set<string> | null = null;

  if (domainFilter && !normalizedDomain) {
    if (SHOW_LOGS) console.warn(`[debug] Invalid domain filter: ${domainFilter}`);
  } else if (normalizedDomain) {
    const matchersList = generateDomainMatchers(normalizedDomain);
    domainMatchers = new Set(matchersList);
  }

  // Resolve cookie database path
  const basePath = getBrowserBasePath(browserConfig);
  let cookieDbPath = getCookieDbPath(basePath, profileName, browserConfig.supportsProfiles);

  // Check if path exists, fallback to root if needed
  if (!fs.existsSync(cookieDbPath)) {
    if (browserConfig.supportsProfiles && profileName !== "") {
      const rootPath = getCookieDbPath(basePath, "", false);
      if (fs.existsSync(rootPath)) {
        cookieDbPath = rootPath;
      } else {
        throw new Error(`Cookies database not found for ${browserConfig.name} (Profile: ${profileName})`);
      }
    } else {
      throw new Error(`Cookies database not found at ${cookieDbPath}`);
    }
  }

  // Get keychain password and derive key
  const keychainFetcher = createKeychainFetcher();
  const keychainPassword = await keychainFetcher(browserConfig.keyringAccount, browserConfig.keyringService);

  const derivedKey = keychainPassword ? deriveKey(keychainPassword) : null;

  // Read cookies from database
  const db = new ChromiumCookieDatabase(cookieDbPath);

  try {
    await db.open();
    const rows = await db.queryCookies();
    const cookies = rows
      .filter((row) => !domainMatchers || domainMatchers.has(row.host_key))
      .map((row) => transformCookieRow(row, derivedKey))
      .filter((cookie): cookie is Cookie => cookie !== null);

    return cookies;
  } finally {
    await db.close();
  }
}

if (import.meta.url.startsWith("file://") && process.argv[1] === new URL(import.meta.url).pathname) {
  Promise.all([import("yargs/yargs"), import("yargs/helpers")]).then(([{ default: yargs }, { hideBin }]) => {
    yargs(hideBin(process.argv))
      .command(
        "$0 <domain> [browserId] [profileName]",
        "Fetch Chromium cookies for a given domain on macOS",
        (yargs) => {
          return yargs
            .positional("domain", {
              describe: "The domain to filter cookies for (e.g., github.com)",
              type: "string",
            })
            .positional("browserId", {
              describe: "Browser to read from",
              type: "string",
              default: "chrome",
              choices: SUPPORTED_CHROMIUM_BROWSERS_MACOS,
            })
            .positional("profileName", {
              describe: "Browser profile name",
              type: "string",
              default: "Default",
            });
        },
        (argv) => {
          const { domain, browserId, profileName } = argv as { domain: string; browserId: string; profileName: string };

          console.log(`\nFetching cookies for domain: ${domain}`);
          console.log(`Browser: ${browserId}, Profile: ${profileName}\n`);

          getChromiumCookiesMacOS(browserId, profileName, domain)
            .then((cookies) => {
              console.log("Success! Found", cookies.length, "cookies:\n");
              console.log(JSON.stringify(cookies, null, 2));
            })
            .catch((error) => {
              console.error("Error:", error.message);
              process.exit(1);
            });
        },
      )
      .demandCommand(1, "You must provide a domain.")
      .help()
      .alias("h", "help")
      .strict()
      .parse();
  });
}
