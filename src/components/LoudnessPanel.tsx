import type { MonitorSignal } from "../hooks/useAudioTransport";

const display = (value: number) => (Number.isFinite(value) ? value.toFixed(1) : "−∞");

export function LoudnessPanel({ signal }: { signal: MonitorSignal }) {
  const rmsPower = (10 ** (signal.leftDb / 10) + 10 ** (signal.rightDb / 10)) * 0.5;
  const rmsLevel = rmsPower > 0 ? 10 * Math.log10(rmsPower) : -100;
  return (
    <section className="loudness-panel panel-frame">
      <div className="section-title-row">
        <h2>Loudness</h2>
        <span>LIVE STEREO ESTIMATE</span>
      </div>
      <div className="loudness-tabs"><strong>POST-MONITOR 2.0</strong><i className={signal.active ? "" : "inactive"} /></div>
      <div className="loudness-grid">
        <div><strong>{display(signal.shortTermLufs)}</strong><span>Short-term LUFS*</span></div>
        <div><strong>{display(signal.momentaryLufs)}</strong><span>Momentary LUFS*</span></div>
        <div><strong>{display(signal.integratedLufs)}</strong><span>Integrated LUFS*</span></div>
        <div><strong>{display(signal.loudnessRange)}</strong><span>Range LU*</span></div>
        <div><strong>{display(rmsLevel)}</strong><span>RMS dBFS</span></div>
        <div><strong>{display(signal.peakDb)}</strong><span>Sample peak dBFS</span></div>
      </div>
      <div className="speech-indicator"><span className="speech-bar" /><small>*Signal-derived monitor estimate; not a certified BS.1770 meter</small></div>
    </section>
  );
}
