export function openSharedMediaPicker({
  view = "user",
  onPick,
  onBlocked,
} = {}) {
  if (typeof window === "undefined") return false;

  const channel = `gr8-media-picker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const url = new URL("/assets", window.location.origin);
  url.searchParams.set("picker", "1");
  url.searchParams.set("channel", channel);
  url.searchParams.set("view", view === "generic" ? "generic" : view === "icons" ? "icons" : view === "videos" ? "videos" : "user");

  let cleanup = null;
  const listener = (event) => {
    if (event.origin !== window.location.origin) return;
    const payload = event.data;
    if (!payload || payload.type !== "gr8:media-picker-select" || payload.channel !== channel) return;
    cleanup?.();
    onPick?.(payload.asset || null);
  };

  const closePoll = window.setInterval(() => {
    if (!pickerWindow || pickerWindow.closed) {
      cleanup?.();
    }
  }, 500);

  cleanup = () => {
    window.removeEventListener("message", listener);
    window.clearInterval(closePoll);
    cleanup = null;
  };

  window.addEventListener("message", listener);
  const pickerWindow = window.open(url.toString(), "_blank");
  if (!pickerWindow) {
    cleanup();
    onBlocked?.();
    return false;
  }

  return true;
}
