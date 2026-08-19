# Immersive Audio Renderer

Independent desktop renderer/inspector for object-based immersive audio. It recreates the workflow and information density of a professional renderer while keeping source provenance and decoder limits explicit.

## Current scope

- Functional React + TypeScript renderer UI, styled after a modern professional Atmos workflow.
- Live 128-input matrix, actual post-monitor stereo meters, an explicitly labelled 7.1.4 scene-proxy view, signal-derived loudness estimates, speaker view, and an orbit/pan/zoom WebGL room.
- Synchronized adapter for the exported Dolby web-demo pair: binaural stereo WAV + precomputed object JSON.
- Browser and native Windows import for local audio or a matching WAV + JSON pair.
- Native `ffprobe` source inspection, conversion cache, and deterministic local playback preparation.
- E-AC-3 JOC/Atmos detection and local 2.0 speaker rendering through the bundled OpenJOC 0.7.0 executable.
- Native Dolby Atmos Master Fileset (`.atmos`) import with companion `.atmos.audio`, `.atmos.metadata`, and `.atmos.dbmd` validation.
- Authored DAMF object trajectories, measured object levels, and independent object solo/mute preview re-renders.
- Fast DAMF solo rendering that decodes only the selected authored channel, cached-full-mix subtraction for mute variants, and WAV export of the active monitor render.
- Source Inspector with codec, profile, sample rate, channel layout, duration, render engine, cache state, and capability boundaries.

The files in `dolby_atmos_chat_export/` are source context and test fixtures. They are intentionally left unchanged.

## Run

```powershell
npm install
npm run dev
```

For the desktop shell:

```powershell
npm run tauri dev
```

The native media path currently requires `ffmpeg.exe` and `ffprobe.exe` on `PATH`. OpenJOC is bundled under `src-tauri/bin/` and retains its Apache-2.0 license in `OPENJOC-LICENSE.txt`.

To create only the release executable (no installer bundle):

```powershell
npm run tauri build -- --no-bundle
```

Prepared audio is cached under the application's local cache directory. Reopening an unchanged source reuses the completed WAV; partial OpenJOC output is never treated as playable.

For DAMF, select the small `.atmos` manifest and keep its three companion files in the same directory. The first open streams the entire multichannel PCM essence and can take several minutes on a hard disk; completed full, solo, and mute variants are cached independently. Solo and mute variants still read the interleaved source essence from disk, but avoid the original all-channel remix cost.

## Important product boundary

The included `atmos-3.wav` is a finished 24-bit/48 kHz binaural stereo render. Its matching `atmos-objects1.json` drives visualization only; it cannot solo, mute, move, or re-render individual objects.

OpenJOC can render the supplied E-AC-3 JOC master to a speaker mix and report its OAMD element count. The current upstream semantic binding is unresolved, so the M4A element dots are deliberately labelled as a position proxy rather than authored trajectories or discrete object stems. Solo, mute, and re-render remain disabled unless a future source adapter exposes trustworthy object PCM and metadata binding.

The live loudness panel is calculated from the actual post-monitor stereo samples. Its LUFS values are useful monitor estimates, but are deliberately not presented as a certified ITU-R BS.1770 measurement. `LIVE 2.0` meters show the audible signal; `SCENE 7.1.4` remains a metadata-derived spatial projection.

A DAMF source is different: its manifest explicitly binds authored bed/object PCM to authored metadata. The app therefore enables real trajectory display, object levels, solo, mute, and re-render for DAMF. Its audible output is still an independent stereo inspection preview using equal-power object panning, automatic monitor make-up gain (+24 dB full mix, +36 dB solo), and compression—not Dolby's licensed renderer or a certification/reference render.

This project is an independent immersive-audio tool and is not affiliated with or endorsed by Dolby Laboratories.
