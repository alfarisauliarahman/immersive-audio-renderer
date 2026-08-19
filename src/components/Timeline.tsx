type TimelineProps = {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
};

function clock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function Timeline({ currentTime, duration, onSeek }: TimelineProps) {
  return (
    <div className="timeline-bar">
      <span>{clock(currentTime)}</span>
      <input
        aria-label="Timeline"
        type="range"
        min="0"
        max={duration || 1}
        step="0.01"
        value={Math.min(currentTime, duration || 1)}
        onInput={(event) => onSeek(Number(event.currentTarget.value))}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <span>{clock(duration)}</span>
    </div>
  );
}
