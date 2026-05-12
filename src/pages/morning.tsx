import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import { getWeekKeyFromDate } from "@/lib/weekly-plan";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Check, ChevronDown, HeartPulse } from "lucide-react";
import { Link } from "wouter";

const DAY_MODES: {
  value: MorningRitual["mode"];
  label: string;
}[] = [
  { value: "productive", label: "Produtivo" },
  { value: "normal", label: "Normal" },
  { value: "survival", label: "Sobrevivência" },
];

const FEELING_OPTIONS = [
  { value: "muito mal", emoji: "😵", label: "Muito mal" },
  { value: "mal", emoji: "🙁", label: "Mal" },
  { value: "ok", emoji: "😐", label: "Ok" },
  { value: "bem", emoji: "🙂", label: "Bem" },
  { value: "muito bem", emoji: "😄", label: "Muito bem" },
] as const;

type ProofItem = {
  text: string;
  checked: boolean;
};

type StorageMode = "supabase" | "local";

function parseProofs(proofs: string): ProofItem[] {
  if (!proofs?.trim()) return [];

  return proofs
    .split("\n")
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

function serializeProofs(items: ProofItem[]) {
  return items
    .map((item) => `${item.checked ? "[x]" : "[ ]"} ${item.text}`)
    .join("\n");
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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getLegacyMorningData(dateKey: string) {
  const ritual = normalizeMorning(
    safeJsonParse(localStorage.getItem(`${dateKey}-morning-ritual`), {}),
  );

  const note = safeJsonParse(
    localStorage.getItem(`${dateKey}-morning-feeling-note`),
    "",
  );

  return {
    ritual,
    note: typeof note === "string" ? note : "",
  };
}

function saveLegacyMorningData(
  dateKey: string,
  ritual: MorningRitual,
  note: string,
) {
  localStorage.setItem(`${dateKey}-morning-ritual`, JSON.stringify(ritual));
  localStorage.setItem(`${dateKey}-morning-feeling-note`, JSON.stringify(note));
}

export default function Morning() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(dateKey);

  const [ritual, setRitual] = useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [feelingNote, setFeelingNote] = useState("");
  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [todayWeeklyFocus, setTodayWeeklyFocus] = useState("");
  const [pendingProofs, setPendingProofs] = useState<ProofItem[]>([]);
  const [prioritiesExpanded, setPrioritiesExpanded] = useState(false);
  const [feelingNoteExpanded, setFeelingNoteExpanded] = useState(false);
  const [proofsExpanded, setProofsExpanded] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [hasLoaded, setHasLoaded] = useState(false);

  const feelingValues = FEELING_OPTIONS.map((item) => item.value);
  const selectedFeeling = feelingValues.includes(ritual.feeling as any)
    ? ritual.feeling
    : "";

  const isSurvivalMode = ritual.mode === "survival";
  const isProductiveMode = ritual.mode === "productive";

  const loadWeeklyPlan = async (uid: string | null) => {
    if (!uid) {
      setWeeklyPlan(null);
      setTodayWeeklyFocus("");
      setPendingProofs([]);
      return;
    }

    const { data, error } = await supabase
      .from("weekly_meta")
      .select("plan")
      .eq("user_id", uid)
      .eq("week_key", weekKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar plano semanal na manhã:", error);
      setWeeklyPlan(null);
      setTodayWeeklyFocus("");
      setPendingProofs([]);
      return;
    }

    const plan = data?.plan ?? null;
    setWeeklyPlan(plan);

    const today = new Date(dateKey + "T12:00:00");
    const day = today.getDay();

    const focusByDay = [
      plan?.sunday ?? "",
      plan?.monday ?? "",
      plan?.tuesday ?? "",
      plan?.wednesday ?? "",
      plan?.thursday ?? "",
      plan?.friday ?? "",
      plan?.saturday ?? "",
    ];

    setTodayWeeklyFocus(focusByDay[day] ?? "");

    const parsedProofs = parseProofs(plan?.proofs ?? "");
    setPendingProofs(parsedProofs.filter((proof) => !proof.checked));
  };

  useEffect(() => {
    let cancelled = false;

    const loadMorning = async () => {
      setHasLoaded(false);

      try {
        const uid = await getCurrentUserId();
        if (cancelled) return;

        if (!uid) {
          const legacy = getLegacyMorningData(dateKey);

          setUserId(null);
          setStorageMode("local");
          setRitual(legacy.ritual);
          setFeelingNote(legacy.note);
          setWeeklyPlan(null);
          
