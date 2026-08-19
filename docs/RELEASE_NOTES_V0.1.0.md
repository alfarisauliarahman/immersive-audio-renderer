# Immersive Audio Renderer v0.1.0

Release date: 2026-08-19  
Release title: v0.1  
Platform: Windows x86-64 installer and portable ZIP

## Highlights

- Inspect and preview supported Dolby Atmos Master Filesets (`.atmos`) with authored positions and independently addressable PCM.
- Solo or mute authored DAMF objects, cancel an in-progress variant render, and export the active stereo preview WAV.
- Decode E-AC-3 JOC delivery sources through bundled OpenJOC 0.7.0 to a stereo monitor or exported 5.1/7.1/7.1.4 speaker layout.
- Export one multichannel speaker WAV or separate mono L/R/C/LFE/surround/height speaker feeds.
- Extract an E-AC-3 elementary delivery stream without re-encoding and export all-access-unit forensic OAMD evidence.
- Inspect ordinary local audio using bundled FFmpeg/ffprobe 8.1 LGPL sidecars.
- Use live monitor meters, source-layout proxies, keyboard shortcuts, an interactive 3D room, and a signed in-app updater.

## Important boundaries

- This is an independent preview and inspection tool, not Dolby's licensed renderer or a certification system.
- M4A/MP4 E-AC-3 JOC is a compressed delivery master. Speaker-feed exports are decoded renders, not original authored-object stems.
- `*-oamd-forensic.json` is a developer-oriented report. It is not compatible scene metadata and cannot drive playback or object trajectories.
- OpenJOC diagnostic reconstruction rows are not exposed as objects because semantic binding remains unresolved.
- DAMF preview audio uses this application's independent stereo panner, make-up gain, and safety compression.
- Live loudness values are monitor estimates, not certified BS.1770 measurements.

## Installation and updates

1. Download the x64 setup executable from the public [binary release channel](https://github.com/alfarisauliarahman/immersive-audio-renderer-releases/releases/tag/v0.1.0).
2. Optionally verify its SHA-256 value against `SHA256SUMS.txt`.
3. Run the installer for the current Windows user, then start **Immersive Audio Renderer**.

The installer contains the application, OpenJOC, FFmpeg, ffprobe, and their notices. A separate codec pack or FFmpeg installation is not required. The application is a Windows GUI program and does not open its own terminal window.

Alternatively, download the `windows-x64-portable.zip`, extract the complete folder, and run `Immersive Audio Renderer.exe`. Keep the included executables and `bin` directory together. The portable updater installs a future release through the normal Windows installer rather than modifying the extracted folder in place.

The native app checks the public binary channel for signed updates. It displays an available version first; download and installation begin only when the user presses the update control. Update artifacts must match the public key embedded in v0.1.0.

## Verification

- Frontend unit tests: 9 passed.
- Rust unit/integration tests: 7 passed, 1 external multi-gigabyte DAMF fixture test intentionally ignored.
- Production frontend and optimized Tauri release builds completed successfully.
- Real E-AC-3 JOC smoke testing produced a 48 kHz six-channel `5.1(side)` float WAV and six mono speaker-feed WAVs.
- Installer, bundled-sidecar, updater signature, and release-manifest checks are recorded in the release process.

## Media and licensing

Project-authored code and documentation use Apache-2.0. OpenJOC is redistributed under Apache-2.0. The selected FFmpeg/ffprobe 8.1 Windows build is redistributed under LGPL-3.0-or-later with its license, source/build-script links, package identity, and archive checksum.

No Dolby website demo media, private chat export, user master, or local test fixture is included in the installer or public binary release. The source repository remains private because its earlier Git history still contains third-party media that must not be publicly redistributed.
