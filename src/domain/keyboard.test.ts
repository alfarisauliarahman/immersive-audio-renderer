import { describe, expect, it } from "vitest";
import { resolveRendererShortcut } from "./keyboard";

describe("renderer keyboard shortcuts", () => {
  it("maps transport and monitor keys", () => {
    expect(resolveRendererShortcut({ key: " ", code: "Space" })).toBe("play-pause");
    expect(resolveRendererShortcut({ key: "ArrowLeft" })).toBe("seek-back");
    expect(resolveRendererShortcut({ key: "ArrowRight" })).toBe("seek-forward");
    expect(resolveRendererShortcut({ key: "m" })).toBe("toggle-mute");
    expect(resolveRendererShortcut({ key: "D" })).toBe("toggle-dim");
  });

  it("supports both O and the platform open chord", () => {
    expect(resolveRendererShortcut({ key: "o" })).toBe("open-file");
    expect(resolveRendererShortcut({ key: "o", ctrlKey: true })).toBe("open-file");
    expect(resolveRendererShortcut({ key: "o", metaKey: true })).toBe("open-file");
  });

  it("does not hijack editable controls or unrelated modifier chords", () => {
    expect(resolveRendererShortcut({ key: "m", editable: true })).toBeNull();
    expect(resolveRendererShortcut({ key: "s", ctrlKey: true })).toBeNull();
    expect(resolveRendererShortcut({ key: "d", altKey: true })).toBeNull();
  });

  it("suppresses repeated toggles while allowing repeated seeking", () => {
    expect(resolveRendererShortcut({ key: "m", repeat: true })).toBeNull();
    expect(resolveRendererShortcut({ key: "ArrowRight", repeat: true })).toBe("seek-forward");
  });
});
