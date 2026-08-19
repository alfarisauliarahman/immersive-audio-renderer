# Format Support and Product Boundaries

## Capability matrix

| Source | Import | Audible output | Position data | Independent object PCM | Solo/mute | Export |
| --- | --- | --- | --- | --- | --- | --- |
| DAMF `.atmos` fileset | Native | Independent 2.0 preview | Authored | Yes | Yes | Current stereo monitor WAV |
| E-AC-3 JOC in `.m4a`/`.mp4` | OpenJOC, FFmpeg core fallback | 2.0 monitor plus speaker-layout export | Diagnostic proxy only | No verified authored stems | No | Stereo monitor WAV, multichannel/split speaker WAV, stream-copied `.eac3`/`.ec3`, forensic OAMD JSON |
| Raw `.ec3`/`.eac3` | Same JOC path when positively detected | Same as above | Diagnostic proxy only | No verified authored stems | No | Stereo monitor WAV, multichannel/split speaker WAV, copied delivery bitstream, forensic OAMD JSON |
| PCM WAV | Direct when supported | Original PCM WAV | None unless paired JSON is opened | No | No | Prepared/current WAV when native path is used |
| FLAC, MP3, AAC, Ogg, Opus | FFmpeg preparation | 48 kHz stereo float WAV | None | No | No | Prepared stereo monitor WAV |
| Stereo audio + compatible JSON timeline | Browser or native pair | Finished stereo audio | Visualization timeline | No | No | Native prepared WAV when available |

The native file dialog also permits arbitrary files, but inclusion in the dialog is not a promise that every codec or malformed container is supported. FFmpeg build configuration determines ordinary codec availability.

## DAMF requirements

Open the small `.atmos` manifest. These companion files must be in the same directory and share the same base name:

```text
Example.atmos
Example.atmos.audio
Example.atmos.metadata
Example.atmos.dbmd
```

The current parser expects the supported YAML structures and a CAF audio essence using interleaved 24-bit PCM with one frame per packet. Unsupported packing fails closed with a descriptive error.

Because the manifest and metadata bind PCM channels to authored objects, the application can display real trajectories and render real solo/mute monitor variants. The result is still this application's own stereo preview, not a Dolby-certified render.

## E-AC-3 JOC and M4A

M4A/MP4 is a container. Atmos delivery in this path is an E-AC-3 JOC stream inside that container.

The application can:

- identify E-AC-3 JOC when ffprobe exposes the relevant profile;
- ask OpenJOC to create a 2.0 speaker render;
- inspect bounded OAMD diagnostics such as an element count;
- export forensic OAMD evidence for all access units as JSON;
- stream-copy the contained E-AC-3 audio to an elementary `.eac3`/`.ec3` file without re-encoding;
- render a supported speaker layout to one multichannel WAV or split it into mono L/R/C/LFE/etc. speaker feeds;
- fall back to an explicitly labelled codec-core downmix if JOC rendering fails.

The application cannot truthfully claim that it can:

- recreate the original `.atmos` fileset;
- recover the original DAW session or source bindings;
- recover lossless authored object stems;
- recover complete authored object trajectories;
- identify reconstruction rows as semantic objects such as vocal, drum, or effect stems;
- provide object solo/mute from that delivery master.

An E-AC-3 elementary stream can be extracted from an MP4/M4A container without turning it back into an authoring master. Diagnostic OpenJOC output can also be serialized as JSON, but it remains forensic bit evidence rather than a recovered DAMF scene. It uses fields such as `input_media`, `access_unit_count`, and OAMD observations; it does not implement the application's visualization-timeline schema and cannot be loaded as a playable scene. Speaker exports are decoded projection feeds: a file called `C.wav` is the center-speaker render, not an authored object channel. These actions are available in Source Inspector only after the native source is positively detected as JOC.

OpenJOC can expose diagnostic `ReconstructionBasis` rows, but its upstream contract explicitly states that semantic binding remains unresolved. This release does not expose those rows as user-facing objects. A future experimental lab may permit auditioning them only if every output remains labelled as a reconstructed diagnostic component rather than a vocal, instrument, effect, or original authored-object stem.

## WAV + JSON visualizer datasets

In the supported visualizer schema:

- WAV is already rendered stereo audio;
- JSON contains sampled positions, object loudness values, scene loudness values, and the highlighted/loudest element ID;
- playback time chooses the current JSON frame;
- JSON does not generate or modify the audio.

Deleting the JSON removes the visualization but does not change the WAV. Moving a dot in the UI cannot move the baked stereo sound. Solo and mute are unavailable because no discrete object PCM exists.

The development pair originally examined for this adapter came from the official [Dolby Atmos Visualizer Music](https://www.dolby.com/atmos-visualizer-music/) site. Its so-called Atmos WAV is a two-channel finished monitor render, not a DAMF or encoded Atmos master.

## Meters and loudness

`LIVE 2.0` meters read the audible post-monitor stereo signal. `SOURCE PROXY` follows the probed source topology (for example 5.1 instead of a hardcoded 7.1.4) but remains a spatial projection from scene metadata, not a hardware output meter or decoded per-channel measurement.

Momentary, short-term, integrated, and range values are useful live estimates derived from the Web Audio samples. They are not a standards-compliant loudness report and must not be used for delivery QC or certification.

## Terminology rules

Use these labels consistently:

- **authored position** only for data bound by the DAMF source;
- **position proxy** for OpenJOC diagnostic visualization;
- **visualization timeline** for external JSON paired with finished stereo audio;
- **monitor preview** for this application's own stereo render;
- **codec-core fallback** when FFmpeg renders the non-JOC base path;
- **reference render** only for output produced by an authorized reference renderer.
- **forensic OAMD report** for all-access-unit diagnostic JSON that is not a scene timeline;
- **reconstructed diagnostic component** for any future unbound OpenJOC reconstruction row.
