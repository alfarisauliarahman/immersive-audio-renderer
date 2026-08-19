# Immersive Audio Renderer

Immersive Audio Renderer is an independent Windows desktop application for inspecting and previewing object-based audio sources. It combines a dense renderer-style interface with explicit source capabilities: authored DAMF objects are treated differently from delivery bitstreams, ordinary channel audio, and visualization-only metadata.

This is an inspection and preview tool. It is not Dolby's licensed renderer, is not a mastering or certification system, and is not affiliated with or endorsed by Dolby Laboratories.

## What works

- Native Dolby Atmos Master Fileset (`.atmos`) loading with `.atmos.audio`, `.atmos.metadata`, and `.atmos.dbmd` companion validation.
- Authored DAMF trajectories, object levels, object solo/mute preview renders, stereo monitor export, and render caching.
- E-AC-3 JOC sources in M4A/MP4 or raw EC-3 containers through the bundled OpenJOC 0.7.0 command-line renderer.
- Lossless container-level extraction of an E-AC-3 elementary stream, forensic OAMD JSON, and decoded speaker-feed export as multichannel or split mono WAV.
- Ordinary WAV, FLAC, MP3, AAC, Ogg, and Opus inspection and stereo preparation through the bundled FFmpeg/ffprobe build.
- Paired stereo WAV + object-timeline JSON playback for visualizer-style datasets.
- Live post-monitor stereo meters, signal-derived loudness estimates, 128-input overview, speaker view, and an interactive orbit/pan/zoom WebGL room.
- Capability-aware controls: solo, mute, and re-render are enabled only when independently addressable authored PCM is available.

See [Format support and boundaries](docs/FORMAT_SUPPORT.md) for the exact matrix.

## Quick start

For normal use, download and run the Windows installer. It includes OpenJOC, FFmpeg, and ffprobe; no separate codec setup or `PATH` editing is required. Windows WebView2 is also required and is normally already installed on supported Windows systems. The signed updater checks the public [release channel](https://github.com/alfarisauliarahman/immersive-audio-renderer-releases/releases) when the native app starts.

Development additionally requires Node.js/npm and a current stable Rust toolchain. Prepare the pinned FFmpeg sidecars before running or packaging the native application:

```powershell
.\scripts\prepare-ffmpeg.ps1
```

Install and run the browser development UI:

```powershell
npm install
npm run dev
```

Run the native Tauri application:

```powershell
npm run tauri dev
```

Build the frontend and unsigned local application executable without creating an installer:

```powershell
npm run build
npm run tauri build -- --no-bundle
```

Run tests:

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

Some native integration tests require locally held media fixtures. See [Testing](docs/TESTING.md) and [Local fixtures](docs/LOCAL_FIXTURES.md).

## How source types differ

| Source | Audible path | Position display | Object solo/mute |
| --- | --- | --- | --- |
| DAMF `.atmos` fileset | Independent stereo preview renderer | Authored trajectory | Yes |
| E-AC-3 JOC delivery master | OpenJOC speaker render (2.0 monitor; 2.0/5.1/7.1/7.1.4 export), with FFmpeg core fallback | Diagnostic proxy only | No |
| Stereo WAV + timeline JSON | Finished stereo audio | Supplied visualization timeline | No |
| Ordinary local audio | FFmpeg-prepared or directly playable stereo | None | No |

An M4A Atmos delivery master may expose an E-AC-3 bitstream and diagnostic metadata, but it cannot reconstruct the original DAMF, lossless authored trajectories, or independently addressable object stems. The Source Inspector can export the delivery bitstream, a developer-oriented forensic OAMD report, and OpenJOC-rendered speaker feeds. The OAMD report is not a playable scene JSON and must not be paired with audio in the Open dialog. Split L/R/C/LFE/etc. files are decoded speaker outputs—not recovered object stems. See [Format support and boundaries](docs/FORMAT_SUPPORT.md).

## Repositories actually used

Only the following upstream projects are direct foundations of this codebase. Repositories previously evaluated but not integrated are intentionally omitted.

| Project | Use in this application | License |
| --- | --- | --- |
| [OpenJOC](https://github.com/chyinan/OpenJOC) | Bundled E-AC-3 JOC inspection and 2.0 rendering | Apache-2.0 |
| [Tauri](https://github.com/tauri-apps/tauri) | Native desktop shell and Rust/JavaScript bridge | MIT or Apache-2.0 |
| [Tauri plugins workspace](https://github.com/tauri-apps/plugins-workspace) | Native open/save dialogs | MIT or Apache-2.0 |
| [React](https://github.com/react/react) | User interface | MIT |
| [three.js](https://github.com/mrdoob/three.js) | WebGL 3D scene | MIT |
| [React Three Fiber](https://github.com/pmndrs/react-three-fiber) | React integration for three.js | MIT |
| [Serde](https://github.com/serde-rs/serde), [serde_json](https://github.com/serde-rs/json), [serde-yaml-ng](https://github.com/acatton/serde-yaml-ng) | Rust manifest, metadata, and timeline parsing | MIT and/or Apache-2.0; see notices |
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) / [BtbN builds](https://github.com/BtbN/FFmpeg-Builds) | Bundled pinned Windows x86-64 LGPL `ffmpeg`/`ffprobe` sidecars | LGPL-3.0-or-later for the selected build; see notices |
| [Vite](https://github.com/vitejs/vite), [TypeScript](https://github.com/microsoft/TypeScript), and [Vitest](https://github.com/vitest-dev/vitest) | Development, build, and tests | MIT or Apache-2.0 |

The complete locked dependency graphs are recorded in `package-lock.json` and `src-tauri/Cargo.lock`. Direct dependency versions and redistribution notes are in [Third-party notices](THIRD_PARTY_NOTICES.md).

## Media provenance

The stereo WAV + JSON development pair originated from the official [Dolby Atmos Visualizer Music](https://www.dolby.com/atmos-visualizer-music/) experience. That WAV is a finished two-channel render and the JSON is a separate visualization timeline; neither is an Atmos master.

Dolby website media is not covered by this project's Apache-2.0 license. Local copies are for private testing only and must not be committed, published, or included in a release without permission from the rightsholder. The local fixture inventory and isolation rules are documented in [Local fixtures](docs/LOCAL_FIXTURES.md). Before making this repository public, all third-party media already present in Git history must be removed from the complete history.

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Format support and boundaries](docs/FORMAT_SUPPORT.md)
- [User guide](docs/USER_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Development](docs/DEVELOPMENT.md)
- [Testing](docs/TESTING.md)
- [Local fixtures](docs/LOCAL_FIXTURES.md)
- [Performance](docs/PERFORMANCE.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md)
- [Security policy](SECURITY.md)
- [Privacy](PRIVACY.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Changelog](CHANGELOG.md)
- [v0.1.0 release notes](docs/RELEASE_NOTES_V0.1.0.md)

## License and trademarks

Project-authored source code and documentation are licensed under the [Apache License 2.0](LICENSE). Third-party components and media retain their own licenses and are described separately in [Third-party notices](THIRD_PARTY_NOTICES.md).

Dolby, Dolby Atmos, and related marks are trademarks of their respective owners. Their use here describes file formats and interoperability only; it does not imply certification, affiliation, sponsorship, or endorsement.
