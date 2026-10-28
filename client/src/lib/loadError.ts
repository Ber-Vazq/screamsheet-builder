// Phase 7: turn a failed artifact fetch into a state the public view can explain.
// apiRequest / getQueryFn throw Error("<status>: <body>"); fetch() itself throws
// a TypeError when the network is down.

export type LoadErrorKind = "notfound" | "unreadable" | "network";

export function classifyLoadError(err: unknown): LoadErrorKind {
  if (err instanceof TypeError) return "network";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const m = /^(\d{3}):/.exec(msg);
  if (!m) return /fetch|network|load failed/i.test(msg) ? "network" : "unreadable";
  const code = Number(m[1]);
  if (code === 404 || code === 400) return "notfound";
  return "unreadable";
}
