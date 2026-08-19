# Changelog

All notable project changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project intends to use [Semantic Versioning](https://semver.org/) once releases stabilize.

## Unreleased

No changes yet.

## 0.1.0 - 2026-08-19

### Added

- Complete architecture, format-boundary, development, testing, fixture, performance, roadmap, contribution, security, licensing, and third-party documentation.
- Keyboard shortcuts for transport, seeking, monitor controls, source opening, and information panels, with an in-app reference.
- Transactional E-AC-3 elementary-stream extraction from native JOC sources without re-encoding.
- Transactional all-access-unit OpenJOC OAMD forensic JSON export.
- OpenJOC speaker rendering to a source-matched multichannel WAV or separate mono speaker-feed WAV files.
- Source-layout-aware scene proxy meters while retaining an honest `LIVE 2.0` audible-monitor view.
- Cooperative cancellation for DAMF SOLO/MUTE renders and a console-free Windows release executable.
- Tauri + React desktop renderer interface with 128-input overview, speaker view, interactive 3D room, transport, source inspector, and timeline.
- Live post-monitor stereo meters and signal-derived loudness estimates.
- Native media probing and stereo preparation through ffprobe/FFmpeg.
- Bundled OpenJOC 0.7.0 path for E-AC-3 JOC diagnostics and 2.0 rendering, with labelled codec-core fallback.
- Native DAMF fileset validation, authored trajectory extraction, independent stereo preview rendering, object solo/mute variants, caching, and WAV export.
- Browser and native WAV + JSON visualization-timeline adapter.
- Demand-rendered Room View and bounded playback/meter update rates.

### Changed

- Clarified the distinction between authored DAMF objects, OpenJOC diagnostic proxies, ordinary audio, and WAV + JSON visualization timelines.
- Documented that Dolby website media is local test material and is not licensed for redistribution by this project.
