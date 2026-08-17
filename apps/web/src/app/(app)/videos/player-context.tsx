"use client";

import type { MediaPlayerInstance } from "@vidstack/react";
import { createContext, useContext, useMemo, useRef } from "react";

type PlayerControls = {
  register: (player: MediaPlayerInstance | null) => void;
  seek: (seconds: number) => void;
};

const PlayerContext = createContext<PlayerControls | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<MediaPlayerInstance | null>(null);

  const value = useMemo<PlayerControls>(
    () => ({
      register: (player) => {
        ref.current = player;
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
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayerControls(): PlayerControls | null {
  return useContext(PlayerContext);
}
