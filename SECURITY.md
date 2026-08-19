# Security Policy

## Supported versions

The project is currently pre-release. Security fixes target the latest commit on `main`; older development snapshots are not supported.

| Version | Supported |
| --- | --- |
| Latest `main` / 0.1.x | Yes |
| Older snapshots | No |

## Reporting a vulnerability

Use GitHub's private vulnerability reporting or Security Advisory interface for this repository. If private reporting is unavailable, open a minimal issue requesting a private contact channel without including exploit details, malicious files, personal data, copyrighted masters, or credentials.

Include:

- affected commit/version and operating system;
- source type and the smallest safe reproduction steps;
- observed and expected behavior;
- security impact;
- logs with personal paths, tokens, and media names redacted;
- whether the issue requires a crafted local file, external executable, or user interaction.

Do not publish a working exploit before a fix and coordinated disclosure date are available.

## Security boundaries

The application processes untrusted local media and metadata and launches selected external tools. Important boundaries include:

- YAML/JSON and container parsing;
- DAMF companion-path and PCM-size arithmetic;
- Tauri local asset access;
- the bundled FFmpeg/ffprobe and OpenJOC sidecars;
- signed update metadata, release assets, and updater-key custody;
- export destinations and cache replacement;
- Web Audio loading of local asset-protocol URLs.

The application is not a sandbox. Do not open hostile media on a machine containing sensitive data. Keep the application, WebView2, the operating system, and project dependencies updated.

## Untrusted binaries

Installers, codec packs, password-protected archives, and executables found beside test media are not dependencies. Do not run them. Intentional sidecars are OpenJOC plus the pinned LGPL FFmpeg/ffprobe build documented under `src-tauri/bin/`; each is accompanied by license and provenance information.

## Release signing

Installed-distribution updates are accepted only when their updater artifact matches the public key embedded in the application. The portable distribution does not invoke the updater and must be replaced manually. The private updater key must remain outside the repository and be backed up securely. Losing it requires a manual installer migration to a release carrying a new public key; disclosure requires immediate key rotation and incident review. A GitHub tag or checksum alone is not a substitute for the updater signature.

## Sensitive and copyrighted files

Never attach commercial masters, private chat exports, access tokens, or non-redistributable website media to a public vulnerability report. Use a generated minimal fixture or provide hashes and structural diagnostics privately.
