type TopBarProps = {
  currentTime: number;
  playing: boolean;
  attenuation: number;
  dimmed: boolean;
  muted: boolean;
  onAttenuationChange: (value: number) => void;
  onDimToggle: () => void;
  onMuteToggle: () => void;
  onPlayToggle: () => void;
  onStop: () => void;
  onRewind: () => void;
};

function formatTimecode(seconds: number, frameRate = 24) {
  const withReference = Math.max(0, seconds) + 3600;
  const hours = Math.floor(withReference / 3600);
  const minutes = Math.floor((withReference % 3600) / 60);
  const wholeSeconds = Math.floor(withReference % 60);
  const frames = Math.floor((withReference - Math.floor(withReference)) * frameRate);
  return [hours, minutes, wholeSeconds, frames]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

const TransportIcon = ({ type }: { type: "rewind" | "stop" | "play" | "pause" }) => {
  if (type === "rewind") return <span aria-hidden>↶</span>;
  if (type === "stop") return <span className="stop-square" aria-hidden />;
  if (type === "pause") return <span aria-hidden>Ⅱ</span>;
  return <span className="play-triangle" aria-hidden />;
};

export function TopBar(props: TopBarProps) {
  return (
    <header className="top-bar">
      <section className="toolbar-group monitoring-group">
        <span className="toolbar-label">Monitor path</span>
        <div className="static-readout">STEREO 2.0</div>
      </section>

      <section className="toolbar-group source-group">
        <span className="toolbar-label">Source</span>
        <div className="static-readout active">MASTER</div>
      </section>

      <section className="toolbar-group timecode-group">
        <span className="toolbar-label">Timecode</span>
        <div className="timecode-readout">
          <span>{formatTimecode(props.currentTime)}</span>
          <small>24</small>
        </div>
      </section>

      <section className="toolbar-group transport-group">
        <span className="toolbar-label">Transport</span>
        <div className="transport-buttons">
          <button aria-label="Rewind 10 seconds" onClick={props.onRewind}>
            <TransportIcon type="rewind" />
          </button>
          <button aria-label="Stop" onClick={props.onStop}>
            <TransportIcon type="stop" />
          </button>
          <button className="primary" aria-label={props.playing ? "Pause" : "Play"} onClick={props.onPlayToggle}>
            <TransportIcon type={props.playing ? "pause" : "play"} />
          </button>
        </div>
      </section>

      <section className="toolbar-group attenuation-group">
        <span className="toolbar-label">Attenuation</span>
        <div className="attenuation-line">
          <span className="dial-glyph">◔</span>
          <input
            aria-label="Attenuation"
            type="range"
            min="-30"
            max="0"
            step="1"
            value={props.attenuation}
            onChange={(event) => props.onAttenuationChange(Number(event.target.value))}
          />
          <strong>{props.attenuation.toFixed(2)} dB</strong>
        </div>
      </section>

      <section className="toolbar-group monitor-controls">
        <span className="toolbar-label">Output</span>
        <div>
          <button className={props.dimmed ? "active" : ""} onClick={props.onDimToggle}>DIM</button>
          <button className={props.muted ? "danger active" : ""} onClick={props.onMuteToggle}>MUTE</button>
        </div>
      </section>
    </header>
  );
}
