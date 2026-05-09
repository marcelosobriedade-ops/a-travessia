import { useState, useEffect } from "react";

export type Appearance = "day" | "candle";

export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(() => {
    return (localStorage.getItem("planner-appearance") as Appearance) || "day";
  });

  useEffect(() => {
    if (appearance === "candle") {
      document.documentElement.classList.add("theme-candle");
    } else {
      document.documentElement.classList.remove("theme-candle");
    }
  }, [appearance]);

  useEffect(() => {
    const saved = (localStorage.getItem("planner-appearance") as Appearance) || "day";
    if (saved === "candle") {
      document.documentElement.classList.add("theme-candle");
    }
  }, []);

  const setAppearance = (value: Appearance) => {
    localStorage.setItem("planner-appearance", value);
    setAppearanceState(value);
  };

  return { appearance, setAppearance };
}
