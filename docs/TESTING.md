# Testing Guide

## Test layers

The project uses four validation layers:

1. TypeScript unit tests for scene construction and interpolation.
2. Rust unit tests for probing helpers, DAMF parsing/render math, and cache-facing logic.
3. Build checks for the browser bundle and Tauri executable.
4. Manual playback, interaction, and source-capability checks with local media.

## Automated commands

Run frontend tests:

```powershell
npm test
```

Run the production frontend build and TypeScript checks:

```powershell
npm run build
```

Run Rust tests:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Prepare bundled tools and build the signed NSIS installer (release credentials required):

```powershell
.\scripts\prepare-ffmpeg.ps1
$env:TAURI_SIGNING_PRIVATE_KEY = 'C:\secure\immersive-audio-renderer.key'
npm run tauri build
```

Run all commands from the repository root. A green unit-test run is not a substitute for playing real audio through the packaged executable.

## Fixture-dependent tests

The current backend probe integration tests use local WAV and E-AC-3 JOC fixtures from the private development area. If those files are absent in a clean public checkout, either supply equivalent authorized fixtures locally or skip only the fixture-dependent tests while retaining all self-contained unit tests.

The ignored DAMF integration test uses:

```powershell
$env:DAMF_TEST_PATH = 'D:\authorized-fixtures\Example.atmos'
$env:DAMF_TEST_CACHE = 'D:\authorized-fixtures\cache'
cargo test --manifest-path src-tauri/Cargo.toml prepares_external_damf_fixture -- --ignored --nocapture
```

The source must be a complete authorized DAMF fileset. Do not commit it or its generated cache.

## Manual acceptance matrix

### Application shell

- The NSIS installer completes for the current user and creates no console window when the app starts.
- `ffmpeg`, `ffprobe`, and OpenJOC sidecars work after installation even when no system FFmpeg is on `PATH`.
- The installer contains no local fixture, Dolby website media, screenshot, chat export, or user master.
- The update control checks the public channel, rejects invalid signatures, and installs a valid newer signed artifact only after confirmation.
- The portable build has no update control and makes no startup request to the update endpoint.
- The UI remains usable at the configured minimum window size.
- Source Inspector opens/closes and accurately reflects source, engine, cache state, and warnings.
- Room View drag orbits, right-drag pans, wheel zooms, and reset restores the home camera.
- Idle Room View does not continuously redraw.
- The shortcut panel lists every implemented key and `Escape` closes it.
- Shortcuts do not fire while a form control or button has focus.

### Transport and monitor

- Play/pause, stop, rewind, and timeline seeking remain synchronized.
- DIM applies a 20 dB monitor reduction.
- MUTE silences the audible signal and live meters.
- Global attenuation changes the post-monitor signal.
- Meter values move only when actual audio is present.
- Reloading a new source does not leave the previous source, object URL, or audio graph connected.

### Ordinary audio

- Supported PCM WAV opens directly.
- MP3/FLAC/AAC/Ogg/Opus sources prepare through FFmpeg.
- A failed or unsupported conversion produces a visible error and no partial playable cache entry.
- Reopening an unchanged prepared source reports a cache hit.

### WAV + JSON

- Audio and timeline duration are plausibly aligned.
- Object movement follows playback time.
- Removing JSON leaves audio playable but removes object visualization.
- Solo, mute, and re-render remain disabled.

### E-AC-3 JOC

- ffprobe reports E-AC-3 and an Atmos/JOC profile before the OpenJOC path is selected.
- A successful OpenJOC render is labelled as OpenJOC 2.0 speaker output.
- A failed JOC render falls back only when FFmpeg succeeds and is visibly labelled codec-core fallback.
- Diagnostic dots are labelled as proxies.
- Object solo, mute, and authored re-render remain disabled.
- `.eac3` extraction produces a nonempty E-AC-3 elementary stream with the original stream duration and codec.
- OAMD export produces valid JSON and remains labelled forensic-only.
- Reopening an OAMD forensic report as a scene fails closed; documentation directs the user to open the audio source without it.
- A 5.1 speaker render probes as six-channel float WAV in FL, FR, FC, LFE, Ls, Rs order.
- Split speaker export produces six mono WAV files for a 5.1 target and never labels them object stems.
- Cancelling a DAMF SOLO/MUTE job removes its partial WAV and keeps the prior monitor active.
- Cancelling either save dialog creates no output.

### DAMF

- Missing or mismatched companion files fail with an actionable error.
- Authored positions and object levels appear.
- Full render, solo, and mute create distinct cached WAV files.
- Solo isolates the selected authored PCM channel.
- Mute removes the selected contribution from the full preview.
- Switching variants preserves or restores the transport time where possible.
- Exported WAV matches the currently selected monitor variant.

## Audio validation

For every generated WAV, verify at least:

```powershell
ffprobe -v error -show_streams -show_format output.wav
```

Check sample rate, channel count, duration, codec, nonzero file size, and absence of truncation. For regression work, also compute a SHA-256 hash and objective peak/RMS measurements. Do not compare this application's DAMF preview against a licensed reference render as if bit equality were expected; compare behavioral invariants and clearly defined signals.

## Performance measurements

Record cold and warm cases separately:

- source size and storage device;
- render type: full, solo, or mute;
- wall-clock time;
- average and peak CPU;
- working set;
- bytes read/written;
- GPU utilization while playing and while idle.

See [Performance](PERFORMANCE.md) for interpretation.
