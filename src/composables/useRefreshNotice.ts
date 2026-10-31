import {
  getCurrentScope,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";

export const REFRESH_NOTICE_DELAY_MS = 60_000;

export function useRefreshNotice(
  lastSuccessfulRefreshAt: Ref<number | null>,
  isLive: ComputedRef<boolean>,
  now: () => number = Date.now,
) {
  const isStale = ref(false);
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const update = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;

    const timestamp = lastSuccessfulRefreshAt.value;
    if (!isLive.value || timestamp === null) {
      isStale.value = false;
      return;
    }

    const delay = REFRESH_NOTICE_DELAY_MS + 1 - (now() - timestamp);
    if (delay <= 0) {
      isStale.value = true;
      return;
    }

    isStale.value = false;
    timeout = setTimeout(() => {
      isStale.value = isLive.value &&
        lastSuccessfulRefreshAt.value === timestamp &&
        now() - timestamp > REFRESH_NOTICE_DELAY_MS;
      timeout = null;
    }, delay);
  };

  const stop = watch([lastSuccessfulRefreshAt, isLive], update, {
    immediate: true,
    flush: "sync",
  });
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
      if (timeout !== null) clearTimeout(timeout);
    });
  }

  return isStale;
}