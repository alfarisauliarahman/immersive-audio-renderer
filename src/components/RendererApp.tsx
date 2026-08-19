import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAudioOnlyScene,
  createMetadataProxyScene,
  loadDolbyDemoScene,
  parseDolbyDemoScene,
} from "../adapters/dolbyDemo";
import {
  desktopRuntimeAvailable,
  exportNativeWav,
  prepareNativeMedia,
  probeNativeMedia,
  readNativeText,
  renderNativeDamfVariant,
  selectNativeMedia,
  selectWavExportDestination,
  type MediaProbe,
} from "../adapters/nativeMedia";
import { EMPTY_SAMPLE, sampleScene, type AudioScene } from "../domain/scene";
import { useAudioTransport } from "../hooks/useAudioTransport";
import { InputMatrix } from "./InputMatrix";
import { LoudnessPanel } from "./LoudnessPanel";
import { OutputMeters } from "./OutputMeters";
import { RoomView } from "./RoomView";
import { SpeakerView } from "./SpeakerView";
import { Timeline } from "./Timeline";
import { TopBar } from "./TopBar";

const AUDIO_SOURCE = "/atmos-3.wav";
const SCENE_SOURCE = "/atmos-objects1.json";

type SourceDetails = {
  badge: string;
  engine: string;
  probe: MediaProbe | null;
  cached: boolean;
  warning: string | null;
};

const DEMO_DETAILS: SourceDetails = {
  badge: "DEMO ADAPTER",
  engine: "Browser PCM playback + supplied JSON timeline",
  probe: {
    fileName: "atmos-3.wav",
    formatName: "wav",
    formatLongName: "Broadcast Wave",
    codecName: "pcm_s24le",
    codecLongName: "PCM signed 24-bit little-endian",
    profile: "",
    sampleRate: 48_000,
    channels: 2,
    channelLayout: "stereo",
    bitrate: 2_304_000,
    duration: 185.833333,
    atmos: false,
  },
  cached: true,
  warning: null,
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

export function RendererApp() {
  const [scene, setScene] = useState<AudioScene | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState(AUDIO_SOURCE);
  const [selectedInput, setSelectedInput] = useState<number | null>(12);
  const [attenuation, setAttenuation] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sourceDetails, setSourceDetails] = useState<SourceDetails>(DEMO_DETAILS);
  const [showSourceInfo, setShowSourceInfo] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [nativeSourcePath, setNativeSourcePath] = useState<string | null>(null);
  const [preparedPlaybackPath, setPreparedPlaybackPath] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [soloObjectId, setSoloObjectId] = useState<number | null>(null);
  const [mutedObjectIds, setMutedObjectIds] = useState<Set<number>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const resumeAtRef = useRef<number | null>(null);

  const damfMonitorBoost = sourceDetails.badge === "DAMF MASTER"
    ? soloObjectId !== null ? 36 : 24
    : 0;
  const transport = useAudioTransport({
    source: audioSource,
    attenuation,
    dimmed,
    muted,
    monitorBoostDb: damfMonitorBoost,
  });

  useEffect(() => {
    let live = true;
    loadDolbyDemoScene(SCENE_SOURCE)
      .then((loaded) => live && setScene(loaded))
      .catch((reason: unknown) => live && setSceneError(reason instanceof Error ? reason.message : "Scene failed to load."));
    return () => { live = false; };
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);

  useEffect(() => {
    if (resumeAtRef.current === null || transport.duration <= 0) return;
    transport.seek(Math.min(resumeAtRef.current, transport.duration));
    resumeAtRef.current = null;
  }, [transport.duration, transport.seek]);

  const openLocalFiles = async (files: FileList | File[]) => {
    const selected = Array.from(files);
    const jsonFile = selected.find((file) => file.name.toLowerCase().endsWith(".json"));
    const audioFile = selected.find((file) => file !== jsonFile);
    setSceneError(null);

    if (!audioFile) {
      setSceneError("Select an audio file, or select a WAV and its matching JSON together.");
      return;
    }

    try {
      let nextScene: AudioScene;
      if (jsonFile) {
        nextScene = parseDolbyDemoScene(JSON.parse(await jsonFile.text()), {
          name: audioFile.name,
          sourceLabel: `LOCAL ${audioFile.name.split(".").pop()?.toUpperCase() ?? "AUDIO"} + JSON TIMELINE`,
        });
      } else {
        nextScene = createAudioOnlyScene(audioFile.name);
      }

      transport.stop();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const objectUrl = URL.createObjectURL(audioFile);
      objectUrlRef.current = objectUrl;
      setAudioSource(objectUrl);
      setScene(nextScene);
      setNativeSourcePath(null);
      setPreparedPlaybackPath(null);
      setSoloObjectId(null);
      setMutedObjectIds(new Set());
      setSelectedInput(nextScene.objects[0]?.inputId ?? null);
      setSourceDetails({
        badge: jsonFile ? "LOCAL PAIR" : "LOCAL AUDIO",
        engine: jsonFile ? "Browser playback + supplied JSON timeline" : "Browser media playback",
        probe: {
          fileName: audioFile.name,
          formatName: audioFile.name.split(".").pop()?.toLowerCase() ?? "audio",
          formatLongName: audioFile.type || "Local audio",
          codecName: "browser-decoded",
          codecLongName: "Decoded by the browser media engine",
          profile: "",
          sampleRate: nextScene.sampleRate,
          channels: 0,
          channelLayout: "",
          bitrate: 0,
          duration: nextScene.duration,
          atmos: false,
        },
        cached: false,
        warning: jsonFile ? null : "No matching JSON timeline was selected, so object metadata is unavailable.",
      });
    } catch (reason) {
      setSceneError(reason instanceof Error ? reason.message : "The selected source could not be opened.");
    }
  };

  const openNativeFile = async () => {
    setSceneError(null);
    try {
      const paths = await selectNativeMedia();
      if (!paths?.length) return;
      const jsonPath = paths.find((path) => path.toLowerCase().endsWith(".json"));
      const path = paths.find((candidate) => candidate !== jsonPath);
      if (!path) {
        setSceneError("Select an audio file, or select a WAV and its matching JSON together.");
        return;
      }

      setProcessing("PROBING CODEC AND CONTAINER");
      const probe = await probeNativeMedia(path);
      setSourceDetails({ badge: probe.atmos ? "ATMOS / JOC" : "LOCAL MASTER", engine: "Preparing…", probe, cached: false, warning: null });
      setProcessing(
        probe.formatName === "damf"
          ? "RENDERING AUTHORED DAMF · FIRST OPEN MAY TAKE SEVERAL MINUTES"
          : probe.atmos
          ? "RENDERING ATMOS/JOC · FIRST OPEN MAY TAKE 1–2 MINUTES"
          : "PREPARING LOCAL AUDIO",
      );
      const prepared = await prepareNativeMedia(path);

      transport.stop();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setAudioSource(prepared.playbackUrl);

      const objectCount = prepared.objectCount ?? 0;
      const nextScene = prepared.sourceKind === "damf-master" && prepared.timelinePath
        ? JSON.parse(await readNativeText(prepared.timelinePath)) as AudioScene
        : jsonPath
        ? parseDolbyDemoScene(JSON.parse(await readNativeText(jsonPath)), {
          name: prepared.probe.fileName,
          sourceLabel: `LOCAL ${prepared.probe.formatName.toUpperCase()} + JSON TIMELINE`,
        })
        : prepared.sourceKind === "openjoc-atmos" && objectCount > 0
          ? createMetadataProxyScene(prepared.probe.fileName, {
          duration: prepared.probe.duration,
          sampleRate: prepared.probe.sampleRate,
          objectCount,
          sourceLabel: `OPENJOC 2.0 RENDER · ${objectCount} OAMD ELEMENTS · POSITION DISPLAY IS PROXY`,
          })
          : createAudioOnlyScene(prepared.probe.fileName, {
          duration: prepared.probe.duration,
          sampleRate: prepared.probe.sampleRate,
          sourceLabel: prepared.sourceKind === "channel-downmix"
            ? "E-AC-3 CODEC-CORE DOWNMIX · OBJECT METADATA UNAVAILABLE"
            : "LOCAL AUDIO · NO OBJECT TIMELINE",
          });

      setScene(nextScene);
      setNativeSourcePath(path);
      setPreparedPlaybackPath(prepared.playbackPath);
      setSoloObjectId(null);
      setMutedObjectIds(new Set());
      setSelectedInput(nextScene.objects[0]?.inputId ?? null);
      setSourceDetails({
        badge: prepared.sourceKind === "damf-master" ? "DAMF MASTER" : jsonPath ? "LOCAL PAIR" : prepared.sourceKind === "openjoc-atmos" ? "OPENJOC ATMOS" : prepared.sourceKind === "channel-downmix" ? "CORE DOWNMIX" : "LOCAL MASTER",
        engine: jsonPath ? `${prepared.engine} + supplied JSON timeline` : prepared.engine,
        probe: prepared.probe,
        cached: prepared.cached,
        warning: prepared.warning ?? (jsonPath ? null : prepared.sourceKind === "openjoc-atmos"
          ? "Audio is a local 2.0 speaker render. Element dots are a clearly marked spatial proxy because authored object PCM/trajectory binding is not exposed."
          : null),
      });
      if (prepared.warning) setShowSourceInfo(true);
    } catch (reason) {
      setSceneError(reason instanceof Error ? reason.message : "The selected source could not be prepared.");
    } finally {
      setProcessing(null);
    }
  };

  const applyDamfVariant = async (nextSoloId: number | null, nextMutedIds: Set<number>) => {
    if (!nativeSourcePath || scene?.capabilities.rerender !== true) return;
    setSceneError(null);
    setProcessing(nextSoloId !== null ? `RENDERING AUTHORED OBJECT ${nextSoloId + 1} SOLO` : nextMutedIds.size ? "RENDERING DAMF OBJECT MUTES" : "RESTORING FULL DAMF RENDER");
    try {
      const resumeAt = transport.currentTime;
      const prepared = await renderNativeDamfVariant(nativeSourcePath, {
        soloId: nextSoloId,
        mutedIds: Array.from(nextMutedIds),
      });
      transport.stop();
      resumeAtRef.current = resumeAt;
      setAudioSource(prepared.playbackUrl);
      setPreparedPlaybackPath(prepared.playbackPath);
      setSoloObjectId(nextSoloId);
      setMutedObjectIds(new Set(nextMutedIds));
    } catch (reason) {
      setSceneError(reason instanceof Error ? reason.message : "The DAMF object variant could not be rendered.");
    } finally {
      setProcessing(null);
    }
  };

  const toggleSelectedSolo = () => {
    if (!selectedObject) return;
    const nextSolo = soloObjectId === selectedObject.id ? null : selectedObject.id;
    void applyDamfVariant(nextSolo, mutedObjectIds);
  };

  const toggleSelectedMute = () => {
    if (!selectedObject) return;
    const nextMuted = new Set(mutedObjectIds);
    if (nextMuted.has(selectedObject.id)) nextMuted.delete(selectedObject.id);
    else nextMuted.add(selectedObject.id);
    void applyDamfVariant(soloObjectId, nextMuted);
  };

  const handleOpenClick = () => {
    if (desktopRuntimeAvailable()) void openNativeFile();
    else fileInputRef.current?.click();
  };

  const exportCurrentRender = async () => {
    if (!preparedPlaybackPath || processing) return;
    setSceneError(null);
    setExportNotice(null);
    const sourceStem = (sourceDetails.probe?.fileName ?? "monitor-render").replace(/\.[^.]+$/, "");
    const variant = soloObjectId !== null
      ? `-object-${soloObjectId + 1}-solo`
      : mutedObjectIds.size
        ? `-${mutedObjectIds.size}-objects-muted`
        : "-stereo-monitor";
    try {
      const destination = await selectWavExportDestination(`${sourceStem}${variant}.wav`);
      if (!destination) return;
      setProcessing("EXPORTING CURRENT STEREO MONITOR RENDER");
      const bytes = await exportNativeWav(preparedPlaybackPath, destination);
      setExportNotice(`EXPORTED ${(bytes / 1_048_576).toFixed(1)} MB · ${destination}`);
    } catch (reason) {
      setSceneError(reason instanceof Error ? reason.message : "The monitor render could not be exported.");
    } finally {
      setProcessing(null);
    }
  };

  const sample = useMemo(
    () => (scene ? sampleScene(scene, transport.currentTime) : EMPTY_SAMPLE),
    [scene, transport.currentTime],
  );

  const selectedObject = sample.objects.find((object) => object.inputId === selectedInput);
  const statusError = sceneError ?? transport.error;

  return (
    <main className="renderer-app">
      <div className="app-titlebar">
        <div>
          <span className="brand-mark">IA</span>
          <div><h1>Immersive Audio Renderer</h1><p>Independent object-audio inspection environment</p></div>
        </div>
        <div className="title-actions">
          <input
            ref={fileInputRef}
            className="hidden-file-input"
            type="file"
            multiple
            accept="audio/*,.atmos,.wav,.m4a,.mp4,.flac,.json"
            onChange={(event) => {
              if (event.target.files?.length) void openLocalFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <button className="source-info-button" onClick={() => setShowSourceInfo((value) => !value)}>SOURCE INFO</button>
          <button
            className="export-button"
            disabled={!preparedPlaybackPath || Boolean(processing)}
            title={preparedPlaybackPath ? "Save the current stereo monitor render as WAV" : "Open a native source before exporting"}
            onClick={() => void exportCurrentRender()}
          >EXPORT WAV</button>
          <button className="open-master-button" disabled={Boolean(processing)} onClick={handleOpenClick}><span>＋</span> OPEN FILE</button>
          <div className="title-status"><i className={scene && !processing ? "online" : ""} />{processing ? "PREPARING SOURCE" : scene ? "MASTER READY" : "LOADING MASTER"}</div>
          {showSourceInfo && (
            <section className="source-info-card">
              <header><strong>SOURCE INSPECTOR</strong><button onClick={() => setShowSourceInfo(false)}>×</button></header>
              <dl>
                <div><dt>File</dt><dd>{sourceDetails.probe?.fileName ?? scene?.name ?? "—"}</dd></div>
                <div><dt>Container</dt><dd>{sourceDetails.probe?.formatLongName || sourceDetails.probe?.formatName || "—"}</dd></div>
                <div><dt>Codec</dt><dd>{sourceDetails.probe?.codecLongName || sourceDetails.probe?.codecName || "—"}</dd></div>
                <div><dt>Profile</dt><dd>{sourceDetails.probe?.profile || (sourceDetails.probe?.atmos ? "Dolby Atmos" : "—")}</dd></div>
                <div><dt>Audio</dt><dd>{sourceDetails.probe ? `${sourceDetails.probe.sampleRate || "—"} Hz · ${sourceDetails.probe.channels || "—"} ch · ${sourceDetails.probe.channelLayout || "layout n/a"}` : "—"}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(sourceDetails.probe?.duration ?? 0)}</dd></div>
                <div><dt>Engine</dt><dd>{sourceDetails.engine}{sourceDetails.cached ? " · cached" : ""}</dd></div>
              </dl>
              {sourceDetails.warning && <p>{sourceDetails.warning}</p>}
            </section>
          )}
        </div>
      </div>

      <TopBar
        currentTime={transport.currentTime}
        playing={transport.playing}
        attenuation={attenuation}
        dimmed={dimmed}
        muted={muted}
        onAttenuationChange={setAttenuation}
        onDimToggle={() => setDimmed((value) => !value)}
        onMuteToggle={() => setMuted((value) => !value)}
        onPlayToggle={transport.togglePlayback}
        onStop={transport.stop}
        onRewind={transport.rewind}
      />

      <div className="renderer-workspace">
        <InputMatrix sample={sample} selectedInput={selectedInput} onSelect={setSelectedInput} />
        <div className="main-deck">
          <div className="meter-row">
            <OutputMeters sample={sample} signal={transport.signal} />
            <LoudnessPanel signal={transport.signal} />
          </div>
          <div className="visual-row">
            <SpeakerView sample={sample} selectedInput={selectedInput} onSelect={setSelectedInput} />
            <RoomView sample={sample} selectedInput={selectedInput} onSelect={setSelectedInput} />
          </div>
        </div>
      </div>

      <footer className="bottom-deck">
        <div className="source-summary">
          <span className="source-pill">{sourceDetails.badge}</span>
          <strong>{scene?.name ?? "Loading scene…"}</strong>
          <small>{scene?.sourceLabel ?? "WAV + JSON"}</small>
        </div>
        {selectedObject ? (
          <div className="object-inspector">
            <span>INPUT <strong>{selectedObject.inputId}</strong></span>
            <span>X <strong>{selectedObject.position.x.toFixed(2)}</strong></span>
            <span>Y <strong>{selectedObject.position.y.toFixed(2)}</strong></span>
            <span>Z <strong>{selectedObject.position.z.toFixed(2)}</strong></span>
            <span>LEVEL <strong>{selectedObject.loudness.toFixed(1)} dB</strong></span>
            <button
              className={soloObjectId === selectedObject.id ? "active" : ""}
              disabled={!scene?.capabilities.objectSolo || Boolean(processing)}
              title={scene?.capabilities.objectSolo ? "Render only this authored object" : "The source contains no independently addressable object audio"}
              onClick={toggleSelectedSolo}
            >SOLO</button>
            <button
              className={mutedObjectIds.has(selectedObject.id) ? "active" : ""}
              disabled={!scene?.capabilities.objectMute || Boolean(processing)}
              title={scene?.capabilities.objectMute ? "Exclude this authored object from the preview render" : "The source contains no independently addressable object audio"}
              onClick={toggleSelectedMute}
            >MUTE</button>
          </div>
        ) : <div className="object-inspector muted-copy">Select an assigned input to inspect its scene metadata.</div>}
        <div className="capability-summary">
          <span className={scene?.capabilities.objectPositions ? "cap-on" : ""}>POSITION</span>
          <span className={scene?.capabilities.objectLevels ? "cap-on" : ""}>LEVEL</span>
          <span className={scene?.capabilities.objectAudio ? "cap-on" : ""}>OBJECT AUDIO</span>
          <span className={scene?.capabilities.rerender ? "cap-on" : ""}>RE-RENDER</span>
        </div>
      </footer>

      <Timeline currentTime={transport.currentTime} duration={transport.duration || scene?.duration || 0} onSeek={transport.seek} />
      {processing && (
        <div className="processing-overlay" role="status" aria-live="polite">
          <div className="processing-dialog"><i /><strong>{processing}</strong><span>Processing stays entirely on this computer.</span></div>
        </div>
      )}
      {statusError && <div className="error-toast">{statusError}</div>}
      {exportNotice && <div className="export-toast">{exportNotice}</div>}
    </main>
  );
}
