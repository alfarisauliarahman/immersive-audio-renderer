# Performance Notes

## Expected resource use

Playback combines several independent workloads:

- browser media decoding and Web Audio output;
- two 2,048-sample channel analyzers for live meters;
- signal/loudness calculations approximately every 100 ms;
- transport/scene updates at roughly 30 frames per second;
- React rendering for object, speaker, meter, and timeline state;
- three.js rendering of active objects and transparent room geometry.

CPU and GPU use therefore rises while playing and while objects move. This is expected. Idle use should be much lower because the Room View uses demand rendering and transport animation stops when playback is paused.

## Why DAMF solo can still be expensive

DAMF audio is stored as a large interleaved CAF essence. Selecting one object does not make that channel a separate small file. The renderer must still read the full interleaved source frames from disk to reach the selected samples.

The optimized solo path decodes and mixes only the selected authored channel, reducing CPU work, but disk I/O remains proportional to the source duration and interleaved frame size. On a multi-gigabyte master stored on a hard disk, cold solo generation can take tens of seconds or minutes even when CPU utilization is modest.

Mute rendering reads the source contribution for muted channels and can reuse the cached full render, avoiding a complete all-channel remix. It is still source-I/O-bound for the removed channels.

## Cache effects

Measure these cases separately:

- cold full render;
- warm full render cache hit;
- cold single-object solo;
- warm solo cache hit;
- cold mute variant;
- warm mute cache hit.

A cache hit should be dominated by file validation and playback startup. A cold render reads the master and writes a stereo float WAV. Do not compare those as if they were the same operation.

## Monitor boost and compression

DAMF previews are deliberately boosted in the Web Audio monitor because the independent preview renderer has conservative internal gain. Full mixes receive +24 dB and solos receive +36 dB. Enabling this path inserts a high-ratio `DynamicsCompressorNode`, which adds a small continuous audio-processing cost while playing.

The boost and compressor affect only monitoring. They do not turn the preview into a reference render and should not be treated as mastering controls.

## GPU behavior

The Room View uses WebGL, transparent materials, lighting, and multiple meshes per active object. Device-pixel ratio is capped to reduce fill cost. GPU use can still spike during playback, window resizing, camera interaction, or scenes with many visible objects.

When diagnosing unexpected idle GPU use:

1. Pause playback and wait for transport animation to stop.
2. Stop moving the Room View camera.
3. Compare Task Manager's GPU engine and process utilization.
4. Confirm no browser developer tools or screen-recording overlay is continuously invalidating the view.
5. Profile the packaged executable as well as the development server; development tooling adds overhead.

## Profiling rules

- Record hardware, power mode, source format, duration, object/channel count, source size, and storage type.
- Separate elapsed time from CPU time.
- Record disk throughput for DAMF work.
- Use a cold cache only when explicitly testing preparation performance.
- Use a release build for meaningful performance numbers.
- Avoid claiming a regression from one short Task Manager sample.

## Current optimization decisions

- Room View renders on demand.
- Timeline updates are limited to about 30 Hz.
- Live signal analysis is limited to about 10 Hz.
- DAMF rendering streams bounded blocks instead of loading the full master into memory.
- Solo decodes only one selected interleaved channel.
- Mute can subtract selected contributions from a cached full mix.
- Completed full/solo/mute renders are cached independently.

DAMF SOLO/MUTE jobs now support cooperative cancellation at PCM-block boundaries. Future work should extend cancellation and progress reporting to preparation, FFmpeg, and OpenJOC jobs, add bounded render concurrency, and profile React updates before adding lower-value visual effects.
