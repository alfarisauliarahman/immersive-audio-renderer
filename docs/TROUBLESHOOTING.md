# Troubleshooting

## No sound from every newly opened file

Check the system path before changing project code:

1. Confirm Windows detects the intended output device.
2. Open Windows Volume Mixer and verify the application/WebView is routed to that device and is not muted.
3. Disconnect/reconnect the device or restart the Windows audio service/computer if the device disappeared.
4. In the app, set attenuation to `0.00 dB`, turn off DIM, and turn off MUTE.
5. Press Play once after loading; Web Audio may require a user gesture.
6. Test both the packaged application and another known-working application.

If all new sources fail while files played earlier, suspect the current Windows output device or WebView audio route before the media decoder.

## Only one format is silent

Open **SOURCE INFO** and inspect the engine and warning.

- A directly playable WAV should show a PCM codec and valid duration.
- Ordinary compressed media requires FFmpeg preparation.
- E-AC-3 JOC should show OpenJOC output or a labelled codec-core fallback.
- A preparation error means the app should not treat a partial file as playable.

Development builds can verify the bundled or fallback tools directly:

```powershell
ffmpeg -version
ffprobe -version
```

Then inspect the source:

```powershell
ffprobe -v error -show_streams -show_format 'D:\path\source.m4a'
```

## Audio is unexpectedly quiet

- Confirm attenuation is `0.00 dB` and DIM is off.
- Check Windows per-application volume and audio enhancements.
- E-AC-3 delivery material can include dialnorm/dynamic-range behavior; louder is not automatically more correct.
- OpenJOC 2.0 speaker output is distinct from a binaural stream and from Dolby's licensed renderer.
- DAMF full and solo previews already receive automatic +24 dB/+36 dB monitor boost respectively.

Do not normalize source files destructively just to diagnose the monitor. Compare file peak/RMS, app meter values, and system output independently.

## File loads but object controls are disabled

This is usually correct capability gating.

- Ordinary audio contains no object data.
- WAV + JSON contains object visualization but no discrete object PCM.
- M4A/MP4 E-AC-3 JOC provides a delivery render and diagnostic proxy data, not verified authored stems.
- Supported DAMF binds authored PCM and metadata, so it enables solo/mute.

See [Format support and boundaries](FORMAT_SUPPORT.md).

## Room View will not move

- Left-drag inside the Room View to orbit.
- Right-drag to pan.
- Use the wheel to zoom.
- Press reset if the camera moved outside a useful angle.
- Ensure another transparent overlay or browser developer tool is not capturing pointer input.

## DAMF preparation or solo takes a long time

Large DAMF sources are commonly disk-bound. Solo still reads the interleaved CAF essence even though it decodes only the selected channel.

Check:

- source size and whether it is on HDD, SSD, USB, or network storage;
- disk throughput and process I/O, not CPU alone;
- whether a `.partial`/output file is growing;
- whether the requested variant already exists in the cache;
- free space for a stereo float WAV.

Do not start multiple copies of the same render. See [Performance](PERFORMANCE.md).

## DAMF reports missing companion files

Open the `.atmos` manifest, not `.atmos.audio`. Confirm all four files share the same base name and directory. A renamed or incomplete fileset is rejected intentionally.

The current implementation also requires the supported 24-bit interleaved CAF packing. A valid DAMF using an unsupported variant may still fail with an explicit packing/metadata error.

## FFmpeg or ffprobe is not found

The official installer bundles pinned FFmpeg/ffprobe sidecars, so users should not install codec packs or edit `PATH`. Reinstall the latest official build and verify that antivirus software did not quarantine either sidecar. Developers must run `scripts/prepare-ffmpeg.ps1`; development builds fall back to `PATH` only when a prepared sidecar is absent.

## “The scene metadata has an unsupported schema”

The JSON selected with the audio is not a compatible visualization timeline. A file named `*-oamd-forensic.json` is an all-access-unit codec report created by **EXPORT OAMD JSON**; it is not a playable scene and cannot provide object PCM or authored trajectories. Open the M4A/EAC3 source without that report. Only pair audio with a JSON file that follows this application's visualization-timeline schema.

## OpenJOC cannot be located

The development sidecar should exist at:

```text
src-tauri/bin/openjoc-x86_64-pc-windows-msvc.exe
```

A packaged build must place the configured external binary where Tauri can resolve it. Keep `OPENJOC-LICENSE.txt` with distributions. Do not download similarly named executables from unrelated sites.

## A cached result seems stale or incorrect

Close playback, locate the application's Tauri cache directory, and remove only the affected `prepared-media/<source-key>/` entry. Reopen the source to force a cold preparation.

Do not delete an entire user profile or broad cache root. Preserve the original media; prepared output is replaceable, the source master is not.

## Browser development UI differs from the executable

The browser UI at `127.0.0.1:1420` does not have the same native Tauri command environment as the packaged app. Use the installed/native build when testing file dialogs, native paths, FFmpeg/OpenJOC invocation, updates, DAMF rendering, caching, and export.
