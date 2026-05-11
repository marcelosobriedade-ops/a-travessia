import { supabase } from "@/lib/supabase";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlan,
  getWeekKeyFromDate,
  getWeeklyPlanStatus,
  isEndOfWeek,
} from "@/lib/weekly-plan";
import { getStoicQuoteByDate } from "@/lib/stoic-quotes";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  Repeat,
  Wallet,
  Smile,
  Users,
  Flame,
  SunMedium,
  HeartPulse,
  AlertTriangle,
} from "lucide-react";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
  getWeeklyMeta,
} from "@/lib/user-data";

interface Task {
  id: string;
  title?: string;
  status: "todo" | "done" | "cancelled" | "critical" | "postponed";
}

type ProofItem = {
  text: string;
  checked: boolean;
};

type Period = "morning" | "afternoon" | "evening";
type LoadStatus = "loading" | "ready" | "error";

interface CheckIn {
  emotion: string | null;
  intensity: number | null;
  cause: string;
  observations: string;
}

interface EmotionsState {
  morning: CheckIn;
  afternoon: CheckIn;
  evening: CheckIn;
}

const defaultCheckIn: CheckIn = {
  emotion: null,
  intensity: null,
  cause: "",
  observations: "",
};

const defaultEmotionsState: EmotionsState = {
  morning: { ...defaultCheckIn },
  afternoon: { ...defaultCheckIn },
  evening: { ...defaultCheckIn },
};

const FEELING_OPTIONS = [
  { value: "muito mal", emoji: "😵", label: "Muito mal" },
  { value: "mal", emoji: "🙁", label: "Mal" },
  { value: "ok", emoji: "😐", label: "Ok" },
  { value: "bem", emoji: "🙂", label: "Bem" },
  { value: "muito bem", emoji: "😄", label: "Muito bem" },
] as const;

function parseProofs(proofs: string): ProofItem[] {
  if (!proofs?.trim()) return [];

  return proofs
    .split("\\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("[x] ")) {
        return { text: line.replace("[x] ", "").trim(), checked: true };
      }
      if (line.startsWith("[ ] ")) {
        return { text: line.replace("[ ] ", "").trim(), checked: false };
      }
      return { text: line, checked: false };
    });
}

function getCurrentPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function isLowState(value: string | null | undefined) {
  return value === "muito mal" || value === "mal";
}

function normalizePriorities(value: any): [string, string, string] {
  const arr = Array.isArray(value) ? value : [];
  return [
    typeof arr[0] === "string" ? arr[0] : "",
    typeof arr[1] === "string" ? arr[1] : "",
    typeof arr[2] === "string" ? arr[2] : "",
  ];
}

function normalizeMorning(value: any): MorningRitual {
  return {
    ...EMPTY_MORNING_RITUAL,
    ...(value || {}),
    priorities: normalizePriorities(value?.priorities),
  };
}

function normalizeCheckIn(value: any): CheckIn {
  return {
    emotion: typeof value?.emotion === "string" ? value.emotion : null,
    intensity: typeof value?.intensity === "number" ? value.intensity : null,
    cause: typeof value?.cause === "string" ? value.cause : "",
    observations:
      typeof value?.observations === "string" ? value.observations : "",
  };
}

function normalizeEmotions(value: any): EmotionsState {
  return {
    morning: normalizeCheckIn(value?.morning),
    afternoon: normalizeCheckIn(value?.afternoon),
    evening: normalizeCheckIn(value?.evening),
  };
}

function normalizeTasks(value: any): Task[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id:
      typeof item?.id === "string"
        ? item.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: typeof item?.title === "string" ? item.title : "",
    status:
      item?.status === "todo" ||
      item?.status === "done" ||
      item?.status === "cancelled" ||
      item?.status === "critical" ||
      item?.status === "postponed"
        ? item.status
        : "todo",
  }));
}

function normalizeWeeklyPlan(value: any): WeeklyPlan {
  return {
    ...EMPTY_WEEKLY_PLAN,
    change: typeof value?.change === "string" ? value.change : "",
    proofs: typeof value?.proofs === "string" ? value.proofs : "",
    risks: typeof value?.risks === "string" ? value.risks : "",
    prevention: typeof value?.prevention === "string" ? value.prevention : "",
    sunday: typeof value?.sunday === "string" ? value.sunday : "",
    monday: typeof value?.monday === "string" ? value.monday : "",
    tuesday: typeof value?.tuesday === "string" ? value.tuesday : "",
    wednesday: typeof value?.wednesday === "string" ? value.wednesday : "",
    thursday: typeof value?.thursday === "string" ? value.thursday : "",
    friday: typeof value?.friday === "string" ? value.friday : "",
    saturday: typeof value?.saturday === "string" ? value.saturday : "",
  };
}

export default function Home() {
  const [dateKey, setDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(dateKey);

  const [morningRitual, setMorningRitual] =
    useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [emotions, setEmotions] = useState<EmotionsState>(defaultEmotionsState);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);
  const [previousCycleFocus, setPreviousCycleFocus] = useState("");
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [weekVirtue, setWeekVirtue] = useState("");
  const [dayClosed, setDayClosed] = useState(false);
  const [showCloseSuccess, setShowCloseSuccess] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [savingClosed, setSavingClosed] = useState(false);

  useEffect(() => {
    const syncHour = () => setCurrentHour(new Date().getHours());
    syncHour();

    const intervalId = window.setInterval(syncHour, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadHomeData = async (silent = false) => {
    if (!silent) {
      setStatus("loading");
    }

    setErrorMessage("");

    try {
      const uid = await getCurrentUserId();
      setUserId(uid);

      const [daily, weeklyMetaResult, weeklyPlanResult] = await Promise.all([
        getDailyRecord(uid, dateKey),
        
