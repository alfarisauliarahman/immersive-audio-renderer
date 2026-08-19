# Third-Party Notices

Immersive Audio Renderer's project-authored source and documentation are licensed under Apache-2.0. The dependencies and media described below retain their own licenses. This document summarizes direct dependencies and special distribution boundaries; the locked files remain the authoritative version inventory for the complete transitive graph.

## Bundled runtime components

### OpenJOC 0.7.0

- Source: [github.com/chyinan/OpenJOC](https://github.com/chyinan/OpenJOC)
- Use: bundled Windows x86-64 E-AC-3 JOC diagnostic and rendering sidecar.
- License: Apache-2.0.
- Bundled license text: `src-tauri/bin/OPENJOC-LICENSE.txt`.

OpenJOC is an independent clean-room research implementation. Its upstream documentation states that semantic binding remains unresolved. This application must not present its diagnostic reconstruction rows or proxy positions as verified authored object stems or trajectories.

### FFmpeg and ffprobe 8.1

- Upstream source: [FFmpeg n8.1](https://github.com/FFmpeg/FFmpeg/tree/n8.1).
- Build distributor and scripts: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds).
- Package: `ffmpeg-n8.1-latest-win64-lgpl-8.1.zip`.
- Archive SHA-256: `e05564dd43f25170e7532508394fc54d1c52fe7bd19c1773280abf2885039350`.
- Use: bundled unmodified Windows x86-64 sidecars for media probing, ordinary media conversion, channel splitting, stream copy, and labelled codec-core fallback.
- License: LGPL version 3 or later for this selected build.
- Bundled license/provenance: `src-tauri/bin/FFMPEG-LICENSE.txt` and `src-tauri/bin/FFMPEG-BUILD.txt`.

The executable files are release inputs prepared by `scripts/prepare-ffmpeg.ps1` and are intentionally ignored by Git because each exceeds GitHub's normal single-file limit. Their absence from a source checkout does not change their inclusion in the Windows installer.

## Direct application dependencies

Versions below reflect the current lockfiles on 2026-08-19.

| Package/project | Locked version | Purpose | License | Source |
| --- | --- | --- | --- | --- |
| React | 19.2.8 | UI runtime | MIT | [react/react](https://github.com/react/react) |
| React DOM | 19.2.8 | Browser UI rendering | MIT | [react/react](https://github.com/react/react) |
| three.js | 0.179.1 | WebGL 3D rendering | MIT | [mrdoob/three.js](https://github.com/mrdoob/three.js) |
| React Three Fiber | 9.7.0 | React renderer for three.js | MIT | [pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber) |
| Tauri JavaScript API | 2.11.1 | Native command/asset bridge | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Tauri Rust crate | 2.11.5 | Native application runtime | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Tauri dialog plugin | 2.7.2 | Native open/save dialogs | MIT OR Apache-2.0 | [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) |
| Tauri updater plugin | 2.x (lockfile) | Signed update checking and installation | MIT OR Apache-2.0 | [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) |
| Tauri process plugin | 2.x (lockfile) | Restart after update installation | MIT OR Apache-2.0 | [tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) |
| Serde | 1.0.229 | Rust serialization | MIT OR Apache-2.0 | [serde-rs/serde](https://github.com/serde-rs/serde) |
| serde_json | 1.0.151 | JSON parsing/serialization | MIT OR Apache-2.0 | [serde-rs/json](https://github.com/serde-rs/json) |
| serde-yaml-ng | 0.10.0 | DAMF YAML parsing | MIT | [acatton/serde-yaml-ng](https://github.com/acatton/serde-yaml-ng) |

The application includes transitive dependencies of these packages. Review `package-lock.json` and `src-tauri/Cargo.lock` and generate a complete license/SBOM report before distributing binaries.

## Build and test dependencies

| Package/project | Locked version | License | Source |
| --- | --- | --- | --- |
| Tauri CLI | 2.11.4 | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Tauri build crate | 2.6.3 | Apache-2.0 OR MIT | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) |
| Vite | 7.3.6 | MIT | [vitejs/vite](https://github.com/vitejs/vite) |
| Vite React plugin | 5.2.0 | MIT | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| TypeScript | 5.9.3 | Apache-2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |
| Vitest | 3.2.7 | MIT | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |

Type declaration packages and transitive build packages are recorded in `package-lock.json`.

## External system component

### Microsoft Edge WebView2

Tauri uses the installed system WebView2 runtime on Windows. It is not project-authored code and is subject to Microsoft's terms.

## Third-party media and trademarks

Dolby Visualizer WAV, MP3, JSON, screenshots, E-AC-3 JOC samples, DAMF masters, and other test media are not covered by the project's Apache-2.0 license unless a separate file-specific license explicitly says otherwise.

The paired WAV + JSON development material examined by the project originated from [Dolby Atmos Visualizer Music](https://www.dolby.com/atmos-visualizer-music/). Dolby's [Terms of Use](https://www.dolby.com/about/legal/terms-of-use/) govern that site content. Local copies must not be published or bundled without permission. Before this repository is public, remove any such media from the complete Git history.

Dolby, Dolby Atmos, and related marks are trademarks of their respective owners. References in the application and documentation are descriptive interoperability statements only and do not imply affiliation, certification, sponsorship, or endorsement.

## Evaluated but not used

Cavern, dolby-atmos-encoder, DeeZy, and unrelated installer/archive projects discussed during research are not dependencies of this application, and no code from those repositories is represented as part of the implementation.

## Distribution responsibility

A release publisher must verify the license and notice obligations of the exact locked dependency graph and every included binary. This file is not legal advice and does not grant rights to third-party software, patents, trademarks, music, or media.
