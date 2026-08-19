import { describe, expect, it } from "vitest";
import type { MediaProbe } from "../adapters/nativeMedia";
import { resolveSpeakerLayout } from "./speakerLayout";

const probe = (channels: number, channelLayout: string): MediaProbe => ({
  fileName: "test.wav",
  formatName: "wav",
  formatLongName: "Wave",
  codecName: "pcm_f32le",
  codecLongName: "PCM float",
  profile: "",
  sampleRate: 48_000,
  channels,
  channelLayout,
  bitrate: 0,
  duration: 1,
  atmos: false,
});

describe("resolveSpeakerLayout", () => {
  it("follows common source channel layouts", () => {
    expect(resolveSpeakerLayout(probe(2, "stereo")).id).toBe("2.0");
    expect(resolveSpeakerLayout(probe(6, "5.1(side)")).id).toBe("5.1");
    expect(resolveSpeakerLayout(probe(8, "7.1")).id).toBe("7.1");
    expect(resolveSpeakerLayout(probe(12, "7.1.4")).id).toBe("7.1.4");
  });
});
