"use client";

import { useEffect } from "react";

/**
 * Holds a screen wake lock while mounted.
 *
 * A name badge that goes black after thirty seconds is not a name badge. The
 * Screen Wake Lock API is the only way to prevent that from a web page, and it
 * is not available everywhere — iOS Safari only gained it in 16.4 and it is
 * absent in every in-app browser this community actually uses to open links.
 * There is no fallback worth building (the video-loop trick is a battery
 * bonfire), so where it is missing the page simply behaves like any other page
 * and the person taps the screen occasionally.
 */
export function KeepAwake() {
  useEffect(() => {
    // The DOM lib does not ship types for this yet in every TS version.
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };

    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        // The effect may have been cleaned up while the request was in flight.
        if (released) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied, or the tab was backgrounded mid-request. Not worth surfacing:
        // the page still works, the screen just dims like any other page.
      }
    };

    void acquire();

    // The lock is dropped whenever the tab is hidden — switching apps to show
    // someone something and coming back must not leave the badge dimming.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) void acquire();
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, []);

  return null;
}
