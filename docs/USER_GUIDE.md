# User Guide

## Starting the application

Run the portable executable for the complete desktop experience. `npm run dev` opens the browser development UI, which can play browser-supported files but does not provide every native Tauri operation.

The initial screen loads the configured demonstration source when its local media is present. Use **OPEN FILE** to inspect another source.

## Interface areas

- **Top bar** — monitor mode, source selection mode, timecode, transport, attenuation, DIM, MUTE, and output-view controls.
- **Renderer Inputs** — overview of up to 128 logical inputs; active elements are lit and the selected input is highlighted.
- **Output meters** — live post-monitor stereo signal and metadata-projected 7.1.4 scene view.
- **Loudness** — live monitor estimates, not certified delivery measurements.
- **Speaker View** — top-down 2D projection of the current scene.
- **Room View** — interactive 3D position view.
- **Bottom deck** — source type, selected object position/level, object controls, and timeline.
- **Source Inspector** — file/container/codec/profile, audio format, duration, engine, cache state, and warnings.

## Opening ordinary audio

Select WAV, FLAC, MP3, AAC, Ogg, or Opus. Supported PCM WAV can play directly. Other native sources are inspected by ffprobe and prepared to a 48 kHz stereo WAV by FFmpeg.

Ordinary audio has no object metadata, so position display and object controls remain unavailable.

## Opening audio with visualization JSON

Select both the audio file and matching JSON in the same open operation. The JSON must use the supported timeline schema. The application plays the finished audio and samples the JSON by current playback time.

Object dots are visualization data only. They cannot change the audio, and solo/mute remain disabled because the audio has no separate stems.

## Opening E-AC-3 JOC

Select an M4A, MP4, EC3, or EAC3 source. The Source Inspector must positively identify E-AC-3 with Atmos/JOC information before the OpenJOC path is used.

Preparation may take time. On success, the application plays an OpenJOC 2.0 speaker render. If OpenJOC fails and FFmpeg can decode the codec core, the result is visibly labelled as a codec-core fallback.

Any displayed elements are diagnostic proxies. They are not recovered authored trajectories or discrete stems, so solo/mute are disabled.

For a positively identified JOC source, open **SOURCE INFO** and use:

- **EXTRACT .EAC3** to stream-copy the E-AC-3 delivery bitstream without re-encoding;
- **EXPORT OAMD JSON** to scan all access units and save OpenJOC's forensic diagnostic evidence.

The exports can be large and may take time. They are not a recovered `.atmos` master, authored trajectory file, or object-stem package.

## Opening DAMF

Select the small `.atmos` manifest. Keep all four same-base-name files together:

```text
Master.atmos
Master.atmos.audio
Master.atmos.metadata
Master.atmos.dbmd
```

The first load can take several minutes for a multi-gigabyte source because the renderer streams the entire interleaved audio essence. A completed render and scene timeline are cached.

DAMF exposes authored object binding, so selecting an object enables:

- **SOLO** — prepare and play only the selected authored object;
- **MUTE** — prepare and play a mix with the selected authored object removed;
- **RE-RENDER** — regenerate the active monitor variant when the UI exposes the action.

Each new variant can require another disk pass. Cached variants reopen much faster.

## Transport and output controls

- **Rewind** moves approximately 10 seconds backward.
- **Stop** pauses and returns to the beginning.
- **Play/Pause** toggles playback.
- **Attenuation** applies global monitor gain in dB.
- **DIM** reduces output by 20 dB.
- **MUTE** silences output.

DAMF preview levels receive automatic monitor make-up gain because the independent preview renderer is conservative: +24 dB for a full mix and +36 dB for a solo, followed by a safety compressor. This is monitor behavior, not a mastering transform.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` or `K` | Play/pause |
| `S` | Stop and return to start |
| `Left` / `Right` | Seek backward/forward 10 seconds |
| `M` | Toggle monitor MUTE |
| `D` | Toggle monitor DIM |
| `O` or `Ctrl+O` | Open source |
| `I` | Toggle Source Inspector |
| `?` | Toggle shortcut reference |
| `Escape` | Close information panels |

Shortcuts are ignored while an input, text area, select, button, or editable element has focus. Toggle shortcuts ignore key repeat; arrow seeking supports repeat.

## Room View navigation

- Left-drag: orbit.
- Right-drag: pan.
- Mouse wheel: zoom.
- Reset button: restore the home camera.
- Click an object: select its logical renderer input.

The Room View coordinates are a UI projection of the normalized scene. For JOC they are proxies; for supported DAMF they come from authored metadata.

## Exporting a monitor WAV

After a native source has a completed prepared playback WAV, choose **EXPORT WAV**. The filename indicates whether the active output is a full stereo monitor, object solo, or muted-object variant.

Export copies the current two-channel monitor render. It does not export a new DAMF, encoded Atmos delivery master, or isolated stem set beyond a currently prepared DAMF solo preview.

## Reading warnings

Do not ignore Source Inspector warnings. They distinguish:

- OpenJOC output from codec-core fallback;
- authored DAMF metadata from diagnostic proxies;
- cached output from newly prepared output;
- native object capabilities from visualization-only data.

See [Troubleshooting](TROUBLESHOOTING.md) when output is silent, unexpectedly quiet, slow to prepare, or missing object controls.
