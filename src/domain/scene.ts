export type Vec3 = {
  x: number;
  y: number;
  z: number;
};
export type SceneCapabilities = {
  objectPositions: boolean;
  objectLevels: boolean;
  objectAudio: boolean;
  objectSolo: boolean;
  objectMute: boolean;
  rerender: boolean;
};

export type TimelineObject = {
  id: number;
  inputId: number;
  positions: Array<number | null>;
  loudness: number[];
};

export type AudioScene = {
  name: string;
  sourceLabel: string;
  duration: number;
  sampleRate: number;
  frequency: number;
  objects: TimelineObject[];
  overallLoudness: number[];
  loudestId: number[];
  integratedPower: number[];
  capabilities: SceneCapabilities;
};

export type SampledObject = {
  id: number;
  inputId: number;
  position: Vec3;
  loudness: number;
  highlighted: boolean;
};

export type SceneSample = {
  frame: number;
  nextFrame: number;
  mix: number;
  overallLoudness: number;
  integratedLoudness: number;
  objects: SampledObject[];
};

const finiteOr = (value: number | null | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;

export function sampleScene(scene: AudioScene, time: number): SceneSample {
  const maxFrame = Math.max(0, scene.overallLoudness.length - 1);
  const exactFrame = Math.max(0, Math.min(maxFrame, time / scene.frequency));
  const frame = Math.floor(exactFrame);
  const nextFrame = Math.min(maxFrame, frame + 1);
  const mix = exactFrame - frame;
  const loudest = scene.loudestId[frame] ?? -1;

  const objects = scene.objects.map((object) => {
    const a = frame * 3;
    const b = nextFrame * 3;
    const ax = finiteOr(object.positions[a], 0);
    const ay = finiteOr(object.positions[a + 1], 0);
    const az = finiteOr(object.positions[a + 2], 0);
    const bx = finiteOr(object.positions[b], ax);
    const by = finiteOr(object.positions[b + 1], ay);
    const bz = finiteOr(object.positions[b + 2], az);
    const levelA = finiteOr(object.loudness[frame], -100);
    const levelB = finiteOr(object.loudness[nextFrame], levelA);

    return {
      id: object.id,
      inputId: object.inputId,
      position: {
        x: lerp(ax, bx, mix),
        y: lerp(ay, by, mix),
        z: lerp(az, bz, mix),
      },
      loudness: lerp(levelA, levelB, mix),
      highlighted: object.id === loudest,
    };
  });

  const overallA = finiteOr(scene.overallLoudness[frame], -100);
  const overallB = finiteOr(scene.overallLoudness[nextFrame], overallA);
  const power = scene.integratedPower[frame] / Math.max(1, frame + 1);

  return {
    frame,
    nextFrame,
    mix,
    overallLoudness: lerp(overallA, overallB, mix),
    integratedLoudness: power > 0 ? 10 * Math.log10(power) : -100,
    objects,
  };
}

export const EMPTY_SAMPLE: SceneSample = {
  frame: 0,
  nextFrame: 0,
  mix: 0,
  overallLoudness: -100,
  integratedLoudness: -100,
  objects: [],
};
