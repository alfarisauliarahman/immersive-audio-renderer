import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";

export type MediaProbe = {
  fileName: string;
  formatName: string;
  formatLongName: string;
  codecName: string;
  codecLongName: string;
  profile: string;
  sampleRate: number;
  channels: number;
  channelLayout: string;
  bitrate: number;
  duration: number;
  atmos: boolean;
};

export type PreparedSource = {
  playbackPath: string;
  timelinePath: string | null;
  probe: MediaProbe;
  engine: string;
  sourceKind: "damf-master" | "openjoc-atmos" | "channel-downmix" | "local-audio";
  objectCount: number | null;
  cached: boolean;
  warning: string | null;
};

export const desktopRuntimeAvailable = () => isTauri();

export async function selectNativeMedia(): Promise<string[] | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: true,
    directory: false,
    title: "Open audio master and optional JSON timeline",
    filters: [
      {
        name: "Audio master / object timeline",
        extensions: ["atmos", "m4a", "mp4", "ec3", "eac3", "wav", "flac", "mp3", "aac", "ogg", "opus", "json"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (Array.isArray(selected)) return selected;
  return typeof selected === "string" ? [selected] : null;
}

export const readNativeText = (path: string) => invoke<string>("read_local_text", { path });

export async function selectWavExportDestination(defaultPath: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const selected = await save({
    title: "Export stereo monitor render",
    defaultPath,
    filters: [{ name: "Wave audio", extensions: ["wav"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export const exportNativeWav = (playbackPath: string, destinationPath: string) =>
  invoke<number>("export_wav", { playbackPath, destinationPath });

export const probeNativeMedia = (path: string) => invoke<MediaProbe>("probe_media", { path });

export async function prepareNativeMedia(path: string): Promise<PreparedSource & { playbackUrl: string }> {
  const prepared = await invoke<PreparedSource>("prepare_local_source", { path });
  return { ...prepared, playbackUrl: convertFileSrc(prepared.playbackPath) };
}

export async function renderNativeDamfVariant(
  path: string,
  options: { soloId: number | null; mutedIds: number[] },
): Promise<{ playbackPath: string; playbackUrl: string }> {
  const playbackPath = await invoke<string>("render_damf_variant", {
    path,
    soloId: options.soloId,
    mutedIds: options.mutedIds,
  });
  return { playbackPath, playbackUrl: convertFileSrc(playbackPath) };
}
