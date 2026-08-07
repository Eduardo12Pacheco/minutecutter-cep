# Premiere Pro Extension

Development environment and scaffolding for a Premiere Pro extension.

## Prerequisites (Windows)

Verified versions installed on this machine (2026-08-07):

| Tool | Version | Notes |
|---|---|---|
| Git | 2.55.0.windows.3 | `user.name` / `user.email` configured |
| Node.js | 22.20.0 (system) / 22.23.2 (fnm default) | system install is winget-managed; 22.23.2 was installed via fnm because the winget upgrade requires elevation |
| npm | 11.19.0 | npm@12 requires Node >= 22.22.2; npm@11 is the last line compatible with the system Node 22.20.0 |
| Python | 3.11.9 / 3.13.14 / 3.14.6 | `py` launcher default is 3.14; `python` resolves to 3.11 by PATH order |
| FFmpeg | 9.0 (full) | `Gyan.FFmpeg` |
| VS Code | 1.130.0 | |
| PowerShell | 7.6.4 | |
| Scoop | 0.5.3 | per-user package manager (no admin required) |
| winget | 1.29.280 | |
| UXP Devtools CLI | 1.2.0 | `@adobe/uxp-devtools-cli` (global npm) |

## Target host: Adobe Premiere Pro

- Installed version: **Premiere Pro 2022 (22.5.0)**
- **UXP is NOT supported on Premiere 22.5.** UXP plugins require Premiere **v25.6 or later** (per Adobe: "UXP plugins are supported in Premiere v25.6 and later since UDT v2.2").
- **CEP is supported** on this install (extension folder exists at `%APPDATA%\Adobe\CEP\extensions`).

### Decision: CEP over UXP for this host

| | CEP | UXP |
|---|---|---|
| Works on Premiere 22.5 | Yes | No (requires 25.6+) |
| Runtime | Chromium 85 embedded (CEP 12) | UXP runtime |
| API model | HTML/JS panel + ExtendScript (`$.` / `app` host object) | Modern JS, async |
| Distribution | `.zxp` (signed) or dev mode | `.ccx` |
| Future-proof | Being phased out | Preferred by Adobe for new plugins |

**Recommendation:** build the extension as a **CEP 12 panel** so it works on the installed Premiere Pro. Structure the code so the UI layer can later be ported to UXP when/if the host is upgraded to v25.6+.

## UXP Developer Tool (UDT)

The official GUI tool is **not distributed via winget** and **requires administrator privileges** to run. Install it from Creative Cloud:

1. Open the Adobe Creative Cloud desktop app.
2. Search for **"UXP Developer Tools"** in *All apps*.
3. Click **Install**.

On first launch it prompts to **Enable Developer Mode**, which requests elevated permissions.

### CLI alternative (installed)

The `uxp` CLI (`@adobe/uxp-devtools-cli`) is installed globally and does not require the GUI:

```bash
uxp --help
uxp apps list          # list UXP-capable Adobe apps (needs the dev service running)
uxp plugin load --id <pluginId> <path>
uxp plugin reload --id <pluginId>
uxp plugin unload --id <pluginId>
uxp plugin package --id <pluginId> --destination <outDir>
uxp service start      # starts the UXP dev service (requires admin on Windows)
```

> **Note (Windows):** `uxp service start` and `uxp devtools enable` write to
> `%CommonProgramFiles%\Adobe\UXP\Developer\settings.json` and therefore require an
> **elevated** terminal. Also, `uxp apps list` reports no apps on hosts below UXP 5.0
> (Premiere 22.5 is below that), so this CLI is only usable once a UXP-capable host exists.

## Loading a CEP extension (development mode)

1. Install the plugin into the user extensions folder:

   ```powershell
   New-Item -ItemType Directory -Force "$env:APPDATA\Adobe\CEP\extensions\<com.example.myext>"
   Copy-Item -Recurse -Force .\src "$env:APPDATA\Adobe\CEP\extensions\<com.example.myext>\"
   ```

2. For CEP 12 hosts, enable unsigned-extensions debugging by creating:

   `%APPDATA%\Adobe\CEP\extensions\.debug` containing:

   ```
   <com.example.myext>
   ```

3. Launch Premiere Pro. The panel appears under **Window > Extensions**.

4. During development, reload the extension from the panel's context menu (or restart Premiere).

## Loading a UXP plugin (once host >= 25.6)

```bash
# with the UDT service running (admin terminal):
uxp plugin load --id <pluginId> "C:\dev\premiere-ext"
```

Then open the UXP Developer Tool, select the plugin, and click **Add** / **Load**.

## Project layout

```
premiere-ext/
├── src/                  # extension source (UI + host integration)
├── README.md
└── package.json          # dev/build tooling
```

## Tooling decisions

- **Package manager:** Scoop (per-user, no admin) alongside winget for machine-wide apps.
- **npm:** pinned to the npm@11 line because npm@12 requires Node >= 22.22.2, and the
  system Node is managed by winget (elevated updates only). Use `fnm use 22.23.2` (or
  upgrade Node via winget from an elevated terminal) to unlock npm@12. If you update
  Node to a newer LTS (24.x) or current (26.x), you can then `npm install -g npm@latest`.
- **ffmpeg:** required for media/generation tests on the video side.
