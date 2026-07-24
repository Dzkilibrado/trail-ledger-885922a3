export type VersionBroadcast =
  | { kind: "update_available"; buildId: string }
  | { kind: "reload_started"; buildId: string };

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    channel = new BroadcastChannel("tb-version");
  } catch {
    channel = null;
  }
  return channel;
}

export function broadcast(msg: VersionBroadcast) {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(msg);
  } catch {
    /* noop */
  }
}

export function onBroadcast(handler: (msg: VersionBroadcast) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (event: MessageEvent) => handler(event.data as VersionBroadcast);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}