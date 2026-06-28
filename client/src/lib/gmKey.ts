// Guarded GM-key persistence.
//
// localStorage throws (SecurityError) inside sandboxed iframes (e.g. the
// deploy_website preview), but works fine on a real domain like Vercel /
// pplx.app. Every access is wrapped so a blocked storage just no-ops and the
// key lives only in memory for that session.

const STORAGE_KEY = "screamsheet:gmKey";

let memoryKey = "";

function safeGet(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSet(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage blocked — fall back to in-memory only */
  }
}

function safeRemove(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage blocked — nothing to do */
  }
}

// Seed the in-memory copy from storage on module load.
memoryKey = safeGet() ?? "";

export function getGmKey(): string {
  // Prefer in-memory (always current), fall back to storage.
  return memoryKey || safeGet() || "";
}

export function setGmKey(key: string): void {
  memoryKey = key.trim();
  if (memoryKey) safeSet(memoryKey);
  else safeRemove();
}

export function clearGmKey(): void {
  memoryKey = "";
  safeRemove();
}

export function hasGmKey(): boolean {
  return getGmKey().length > 0;
}
