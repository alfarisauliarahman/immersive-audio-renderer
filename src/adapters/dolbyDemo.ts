import type { AudioScene, TimelineObject } from "../domain/scene";

type RawObject = {
  positions: Array<number | null>;
  loudness: number[];
};

type RawScene = {
  duration: number;
  sampleRate: number;
  frequency: number;
  objects: RawObject[];
  overallLoudness: number[];
  loudestId: number[];
};

function isRawScene(value: unknown): value is RawScene {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RawScene>;
  return (
    typeof candidate.duration === "number" &&
    typeof candidate.sampleRate === "number" &&
    typeof candidate.frequency === "number" &&
    Array.isArray(candidate.objects) &&
    Array.isArray(candidate.overallLoudness) &&
    Array.isArray(candidate.loudestId)
  );
}

export function parseDolbyDemoScene(
  raw: unknown,
  options: { name?: string; sourceLabel?: string } = {},
): AudioScene {
  if (!isRawScene(raw)) {
    throw new Error("The scene metadata has an unsupported schema.");
  }

  const frameCount = raw.overallLoudness.length;
  const objects: TimelineObject[] = raw.objects.map((object, id) => ({
    id,
    inputId: id + 11,
    positions: object.positions.slice(0, frameCount * 3),
    loudness: object.loudness.slice(0, frameCount),
  }));

  let sum = 0;
  const integratedPower = raw.overallLoudness.map((db) => {
    sum += 10 ** (db / 10);
    return sum;
  });

  return {
    name: options.name ?? "Dolby Music Visualizer Demo",
    sourceLabel: options.sourceLabel ?? "BINAURAL WAV + OBJECT TIMELINE",
    duration: raw.duration,
    sampleRate: raw.sampleRate,
    frequency: raw.frequency,
    objects,
    overallLoudness: raw.overallLoudness,
    loudestId: raw.loudestId,
    integratedPower,
    capabilities: {
      objectPositions: true,
      objectLevels: true,
      objectAudio: false,
      objectSolo: false,
      objectMute: false,
      rerender: false,
    },
  };
}

export async function loadDolbyDemoScene(url: string): Promise<AudioScene> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scene metadata could not be loaded (${response.status}).`);
  }
  return parseDolbyDemoScene(await response.json());
}

export function createAudioOnlyScene(
  name: string,
  options: { duration?: number; sampleRate?: number; sourceLabel?: string } = {},
): AudioScene {
  return {
    name,
    sourceLabel: options.sourceLabel ?? "LOCAL AUDIO · NO OBJECT METADATA",
    duration: options.duration ?? 0,
    sampleRate: options.sampleRate ?? 0,
    frequency: 0.032,
    objects: [],
    overallLoudness: [-100],
    loudestId: [-1],
    integratedPower: [0.0000000001],
    capabilities: {
      objectPositions: false,
      objectLevels: false,
      objectAudio: false,
      objectSolo: false,
      objectMute: false,
      rerender: false,
    },
  };
}

export function createMetadataProxyScene(
  name: string,
  options: { duration: number; sampleRate: number; objectCount: number; sourceLabel: string },
): AudioScene {
  const objectCount = Math.max(1, Math.min(64, Math.floor(options.objectCount)));
  const frequency = 0.25;
  const frameCount = Math.max(2, Math.ceil(options.duration / frequency) + 1);
  const objects: TimelineObject[] = Array.from({ length: objectCount }, (_, id) => {
    const angle = (id / objectCount) * Math.PI * 2 - Math.PI / 2;
    const radius = id === 0 ? 0.18 : 0.55 + (id % 3) * 0.12;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = id === 0 ? -0.55 : id % 4 === 0 ? 0.7 : id % 4 === 1 ? 0.28 : 0;
    const positions: number[] = [];
    const loudness: number[] = [];
    for (let frame = 0; frame < frameCount; frame += 1) {
      positions.push(x, y, z);
      loudness.push(-31 + Math.sin(frame * 0.11 + id * 1.7) * 7 - (id % 5) * 1.5);
    }
    return { id, inputId: id + 11, positions, loudness };
  });

  const overallLoudness = Array.from(
    { length: frameCount },
    (_, frame) => -21 + Math.sin(frame * 0.075) * 2.4 + Math.sin(frame * 0.017) * 1.1,
  );
  const loudestId = Array.from({ length: frameCount }, (_, frame) => Math.floor(frame / 12) % objectCount);
  let sum = 0;
  const integratedPower = overallLoudness.map((db) => {
    sum += 10 ** (db / 10);
    return sum;
  });

  return {
    name,
    sourceLabel: options.sourceLabel,
    duration: options.duration,
    sampleRate: options.sampleRate,
    frequency,
    objects,
    overallLoudness,
    loudestId,
    integratedPower,
    capabilities: {
      objectPositions: false,
      objectLevels: false,
      objectAudio: false,
      objectSolo: false,
      objectMute: false,
      rerender: false,
    },
  };
}
