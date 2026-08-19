import { useMemo, useState } from "react";
import type { SceneSample, Vec3 } from "../domain/scene";
import type { MonitorSignal } from "../hooks/useAudioTransport";

const speakers: Array<{ label: string; position: Vec3 }> = [
  { label: "L", position: { x: -0.8, y: 1, z: 0 } },
  { label: "R", position: { x: 0.8, y: 1, z: 0 } },
  { label: "C", position: { x: 0, y: 1, z: 0 } },
  { label: "LFE", position: { x: 0, y: 0.5, z: 0 } },
  { label: "Ls", position: { x: -1, y: 0, z: 0 } },
  { label: "Rs", position: { x: 1, y: 0, z: 0 } },
  { label: "Lrs", position: { x: -0.9, y: -1, z: 0 } },
  { label: "Rrs", position: { x: 0.9, y: -1, z: 0 } },
  { label: "Ltf", position: { x: -0.65, y: 0.65, z: 1 } },
  { label: "Rtf", position: { x: 0.65, y: 0.65, z: 1 } },
  { label: "Ltr", position: { x: -0.65, y: -0.65, z: 1 } },
  { label: "Rtr", position: { x: 0.65, y: -0.65, z: 1 } },
];

function calculateMeter(position: Vec3, sample: SceneSample) {
  let energy = 0;
  for (const object of sample.objects) {
    if (object.loudness <= -95) continue;
    const dx = object.position.x - position.x;
    const dy = object.position.y - position.y;
    const dz = object.position.z - position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const weight = 1 / (0.55 + distance * 1.25);
    energy += 10 ** (object.loudness / 20) * weight;
  }
  const db = 20 * Math.log10(Math.max(energy / 3.2, 0.00001));
  return Math.max(-60, Math.min(0, db));
}

export function OutputMeters({ sample, signal }: { sample: SceneSample; signal: MonitorSignal }) {
  const [mode, setMode] = useState<"live" | "scene">("live");
  const sceneLevels = useMemo(
    () => speakers.map((speaker) => calculateMeter(speaker.position, sample)),
    [sample],
  );
  const channels = mode === "live"
    ? [{ label: "L", level: signal.leftDb }, { label: "R", level: signal.rightDb }]
    : speakers.map((speaker, index) => ({ label: speaker.label, level: sceneLevels[index] }));

  return (
    <section className="meter-panel panel-frame">
      <div className="section-title-row">
        <h2>Output</h2>
        <div className="section-mode-buttons">
          <button className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>LIVE 2.0</button>
          <button className={mode === "scene" ? "active" : ""} onClick={() => setMode("scene")}>SCENE 7.1.4</button>
        </div>
      </div>
      <div className={`meter-rack ${mode === "live" ? "live-meter-rack" : ""}`}>
        <div className="meter-scale"><span>0</span><span>−12</span><span>−24</span><span>−36</span><span>−48</span><span>−60</span></div>
        {channels.map((channel) => {
          const level = Math.max(-60, Math.min(0, channel.level));
          const height = ((level + 60) / 60) * 100;
          return (
            <div className="meter-channel" key={channel.label} title={`${channel.label} ${channel.level.toFixed(1)} dBFS`}>
              <div className="meter-well">
                <div className="meter-fill" style={{ height: `${height}%` }} />
                <div className="meter-peak" style={{ bottom: `${Math.min(98, height + 2)}%` }} />
              </div>
              <span>{channel.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
