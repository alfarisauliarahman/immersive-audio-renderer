import type { SceneSample } from "../domain/scene";

type InputMatrixProps = {
  sample: SceneSample;
  selectedInput: number | null;
  onSelect: (inputId: number) => void;
};

function levelClass(level: number, highlighted: boolean) {
  if (highlighted) return "highlighted";
  if (level > -35) return "hot";
  if (level > -55) return "active";
  if (level > -80) return "low";
  return "quiet";
}

export function InputMatrix({ sample, selectedInput, onSelect }: InputMatrixProps) {
  const byInput = new Map(sample.objects.map((object) => [object.inputId, object]));
  const lastObjectInput = Math.max(10, ...sample.objects.map((object) => object.inputId));

  return (
    <aside className="input-panel panel-frame">
      <div className="panel-heading">
        <div><span className="eyebrow">MASTER</span><h2>Renderer Inputs</h2></div>
        <span className="count-badge">128</span>
      </div>
      <div className="input-grid" aria-label="128 renderer inputs">
        {Array.from({ length: 128 }, (_, index) => {
          const inputId = index + 1;
          const object = byInput.get(inputId);
          const isBed = inputId <= 10;
          const assigned = isBed || Boolean(object);
          const activity = object
            ? levelClass(object.loudness, object.highlighted)
            : isBed
              ? levelClass(sample.overallLoudness - 13 - (index % 4) * 3, false)
              : "unused";
          return (
            <button
              key={inputId}
              className={`input-cell ${isBed ? "bed" : "object"} ${assigned ? "assigned" : ""} ${selectedInput === inputId ? "selected" : ""}`}
              onClick={() => assigned && onSelect(inputId)}
              disabled={!assigned}
              title={isBed ? `Bed input ${inputId}` : object ? `Spatial element ${object.id + 1}` : `Unused input ${inputId}`}
            >
              <span className={`input-orb ${activity}`} />
              <small>{inputId}</small>
            </button>
          );
        })}
      </div>
      <div className="input-legend">
        <span><i className="legend-dot bed-dot" />Bed 1–10</span>
        <span><i className="legend-dot object-dot" />Elements 11–{lastObjectInput}</span>
      </div>
    </aside>
  );
}
