"use client";

import type { MediaPlayerInstance } from "@vidstack/react";
import { createContext, useContext, useMemo, useRef, useState } from "react";

type PlayerControls = {
  register: (player: MediaPlayerInstance | null) => void;
  seek: (seconds: number) => void;
};

// Two contexts: controls are stable (so the player's ref callback doesn't churn);
// time changes ~1/sec and only components that read it re-render.
const ControlsContext = createContext<PlayerControls | null>(null);
const TimeContext = createContext<number>(0);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<MediaPlayerInstance | null>(null);
  const unsub = useRef<(() => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const controls = useMemo<PlayerControls>(
    () => ({
      register: (player) => {
        ref.current = player;
        unsub.current?.();
        unsub.current = null;
        if (player && typeof player.subscribe === "function") {
          let last = -1;
          unsub.current = player.subscribe((state) => {
            const t = Math.floor(state.currentTime);
            if (t !== last) {
              last = t;
              setCurrentTime(t);
            }
          });
        }
      },
      seek: (seconds) => {
        const player = ref.current;
        if (!player) return;
        player.currentTime = seconds;
        void player.play();
      },
    }),
    [],
  );

  return (
    <ControlsContext.Provider value={controls}>
      <TimeContext.Provider value={currentTime}>{children}</TimeContext.Provider>
    </ControlsContext.Provider>
  );
}

export function usePlayerControls(): PlayerControls | null {
  return useContext(ControlsContext);
}

export function usePlayerTime(): number {
  return useContext(TimeContext);
}
