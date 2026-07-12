import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface GuestModeContext {
  isGuest: boolean;
  enableGuestMode: () => void;
  disableGuestMode: () => void;
}

const GuestContext = createContext<GuestModeContext>({
  isGuest: false,
  enableGuestMode: () => {},
  disableGuestMode: () => {},
});

const GUEST_KEY = "testgen-guest-mode";

export function GuestModeProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return sessionStorage.getItem(GUEST_KEY) === "true";
    } catch {
      return false;
    }
  });

  const enableGuestMode = useCallback(() => {
    sessionStorage.setItem(GUEST_KEY, "true");
    setIsGuest(true);
  }, []);

  const disableGuestMode = useCallback(() => {
    sessionStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  }, []);

  return (
    <GuestContext.Provider value={{ isGuest, enableGuestMode, disableGuestMode }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuestMode() {
  return useContext(GuestContext);
}
