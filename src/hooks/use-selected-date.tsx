import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentDateKey } from "@/lib/date";

type SelectedDateContextValue = {
  selectedDateKey: string;
  setSelectedDateKey: (dateKey: string) => void;
  goToToday: () => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
};

const SelectedDateContext = createContext<SelectedDateContextValue | null>(
  null,
);

function shiftDate(dateKey: string, amount: number) {
  const date = new Date(dateKey + "T12:00:00");
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function SelectedDateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialToday = getCurrentDateKey();
  const [selectedDateKey, setSelectedDateKeyState] = useState(initialToday);
  const lastKnownTodayRef = useRef(initialToday);

  useEffect(() => {
    const syncTodayIfNeeded = () => {
      const currentToday = getCurrentDateKey();

      setSelectedDateKeyState((prev) => {
        if (prev === lastKnownTodayRef.current) {
          return currentToday;
        }
        return prev;
      });

      lastKnownTodayRef.current = currentToday;
    };

    const intervalId = window.setInterval(syncTodayIfNeeded, 60000);

    const handleFocus = () => {
      syncTodayIfNeeded();
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        syncTodayIfNeeded();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const value = useMemo<SelectedDateContextValue>(
    () => ({
      selectedDateKey,
      setSelectedDateKey: (dateKey: string) => {
        setSelectedDateKeyState(dateKey);
      },
      goToToday: () => {
        const today = getCurrentDateKey();
        lastKnownTodayRef.current = today;
        setSelectedDateKeyState(today);
      },
      goToPreviousDay: () => {
        setSelectedDateKeyState((prev) => shiftDate(prev, -1));
      },
      goToNextDay: () => {
        setSelectedDateKeyState((prev) => shiftDate(prev, 1));
      },
    }),
    [selectedDateKey],
  );

  return (
    <SelectedDateContext.Provider value={value}>
      {children}
    </SelectedDateContext.Provider>
  );
}

export function useSelectedDate() {
  const context = useContext(SelectedDateContext);

  if (!context) {
    throw new Error(
      "useSelectedDate deve ser usado dentro de SelectedDateProvider.",
    );
  }

  return context;
}
