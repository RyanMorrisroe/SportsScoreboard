import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDashboardPoller,
  getLiveModalGameId,
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

describe("getLiveModalGameId", () => {
  it("uses the selected event ID until its detail data is available", () => {
    expect(
      getLiveModalGameId({
        open: true,
        view: "game",
        status: "in",
        selectedId: "live-event",
      }),
    ).toBe("live-event");
  });

  it("only returns IDs for a live game modal", () => {
    const base = {
      open: true,
      view: "game",
      status: "in",
      detailId: "detail-event",
      selectedId: "selected-event",
    };

    expect(getLiveModalGameId(base)).toBe("detail-event");
    expect(getLiveModalGameId({ ...base, status: "pre" })).toBeNull();
    expect(getLiveModalGameId({ ...base, status: "post" })).toBeNull();
    expect(getLiveModalGameId({ ...base, view: "team" })).toBeNull();
    expect(getLiveModalGameId({ ...base, open: false })).toBeNull();
  });
});
