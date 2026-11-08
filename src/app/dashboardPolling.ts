export interface VisibilityTarget {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export function createDashboardPoller(
  visibilityTarget: VisibilityTarget,
  poll: () => void,
  refreshOnVisible: () => void,
  intervalMs = 15000,
) {
  let interval: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const startInterval = () => {
    if (interval === null) interval = setInterval(poll, intervalMs);
  };

  const stopInterval = () => {
    if (interval === null) return;
    clearInterval(interval);
    interval = null;
  };

  const handleVisibilityChange = () => {
    if (visibilityTarget.visibilityState === "visible") {
      refreshOnVisible();
      startInterval();
    } else {
      stopInterval();
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      visibilityTarget.addEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      if (visibilityTarget.visibilityState === "visible") startInterval();
    },
    stop() {
      if (!started) return;
      started = false;
      visibilityTarget.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      stopInterval();
    },
  };
}
