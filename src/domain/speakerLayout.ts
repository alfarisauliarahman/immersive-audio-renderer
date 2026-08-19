import type { MediaProbe } from "../adapters/nativeMedia";

export type SpeakerLayout = {
  id: "2.0" | "5.1" | "7.1" | "7.1.4";
  labels: string[];
};

const LAYOUTS: Record<SpeakerLayout["id"], SpeakerLayout> = {
  "2.0": { id: "2.0", labels: ["L", "R"] },
  "5.1": { id: "5.1", labels: ["L", "R", "C", "LFE", "Ls", "Rs"] },
  "7.1": { id: "7.1", labels: ["L", "R", "C", "LFE", "Ls", "Rs", "Lrs", "Rrs"] },
  "7.1.4": { id: "7.1.4", labels: ["L", "R", "C", "LFE", "Ls", "Rs", "Lrs", "Rrs", "Ltf", "Rtf", "Ltr", "Rtr"] },
};

export function resolveSpeakerLayout(probe: MediaProbe | null): SpeakerLayout {
  if (!probe) return LAYOUTS["7.1.4"];
  const layout = probe.channelLayout.toLowerCase().replaceAll(" ", "");
  if (layout.includes("7.1.4") || probe.channels === 12) return LAYOUTS["7.1.4"];
  if (layout.includes("7.1") || probe.channels === 8) return LAYOUTS["7.1"];
  if (layout.includes("5.1") || probe.channels === 6) return LAYOUTS["5.1"];
  if (layout.includes("stereo") || layout.includes("2.0") || probe.channels === 2) return LAYOUTS["2.0"];
  if (probe.channels > 8) return LAYOUTS["7.1.4"];
  if (probe.channels > 6) return LAYOUTS["7.1"];
  if (probe.channels > 2) return LAYOUTS["5.1"];
  return LAYOUTS["2.0"];
}
