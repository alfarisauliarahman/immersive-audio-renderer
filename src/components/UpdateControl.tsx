import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing" | "current" | "error";

export function UpdateControl() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const updateRef = useRef<Update | null>(null);

  const checkForUpdate = async (manual: boolean) => {
    if (!isTauri() || phase === "checking" || phase === "downloading" || phase === "installing") return;
    setPhase("checking");
    try {
      const update = await check({ timeout: 15_000 });
      if (updateRef.current && updateRef.current !== update) await updateRef.current.close();
      updateRef.current = update;
      if (update) {
        setVersion(update.version);
        setPhase("available");
      } else {
        setVersion(null);
        setPhase(manual ? "current" : "idle");
        if (manual) window.setTimeout(() => setPhase("idle"), 3500);
      }
    } catch {
      setPhase(manual ? "error" : "idle");
      if (manual) window.setTimeout(() => setPhase("idle"), 5000);
    }
  };

  const installUpdate = async () => {
    const update = updateRef.current;
    if (!update || phase !== "available") return;
    let downloaded = 0;
    let total: number | undefined;
    setPhase("downloading");
    setProgress(0);
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength;
        if (event.event === "Progress") downloaded += event.data.chunkLength;
        if (event.event === "Progress" && total) setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        if (event.event === "Finished") {
          setProgress(100);
          setPhase("installing");
        }
      });
      await relaunch();
    } catch {
      setProgress(null);
      setPhase("error");
      window.setTimeout(() => setPhase("available"), 5000);
    }
  };

  useEffect(() => {
    if (!isTauri()) return;
    const timer = window.setTimeout(() => void checkForUpdate(false), 2500);
    return () => window.clearTimeout(timer);
    // The startup check intentionally runs once per application launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isTauri()) return null;
  const label = phase === "checking" ? "CHECKING…"
    : phase === "available" ? `UPDATE ${version ?? ""}`
      : phase === "downloading" ? `DOWNLOADING ${progress ?? 0}%`
        : phase === "installing" ? "INSTALLING…"
          : phase === "current" ? "UP TO DATE"
            : phase === "error" ? "UPDATE FAILED"
              : "CHECK UPDATE";

  return (
    <button
      className={`update-button ${phase === "available" ? "active" : ""}`}
      disabled={phase === "checking" || phase === "downloading" || phase === "installing"}
      title={phase === "available" ? `Download, verify, and install version ${version}` : "Check the signed release channel for updates"}
      onClick={() => phase === "available" ? void installUpdate() : void checkForUpdate(true)}
    >{label}</button>
  );
}
