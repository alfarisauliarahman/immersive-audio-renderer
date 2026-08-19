import type { SceneSample } from "../domain/scene";

const speakerNodes = [
  ["L", 17, 14], ["C", 50, 14], ["R", 83, 14],
  ["LFE", 50, 26], ["Ls", 8, 51], ["Rs", 92, 51],
  ["Lrs", 17, 88], ["Rrs", 83, 88],
  ["Ltf", 28, 39], ["Rtf", 72, 39], ["Ltr", 28, 72], ["Rtr", 72, 72],
] as const;

type SpeakerViewProps = {
  sample: SceneSample;
  selectedInput: number | null;
  onSelect: (inputId: number) => void;
};

export function SpeakerView({ sample, selectedInput, onSelect }: SpeakerViewProps) {
  return (
    <section className="speaker-panel panel-frame">
      <div className="section-title-row floating-title"><h2>Speaker View</h2><span>TOP</span></div>
      <div className="speaker-stage">
        <div className="front-label"><span />FRONT<span /></div>
        <div className="listener-mark"><i /><span>LISTENER</span></div>
        {speakerNodes.map(([label, left, top]) => (
          <div className="speaker-node" key={label} style={{ left: `${left}%`, top: `${top}%` }}>
            <i /><span>{label}</span>
          </div>
        ))}
        {sample.objects.filter((object) => object.loudness > -72).map((object) => {
          const left = 50 + object.position.x * 39;
          const top = 50 - object.position.y * 38;
          const strength = Math.max(0.15, Math.min(1, (object.loudness + 78) / 58));
          return (
            <button
              className={`top-object ${object.highlighted ? "highlighted" : ""} ${selectedInput === object.inputId ? "selected" : ""}`}
              key={object.id}
              style={{ left: `${left}%`, top: `${top}%`, opacity: 0.35 + strength * 0.65 }}
              onClick={() => onSelect(object.inputId)}
              title={`Input ${object.inputId}`}
            >
              <i style={{ transform: `scale(${0.75 + strength * 0.55})` }} />
              <span>{object.inputId}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
