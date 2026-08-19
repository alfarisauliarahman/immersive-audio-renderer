# Roadmap

This roadmap records intended work, not promises. Capability claims in the README and format matrix describe the current application.

## Release blockers

- Remove non-redistributable Dolby website media and other private fixtures from the complete Git history before making the repository public.
- Replace fixture-dependent public tests with redistributable generated or explicitly licensed media while retaining private integration coverage locally.
- Produce a clean-checkout build and test report.
- Generate a complete dependency license/SBOM report for release artifacts.
- Narrow the Tauri local asset-protocol scope and review command permissions.
- Decide whether FFmpeg remains a user prerequisite or is distributed with a precisely documented build and license configuration.

## High priority

- Extend the existing DAMF SOLO/MUTE cancellation to FFmpeg, OpenJOC, and initial DAMF preparation, with visible progress.
- Prevent concurrent duplicate renders of the same source/variant.
- Add cache management and cache-size visibility.
- Add clean, redistributable synthetic WAV + JSON test fixtures.

## Accuracy and inspection

- Implement standards-conformant ITU-R BS.1770 loudness measurement or keep the current estimates visibly separated from certified measurement.
- Add waveform/peak summaries and deterministic audio regression measurements.
- Expand DAMF validation diagnostics for unsupported versions, metadata forms, and CAF layouts.
- Record OpenJOC version and render configuration in exported diagnostic reports.
- Add source and output SHA-256 values to inspection reports.

## Performance and usability

- Profile large-object React updates and reduce allocations in live sampling.
- Add render progress based on processed frames/bytes.
- Add explicit cold/warm cache indicators and a retry path after failed preparation.
- Add optional quality controls for 3D geometry and device-pixel ratio.
- Add keyboard-accessible alternatives for Room View and object selection.
- Preserve user camera state per source while keeping a reliable reset action.

## Future format research

- Evaluate standards-based ADM/BWF import with reliable PCM/metadata binding.
- Evaluate TrueHD/MLP Atmos delivery inspection through a legally and technically suitable decoder path.
- Track upstream OpenJOC semantic-binding progress before enabling any new authored-object claim.
- Define a versioned internal scene interchange format independent of any vendor-specific container.

## Explicit non-goals

- Reproducing Dolby's proprietary renderer or presenting output as Dolby-certified.
- Reconstructing an original DAMF or DAW session from a lossy M4A delivery master.
- Labelling diagnostic reconstruction rows as verified vocal, drum, music, or effects stems without source binding evidence.
- Shipping copyrighted demo music merely because it is publicly reachable in a browser.
- Executing or bundling unverified installer archives as codec dependencies.
