import { describe, expect, it } from "vitest";
import { sampleScene, type AudioScene } from "./scene";

const fixture: AudioScene = {
  name: "Test",
  sourceLabel: "TEST",
  duration: 2,
  sampleRate: 48_000,
  frequency: 1,
  objects: [
    {
      id: 0,
      inputId: 11,
      positions: [0, 0, 0, 1, -1, 0.5],
      loudness: [-40, -20],
    },
  ],
  overallLoudness: [-30, -10],
  loudestId: [0, 0],
  integratedPower: [0.001, 0.101],
  capabilities: {
    objectPositions: true,
    objectLevels: true,
    objectAudio: false,
    objectSolo: false,
    objectMute: false,
    rerender: false,
  },
};

describe("sampleScene", () => {
  it("interpolates position, level, and scene loudness between metadata frames", () => {
    const sample = sampleScene(fixture, 0.5);
    expect(sample.frame).toBe(0);
    expect(sample.mix).toBe(0.5);
    expect(sample.overallLoudness).toBe(-20);
    expect(sample.objects[0].position).toEqual({ x: 0.5, y: -0.5, z: 0.25 });
    expect(sample.objects[0].loudness).toBe(-30);
    expect(sample.objects[0].highlighted).toBe(true);
  });

  it("clamps sampling to the final available frame", () => {
    const sample = sampleScene(fixture, 30);
    expect(sample.frame).toBe(1);
    expect(sample.nextFrame).toBe(1);
    expect(sample.objects[0].position).toEqual({ x: 1, y: -1, z: 0.5 });
    expect(sample.objects[0].loudness).toBe(-20);
  });
});
