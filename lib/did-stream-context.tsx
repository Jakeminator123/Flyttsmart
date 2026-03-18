"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DIDStreamState {
  stream: MediaStream | null;
  avatarReady: boolean;
}

interface DIDStreamContextValue extends DIDStreamState {
  setStream: (stream: MediaStream | null) => void;
  setAvatarReady: (ready: boolean) => void;
}

const DIDStreamContext = createContext<DIDStreamContextValue>({
  stream: null,
  avatarReady: false,
  setStream: () => {},
  setAvatarReady: () => {},
});

export function DIDStreamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DIDStreamState>({ stream: null, avatarReady: false });

  const setStream = useCallback((stream: MediaStream | null) => {
    setState((prev) => ({ ...prev, stream }));
  }, []);

  const setAvatarReady = useCallback((avatarReady: boolean) => {
    setState((prev) => ({ ...prev, avatarReady }));
  }, []);

  return (
    <DIDStreamContext.Provider value={{ ...state, setStream, setAvatarReady }}>
      {children}
    </DIDStreamContext.Provider>
  );
}

export function useDIDStream() {
  return useContext(DIDStreamContext);
}
