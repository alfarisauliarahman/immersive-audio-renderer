# Privacy

## Summary

Immersive Audio Renderer is designed to process selected media locally. The project-authored application code does not include an account system, advertising, analytics, telemetry, cloud upload, or a project-operated network service.

This statement describes the current project source. Operating-system components and separately installed third-party tools remain subject to their own behavior and terms.

## Data the application reads

The application reads files the user explicitly selects and, for DAMF, expected same-directory companion files sharing the selected manifest's base name. Depending on the source, this can include:

- audio/container metadata through ffprobe;
- audio samples through FFmpeg, OpenJOC, or the native DAMF reader;
- JSON visualization timelines;
- DAMF YAML metadata, CAF audio essence, and DBMD companion presence;
- file size, modification time, and path information used for caching.

The Source Inspector displays a subset of this information locally.

## Local processing and external tools

FFmpeg/ffprobe are launched from the user's system `PATH`. OpenJOC is launched as a bundled local sidecar. Source paths and selected output paths are passed to those local processes as command arguments.

The application does not intentionally send media or diagnostics to the project maintainers. Users are responsible for the provenance, confidentiality, and authorization of every selected source.

## Stored data

Prepared stereo WAV files, DAMF timelines, OpenJOC diagnostics used for inspection, render-kind markers, and full/solo/mute variants can be stored in Tauri's application cache directory under `prepared-media/`.

User-requested exports are written to the destination selected in the save dialog. E-AC-3 extraction and OAMD diagnostic JSON are written transactionally through a partial file before final replacement.

Cache files can reveal source filenames, paths indirectly through cache structure, audio content, and metadata. Treat the application cache as sensitive when working with confidential masters.

## Clearing local data

Close the application before removing cached data. Delete only this application's resolved cache directory or the affected `prepared-media/<source-key>/` entry. Do not delete a broad user-profile or system cache directory.

Removing the cache does not delete original source media or user-selected exports.

## Development server

The Vite development UI binds to loopback at `127.0.0.1:1420`. It is intended for local development. Do not expose it to an untrusted network through port forwarding or proxy configuration.

## Logs and support reports

Before sharing logs or screenshots, remove personal paths, usernames, commercial media titles, tokens, and confidential metadata. Follow [SUPPORT.md](SUPPORT.md) and [SECURITY.md](SECURITY.md).

## Third-party and operating-system components

Windows, WebView2, GPU/audio drivers, FFmpeg builds, and other system software may have their own diagnostics, update, crash-reporting, or privacy behavior. Those components are outside this project's control. Consult the relevant provider policies for the exact software installed on your machine.

## Changes

Update this document in the same change that introduces telemetry, networking, accounts, remote processing, crash reporting, or a materially different cache/data flow.
