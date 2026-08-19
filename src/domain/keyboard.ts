export type RendererShortcut =
  | "play-pause"
  | "stop"
  | "seek-back"
  | "seek-forward"
  | "toggle-mute"
  | "toggle-dim"
  | "open-file"
  | "toggle-source-info"
  | "toggle-shortcuts"
  | "close-panels";

export type ShortcutInput = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  editable?: boolean;
};

export function isShortcutEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable
    || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
    || Boolean(target.closest('[contenteditable="true"]'))
  );
}

export function resolveRendererShortcut(input: ShortcutInput): RendererShortcut | null {
  if (input.editable) return null;
  const key = input.key.toLowerCase();
  const commandModifier = Boolean(input.ctrlKey || input.metaKey);

  if (commandModifier && !input.altKey && key === "o") return "open-file";
  if (commandModifier || input.altKey) return null;

  if (input.repeat && key !== "arrowleft" && key !== "arrowright") return null;
  if (input.code === "Space" || key === " ") return "play-pause";

  switch (key) {
    case "k": return "play-pause";
    case "s": return "stop";
    case "arrowleft": return "seek-back";
    case "arrowright": return "seek-forward";
    case "m": return "toggle-mute";
    case "d": return "toggle-dim";
    case "o": return "open-file";
    case "i": return "toggle-source-info";
    case "?": return "toggle-shortcuts";
    case "escape": return "close-panels";
    default: return null;
  }
}
