import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDashboardPoller,
  type VisibilityTarget,
} from "../../src/app/dashboardPolling";

function makeVisibilityTarget() {
  let listener: (() => void) | null = null;
  const target: VisibilityTarget = {
    visibilityState: "visible",
    addEventListener: vi.fn((_type, callback) => {
      listener = callback;
    }),
    removeEventListener: vi.fn((_type, callback) => {
      if (listener === callback) listener = null;
    }),
  };

  return {
    target,
    setVisibility(visibilityState: string) {
      target.visibilityState = visibilityState;
      listener?.();
    },
  };
}

describe("createDashboardPoller", () => {
  afterEach(() => vi.useRealTimers());

  it("polls while visible and refreshes immediately when visibility returns", () => {
    vi.useFakeTimers();
    const visibility = makeVisibilityTarget();
    const poll = vi.fn();
    const refreshOnVisible = vi.fn();
    const poller = createDashboardPoller(
      visibility.target,
      poll,
      refreshOnVisible,
    );

    poller.start();
    vi.advanceTimersByTime(15000);
    expect(poll).toHaveBeenCalledTimes(1);

    visibility.setVisibility("hidden");
    vi.advanceTimersByTime(30000);
    expect(poll).toHaveBeenCalledTimes(1);

    visibility.setVisibility("visible");
    expect(refreshOnVisible).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15000);
    expect(poll).toHaveBeenCalledTimes(2);

    poller.stop();
  });

  it("waits while initially hidden and removes its listener on stop", () => {
    vi.useFakeTimers();
    const visibility = makeVisibilityTarget();
    visibility.target.visibilityState = "hidden";
    const poll = vi.fn();
    const refreshOnVisible = vi.fn();
    const poller = createDashboardPoller(
      visibility.target,
      poll,
      refreshOnVisible,
    );

    poller.start();
    vi.advanceTimersByTime(30000);
    expect(poll).not.toHaveBeenCalled();

    visibility.setVisibility("visible");
    expect(refreshOnVisible).toHaveBeenCalledTimes(1);
    poller.stop();
    visibility.setVisibility("hidden");
    visibility.setVisibility("visible");
    vi.advanceTimersByTime(30000);

    expect(poll).not.toHaveBeenCalled();
    expect(refreshOnVisible).toHaveBeenCalledTimes(1);
    expect(visibility.target.removeEventListener).toHaveBeenCalledOnce();
  });
});
