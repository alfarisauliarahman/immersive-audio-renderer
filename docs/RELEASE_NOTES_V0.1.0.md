# Immersive Audio Renderer v0.1.0

Release date: 2026-08-19  
Release title: v0.1  
Platform: Windows x86-64 portable build

## Highlights

- Inspect and preview supported Dolby Atmos Master Filesets (`.atmos`) with authored positions and independently addressable PCM.
- Solo or mute authored DAMF objects, cancel an in-progress variant render, and export the active stereo preview WAV.
- Decode E-AC-3 JOC delivery sources through bundled OpenJOC 0.7.0 to a stereo monitor or exported 5.1/7.1/7.1.4 speaker layout.
- Export one multichannel speaker WAV or separate mono L/R/C/LFE/surround/height speaker feeds.
- Extract an E-AC-3 elementary delivery stream without re-encoding.
- Export all-access-unit OAMD forensic evidence for codec diagnosis and research.
- Inspect ordinary local audio, paired WAV + visualization JSON, live monitor meters, source-layout proxies, loudness estimates, speaker positions, and an interactive 3D room.
- Use keyboard shortcuts for playback, seeking, monitor controls, opening files, and information panels.

## Important boundaries

- This is an independent preview and inspection tool, not Dolby's licensed renderer or a certification system.
- M4A/MP4 E-AC-3 JOC is a compressed delivery master. Speaker-feed exports are decoded renders, not original authored-object stems.
- `*-oamd-forensic.json` is a developer-oriented report. It is not compatible scene metadata and cannot drive playback or object trajectories.
- OpenJOC diagnostic reconstruction rows are not exposed as objects in v0.1.0 because semantic binding remains unresolved.
- DAMF preview audio uses this application's independent stereo panner, make-up gain, and safety compression.
- Live loudness values are monitor estimates, not certified BS.1770 measurements.

## Installation

1. Download `Immersive-Audio-Renderer-v0.1.0-windows-x64-portable.zip` from the GitHub release.
2. Verify its SHA-256 value against the attached checksum file.
3. Extract the complete folder.
4. Ensure `ffmpeg.exe` and `ffprobe.exe` are available on Windows `PATH`.
5. Run `Immersive Audio Renderer.exe`.

The portable executable is built as a Windows GUI application and does not open its own console window. The installer is intentionally not part of this release.

## Verification

- Frontend unit tests: 9 passed.
- Rust unit/integration tests: 7 passed, 1 external multi-gigabyte DAMF fixture test intentionally ignored.
- Production frontend and optimized Tauri release builds completed successfully.
- Real E-AC-3 JOC smoke test produced a 48 kHz six-channel `5.1(side)` float WAV in FL, FR, FC, LFE, Ls, Rs order.
- The 5.1 render was successfully split into six 48 kHz mono float WAV speaker feeds.
- Portable executable subsystem verified as Windows GUI.

## Media and licensing

Project-authored code and documentation use Apache-2.0. OpenJOC is redistributed under Apache-2.0. FFmpeg is an external system prerequisite and its effective license depends on the user's build.

No Dolby website demo media is included in the portable release archive. The repository is private at the time of this release. It must not be made public until non-redistributable media is removed from the complete Git history and the remaining release blockers in [Roadmap](ROADMAP.md) are resolved.
