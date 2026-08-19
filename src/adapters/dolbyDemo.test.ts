import { describe, expect, it } from "vitest";
import { createAudioOnlyScene, createMetadataProxyScene } from "./dolbyDemo";

describe("local source scene adapters", () => {
  it("preserves native duration and sample rate for audio-only sources", () => {
    const scene = createAudioOnlyScene("master.flac", { duration: 42.5, sampleRate: 96_000 });
    expect(scene.duration).toBe(42.5);
    expect(scene.sampleRate).toBe(96_000);
    expect(scene.objects).toHaveLength(0);
    expect(scene.capabilities.objectPositions).toBe(false);
  });

  it("creates bounded, explicitly non-authored element proxies", () => {
    const scene = createMetadataProxyScene("atmos.m4a", {
      duration: 10,
      sampleRate: 48_000,
      objectCount: 16,
      sourceLabel: "POSITION DISPLAY IS PROXY",
    });
    expect(scene.objects).toHaveLength(16);
    expect(scene.objects[0].inputId).toBe(11);
    expect(scene.objects[15].inputId).toBe(26);
    expect(scene.overallLoudness.length).toBeGreaterThan(10);
    expect(scene.capabilities.objectPositions).toBe(false);
    expect(scene.capabilities.objectAudio).toBe(false);
  });
});
