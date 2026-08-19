import { useCallback, useEffect, useRef, useState } from "react";

type TransportOptions = {
  source: string;
  attenuation: number;
  dimmed: boolean;
  muted: boolean;
  monitorBoostDb?: number;
};

export type MonitorSignal = {
  active: boolean;
  leftDb: number;
  rightDb: number;
  peakDb: number;
  momentaryLufs: number;
  shortTermLufs: number;
  integratedLufs: number;
  loudnessRange: number;
};

const SILENT_SIGNAL: MonitorSignal = {
  active: false,
  leftDb: -100,
  rightDb: -100,
  peakDb: -100,
  momentaryLufs: -100,
  shortTermLufs: -100,
  integratedLufs: -100,
  loudnessRange: 0,
};

const powerToLufs = (power: number) =>
  power > 0 ? Math.max(-100, -0.691 + 10 * Math.log10(power)) : -100;

const powerToDb = (power: number) =>
  power > 0 ? Math.max(-100, 10 * Math.log10(power)) : -100;

export function useAudioTransport({
  source,
  attenuation,
  dimmed,
  muted,
  monitorBoostDb = 0,
}: TransportOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<MonitorSignal>(SILENT_SIGNAL);
  const needsMonitorProcessing = monitorBoostDb > 0;

  useEffect(() => {
    if (!source) {
      audioRef.current = null;
      setDuration(0);
      setCurrentTime(0);
      setPlaying(false);
      setError(null);
      setSignal(SILENT_SIGNAL);
      return;
    }
    const audio = new Audio();
    // Tauri exposes native files through its asset protocol, which is a
    // different origin from the app.  Web Audio deliberately outputs silence
    // for cross-origin media unless CORS mode is selected before assigning src.
    audio.crossOrigin = "anonymous";
    audio.preload = "metadata";
    audio.src = source;
    audioRef.current = audio;
    setDuration(0);
    setCurrentTime(0);
    setError(null);
    setSignal(SILENT_SIGNAL);

    const onMetadata = () => {
      const nextDuration = audio.duration || 0;
      setDuration(nextDuration);
      if (pendingSeekRef.current !== null && nextDuration > 0) {
        const nextTime = Math.max(0, Math.min(nextDuration, pendingSeekRef.current));
        audio.currentTime = nextTime;
        setCurrentTime(nextTime);
        pendingSeekRef.current = null;
      }
    };
    const onEnded = () => setPlaying(false);
    const onError = () => setError("Audio fixture could not be loaded.");

    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    let mediaSource: MediaElementAudioSourceNode | null = null;
    let monitorGain: GainNode | null = null;
    let limiter: DynamicsCompressorNode | null = null;
    let splitter: ChannelSplitterNode | null = null;
    let leftAnalyser: AnalyserNode | null = null;
    let rightAnalyser: AnalyserNode | null = null;
    let leftSamples: Float32Array<ArrayBuffer> | null = null;
    let rightSamples: Float32Array<ArrayBuffer> | null = null;
    let lastSignalUpdate = 0;
    let lastTimelineUpdate = 0;
    let integratedPower = 0;
    let integratedCount = 0;
    const powerHistory: Array<{ at: number; power: number }> = [];
    const shortTermHistory: number[] = [];

    const analyzeSignal = (now: number) => {
      if (!leftAnalyser || !rightAnalyser || !leftSamples || !rightSamples || now - lastSignalUpdate < 100) return;
      lastSignalUpdate = now;
      leftAnalyser.getFloatTimeDomainData(leftSamples);
      rightAnalyser.getFloatTimeDomainData(rightSamples);
      let leftPower = 0;
      let rightPower = 0;
      let peak = 0;
      for (let index = 0; index < leftSamples.length; index += 1) {
        const left = leftSamples[index];
        const right = rightSamples[index];
        leftPower += left * left;
        rightPower += right * right;
        peak = Math.max(peak, Math.abs(left), Math.abs(right));
      }
      leftPower /= leftSamples.length;
      rightPower /= rightSamples.length;
      const stereoPower = (leftPower + rightPower) * 0.5;
      const at = now / 1000;
      powerHistory.push({ at, power: stereoPower });
      while (powerHistory[0] && powerHistory[0].at < at - 3) powerHistory.shift();
      integratedPower += stereoPower;
      integratedCount += 1;
      const windowPower = (seconds: number) => {
        const entries = powerHistory.filter((entry) => entry.at >= at - seconds);
        return entries.reduce((sum, entry) => sum + entry.power, 0) / Math.max(1, entries.length);
      };
      const shortTermLufs = powerToLufs(windowPower(3));
      if (shortTermLufs > -70) {
        shortTermHistory.push(shortTermLufs);
        if (shortTermHistory.length > 3600) shortTermHistory.shift();
      }
      const sorted = [...shortTermHistory].sort((a, b) => a - b);
      const percentile = (amount: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))] ?? -100;
      setSignal({
        active: true,
        leftDb: powerToDb(leftPower),
        rightDb: powerToDb(rightPower),
        peakDb: peak > 0 ? Math.max(-100, 20 * Math.log10(peak)) : -100,
        momentaryLufs: powerToLufs(windowPower(0.4)),
        shortTermLufs,
        integratedLufs: powerToLufs(integratedPower / Math.max(1, integratedCount)),
        loudnessRange: sorted.length > 3 ? Math.max(0, percentile(0.95) - percentile(0.1)) : 0,
      });
    };

    const tick = (now: number) => {
      if (now - lastTimelineUpdate >= 33) {
        lastTimelineUpdate = now;
        setCurrentTime(audio.currentTime || 0);
      }
      analyzeSignal(now);
      if (!audio.paused && !audio.ended) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      setPlaying(true);
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      setCurrentTime(audio.currentTime || 0);
      setSignal((current) => ({ ...current, active: false, leftDb: -100, rightDb: -100, peakDb: -100 }));
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    try {
      const context = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = context;
      mediaSource = context.createMediaElementSource(audio);
      monitorGain = context.createGain();
      mediaSource.connect(monitorGain);
      let monitorOutput: AudioNode = monitorGain;
      if (needsMonitorProcessing) {
        limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;
        monitorGain.connect(limiter);
        monitorOutput = limiter;
      }
      monitorOutput.connect(context.destination);
      splitter = context.createChannelSplitter(2);
      leftAnalyser = context.createAnalyser();
      rightAnalyser = context.createAnalyser();
      leftAnalyser.fftSize = 2048;
      rightAnalyser.fftSize = 2048;
      leftAnalyser.smoothingTimeConstant = 0;
      rightAnalyser.smoothingTimeConstant = 0;
      monitorOutput.connect(splitter);
      splitter.connect(leftAnalyser, 0);
      splitter.connect(rightAnalyser, 1);
      leftSamples = new Float32Array(leftAnalyser.fftSize);
      rightSamples = new Float32Array(rightAnalyser.fftSize);
      monitorGainRef.current = monitorGain;
      audio.volume = 1;
    } catch {
      // Direct media-element playback remains available if Web Audio is unavailable.
      monitorGainRef.current = null;
    }

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      audio.pause();
      audio.src = "";
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      mediaSource?.disconnect();
      monitorGain?.disconnect();
      limiter?.disconnect();
      splitter?.disconnect();
      leftAnalyser?.disconnect();
      rightAnalyser?.disconnect();
      if (monitorGainRef.current === monitorGain) monitorGainRef.current = null;
      audioRef.current = null;
    };
  }, [needsMonitorProcessing, source]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== "closed") void context.close();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const outputDb = attenuation + monitorBoostDb + (dimmed ? -20 : 0);
    const outputGain = muted ? 0 : 10 ** (outputDb / 20);
    const monitorGain = monitorGainRef.current;
    if (monitorGain) {
      monitorGain.gain.setValueAtTime(outputGain, monitorGain.context.currentTime);
      audio.volume = 1;
    } else {
      audio.volume = Math.max(0, Math.min(1, outputGain));
    }
  }, [attenuation, dimmed, monitorBoostDb, muted, source]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    try {
      const context = audioContextRef.current;
      if (context?.state === "suspended") await context.resume();
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Playback was blocked.");
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      pendingSeekRef.current = Math.max(0, time);
      return;
    }
    pendingSeekRef.current = null;
    const next = Math.max(0, Math.min(audio.duration, time));
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const rewind = useCallback(() => seek(Math.max(0, currentTime - 10)), [currentTime, seek]);

  return {
    currentTime,
    duration,
    playing,
    error,
    signal,
    togglePlayback,
    stop,
    seek,
    rewind,
  };
}
