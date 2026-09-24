import type { ReadingProgress } from "@/types/models";

const CLOSE_MS = 2 * 60 * 1000;

/** Newer intentional position wins. Close updates keep the further progress so an older device cannot rewind. */
export function mergeReadingProgress(local?: ReadingProgress, remote?: ReadingProgress): ReadingProgress | undefined {
  if (!local) return remote;
  if (!remote) return local;
  const delta = Math.abs(local.lastReadAt - remote.lastReadAt);
  if (delta <= CLOSE_MS) {
    if (remote.overallProgress > local.overallProgress + 0.01) return remote;
    if (local.overallProgress > remote.overallProgress + 0.01) return local;
  }
  return remote.lastReadAt > local.lastReadAt ? remote : local;
}

export function deviceId(): string {
  if (typeof localStorage === "undefined") return "server";
  const key = "paper-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}`;
  localStorage.setItem(key, id);
  return id;
}
