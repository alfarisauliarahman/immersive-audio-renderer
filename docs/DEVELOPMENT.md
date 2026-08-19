# Development Guide

## Prerequisites

The current development target is Windows.

- Node.js and npm compatible with the versions locked in `package-lock.json`.
- A current stable Rust toolchain and Cargo.
- Microsoft C++ build prerequisites required by Tauri on Windows.
- Microsoft Edge WebView2 runtime.
- `ffmpeg.exe` and `ffprobe.exe` available on `PATH` for native media workflows.

OpenJOC 0.7.0 for Windows x86-64 is bundled as a Tauri sidecar in `src-tauri/bin/`. Do not replace that executable without also verifying its version, source, checksum, behavior, and license file.

## Install and run

Install JavaScript dependencies exactly from the lockfile:

```powershell
npm ci
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

## Build

Build the frontend:

```powershell
npm run build
```

Build a portable release executable without producing installer bundles:

```powershell
npm run tauri build -- --no-bundle
```

Installer generation is intentionally outside the current release workflow. Do not modify or publish an installer artifact unless that work is explicitly requested and its signing/distribution implications have been reviewed.

## Repository layout

```text
src/                         React/TypeScript UI, adapters, domain, and hooks
src-tauri/src/               Rust native backend and DAMF implementation
src-tauri/bin/               Bundled OpenJOC sidecar and its license
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
6. Verify whether the chosen external FFmpeg build is distributed or remains a user prerequisite; comply with the exact build's license.
7. Generate hashes for published binaries and scan the artifacts with current security tooling.
8. Confirm README capability claims against the released executable.
9. Update `CHANGELOG.md` and the application version.
10. Keep Dolby and other third-party media out of the release.
