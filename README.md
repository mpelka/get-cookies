# Get Chromium Cookies

A Node.js library and Command-Line Interface (CLI) to read and decrypt cookies from Chromium-based browsers (like Google Chrome and Chromium) on **macOS**.

It safely copies the cookie database to a temporary location, fetches the necessary decryption key from the macOS Keychain, and parses the cookies, including modern `v10` encrypted values.

> [\!WARNING]
> **Security & Privacy Warning**
>
> This tool is designed to access sensitive user data, including the system's Keychain and the browser's cookie database. It should be used responsibly and with a clear understanding of the security implications. Accessing this data without user consent can be a significant privacy violation.

## Features

  - **Supports Multiple Browsers**: Works with Google Chrome and Chromium.
  - **Keychain Integration**: Automatically fetches the correct decryption key from the macOS Keychain.
  - **Modern Decryption**: Correctly decrypts cookies encrypted with the modern `v10` format, including validation of SHA256 hashes for newer cookies.
  - **Safe & Non-Destructive**: Reads data from a temporary copy of the cookie database, never touching the original file.
  - **Domain Filtering**: Easily fetch cookies for a specific domain.
  - **Profile Support**: Can target specific browser profiles (e.g., "Profile 1", "Default").
  - **Dual Use**: Can be used as a standard Node.js library or as a standalone CLI tool.

## Prerequisites

  - **Operating System**: macOS only.
  - **Node.js**: v18 or later.

## Installation

```bash
npm install @mpelka/get-cookies
```

> [\!NOTE]
> **Keychain Access Prompt**
>
> The first time you run this tool, macOS will prompt you for your user (login) password. This is required to grant the script access to the browser's "Safe Storage" entry in your Keychain.
>
> You may be prompted for your password **twice**: once for the initial access and potentially a second time depending on your system's security settings.

## Usage as a Library

Import the main function and call it with the desired browser ID. It returns a promise that resolves to an array of `Cookie` objects.

```typescript
import { getChromiumCookiesMacOS } from "@mpelka/get-cookies";

async function fetchGitHubCookies() {
  try {
    const cookies = await getChromiumCookiesMacOS(
      "chrome", // Browser ID: 'chrome' or 'chromium'
      "Default", // Profile name, e.g., 'Default' or 'Profile 1'
      "github.com", // Domain to filter for
    );

    console.log("Found cookies:", cookies);
  } catch (error) {
    console.error("Failed to fetch cookies:", error);
  }
}

fetchGitHubCookies();
```

### `getChromiumCookiesMacOS(browserId, profileName?, domainFilter?)`

  - `browserId` (**string**, required): The browser to target. Supported values are `'chrome'` and `'chromium'`.
  - `profileName` (**string**, optional): The name of the browser profile. Defaults to `'Default'`.
  - `domainFilter` (**string**, optional): A domain to filter cookies for (e.g., `'github.com'`). If omitted, all cookies are returned.

## Usage as a CLI

You can also use this tool directly from your terminal.

### Fetching Cookies

Run the command with the domain you want to fetch cookies for.

```bash
npx @mpelka/get-cookies github.com
```

### Specifying Browser and Profile

You can optionally specify the browser and profile name.

```bash
# Use the 'chromium' browser
npx @mpelka/get-cookies google.com chromium

# Use a specific profile named 'Profile 2'
npx @mpelka/get-cookies developer.mozilla.org chrome "Profile 2"
```

The output will be a JSON array of the found cookie objects.

```json
[
  {
    "name": "session_id",
    "value": "...",
    "domain": ".github.com",
    "path": "/",
    "expires": 1735689600,
    "secure": true,
    "httpOnly": true
  }
]
```

## API Reference

### `Cookie` Interface

The `getChromiumCookiesMacOS` function returns an array of objects matching this interface:

```typescript
interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | null; // Unix timestamp or null
  secure: boolean;
  httpOnly: boolean;
}
```

## License

This project is licensed under the **MIT License**. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.