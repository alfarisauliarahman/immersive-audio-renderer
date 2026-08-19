# Development Guide

## Prerequisites

The current development target is Windows.

- Node.js and npm compatible with the versions locked in `package-lock.json`.
- A current stable Rust toolchain and Cargo.
- Microsoft C++ build prerequisites required by Tauri on Windows.
- Microsoft Edge WebView2 runtime.
- PowerShell with network access when preparing the pinned FFmpeg release inputs.

OpenJOC 0.7.0 for Windows x86-64 is bundled as a Tauri sidecar in `src-tauri/bin/`. FFmpeg/ffprobe 8.1 LGPL sidecars are reproducibly prepared from the pinned BtbN archive. Do not replace any executable without also verifying its version, source, checksum, behavior, and license file.

## Install and run

Install JavaScript dependencies exactly from the lockfile:

```powershell
npm ci
.\scripts\prepare-ffmpeg.ps1
```

Run the frontend only:

```powershell
npm run dev
```

Run the native desktop shell:

```powershell
npm run tauri dev
```

The development server is fixed to `http://127.0.0.1:1420` by `vite.config.ts` and `src-tauri/tauri.conf.json`.

The dev server may expose locally held fixtures from `dolby_atmos_chat_export/attachments/`. Production builds set Vite's `publicDir` to `false`; changing that release boundary requires a media-provenance and redistribution review.

## Build

Build the frontend:

```powershell
npm run build
```

Build a local release executable without producing installer bundles:

```powershell
npm run tauri build -- --no-bundle
```

Create the signed NSIS installer and updater artifacts by setting `TAURI_SIGNING_PRIVATE_KEY` to the protected updater-key path, setting its password variable when applicable, and running `npm run tauri build`. Never put the private key or password in the repository, shell history, logs, or release assets. Tauri emits the installer and its updater signature below the Cargo target bundle directory.

Build the manual-update portable executable with the portable distribution flag, then pass that executable to `scripts/create-portable-package.ps1`:

```powershell
$env:VITE_DISTRIBUTION = 'portable'
npm run tauri build -- --no-bundle
Remove-Item Env:\VITE_DISTRIBUTION
```

The flag removes the update control and startup update request. Never package the normal installer executable as the portable release.

## Repository layout

```text
src/                         React/TypeScript UI, adapters, domain, and hooks
src-tauri/src/               Rust native backend and DAMF implementation
src-tauri/bin/               Bundled sidecars plus license/provenance files
src-tauri/capabilities/      Tauri command permissions
docs/                        Technical and project documentation
dolby_atmos_chat_export/     Private research context and local fixture area
local-fixtures/              Local-only third-party test media; Git-local ignored
release/                     Local build output; ignored
```

Generated directories such as `node_modules/`, `dist/`, `target/`, `src-tauri/target/`, and `release/` are not source.

## Source adapters

When adding a format, implement it as an adapter that produces the normalized `AudioScene` contract. Do not enable capability flags solely because metadata has object-like identifiers. Each enabled capability must have a verified data path and a test.

In particular:

- visualization JSON does not imply object PCM;
- JOC diagnostic reconstruction rows do not imply authored semantic stems;
- a two-channel render is not a multichannel/object master;
- a filename or brand tag alone is insufficient proof of an Atmos/JOC payload.

Update `docs/FORMAT_SUPPORT.md` in the same change as any source capability.

## Native command conventions

- Pass paths as process arguments; never compose media paths into a shell command.
- Validate selected paths before reading, exporting, or replacing files.
- Use `.partial` or equivalent incomplete output names and promote only completed renders.
- Keep external-process output bounded and return actionable errors to the UI.
- Preserve engine/fallback provenance in cache metadata and UI labels.
- Never silently substitute a codec-core render for a successful JOC render.

## Cache behavior

Prepared files live under the Tauri application cache directory in `prepared-media/`. The cache key is derived from source identity and file metadata. Delete that application cache directory when intentionally testing a cold conversion or render.

DAMF can be disk-bound because the interleaved CAF essence must be streamed even for a single-object solo. Do not diagnose a long cold render as a UI hang until disk activity, output growth, and process state have been checked.

## Dependency updates

For JavaScript dependencies:

```powershell
npm outdated
npm update
npm test
npm run build
```

For Rust dependencies:

```powershell
cargo update --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

Review license changes before committing an updated lockfile. Update `THIRD_PARTY_NOTICES.md` when a direct dependency, bundled binary, source repository, or license changes.

## Release checklist

Before publishing a release:

1. Confirm the worktree contains no private chat export, screenshots, third-party test media, user masters, cache files, or installer archives.
2. Confirm the complete Git history contains no media that cannot be redistributed.
3. Run the automated and manual checks in `docs/TESTING.md`.
4. Build from a clean checkout using locked dependencies.
5. Verify the OpenJOC binary version and bundled Apache-2.0 license.
6. Run `scripts/prepare-ffmpeg.ps1`, verify the pinned archive checksum, and confirm the LGPL license/provenance files are bundled.
7. Build with the protected updater private key and preserve the generated installer signature.
8. Generate `latest.json`, SHA-256 hashes, and scan the artifacts with current security tooling.
9. Install on a clean Windows account, verify sidecars work without system FFmpeg, and exercise the signed update check.
10. Confirm README capability claims against the released executable and update `CHANGELOG.md` plus the application version.
11. Keep Dolby and other third-party media out of both the installer and public binary release channel.
