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
type StorageMode = "supabase" | "local";

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

function getCurrentPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function isLowState(value: string | null | undefined) {
  return value === "muito mal" || value === "mal";
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

function normalizeCompleted(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function getLegacyPreviousWeekClosingFocus(dateKey: string) {
  try {
    const currentDate = new Date(dateKey + "T12:00:00");
    const previousWeekDate = new Date(currentDate);
    previousWeekDate.setDate(previousWeekDate.getDate() - 7);
    const previousWeekDateKey = previousWeekDate.toISOString().slice(0, 10);
    const previousWeekKey = getWeekKeyFromDate(previousWeekDateKey);

    const raw = localStorage.getItem(`weekly-closing-${previousWeekKey}`);
    if (!raw) return "";

    const parsed = JSON.parse(raw);
    return typeof parsed?.nextFocus === "string" ? parsed.nextFocus.trim() : "";
  } catch (error) {
    console.error("Erro ao ler foco do ciclo anterior:", error);
    return "";
  }
}

function getLegacyData(dateKey: string, weekKey: string) {
  const morning = normalizeMorning(
    safeJsonParse(localStorage.getItem(`${dateKey}-morning-ritual`), {}),
  );

  const emotions = normalizeEmotions(
    safeJsonParse(
      localStorage.getItem(`${dateKey}-emotions`),
      defaultEmotionsState,
    ),
  );

  const tasks = normalizeTasks(
    safeJsonParse(localStorage.getItem(`${dateKey}-tasks`), []),
  );

  const habitsCompleted = normalizeCompleted(
    safeJsonParse(localStorage.getItem(`${dateKey}-habits-completed`), []),
  );

  const closed = safeJsonParse(
    localStorage.getItem(`${dateKey}-closed`),
    false,
  );

  const weekVirtue = safeJsonParse(
    localStorage.getItem(`planner-week-virtue-${weekKey}`),
    "",
  );

  return {
    morning,
    emotions,
    tasks,
    habitsCompleted,
    closed: Boolean(closed),
    weekVirtue: typeof weekVirtue === "string" ? weekVirtue : "",
    previousCycleFocus: getLegacyPreviousWeekClosingFocus(dateKey),
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
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const syncHour = () => {
      setCurrentHour(new Date().getHours());
    };

    syncHour();

    const intervalId = window.setInterval(syncHour, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const loadWeeklyPlan = async (uid: string | null) => {
    if (!uid) {
      setWeeklyPlan(EMPTY_WEEKLY_PLAN);
      return;
    }

    const { data, error } = await supabase
      .from("weekly_plans")
      .select("data")
      .eq("user_id", uid)
      .eq("week_key", weekKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar plano semanal na Home:", error);
      setWeeklyPlan(EMPTY_WEEKLY_PLAN);
      return;
    }

    if (data?.data) {
      setWeeklyPlan(data.data as WeeklyPlan);
    } else {
      setWeeklyPlan(EMPTY_WEEKLY_PLAN);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setHasLoaded(false);

      try {
        const uid = await getCurrentUserId();
        if (cancelled) return;

        setUserId(uid);
        setStorageMode("supabase");

        const [daily, weeklyMeta] = await Promise.all([
          getDailyRecord(uid, dateKey),
          getWeeklyMeta(uid, weekKey),
        ]);

        if (cancelled) return;

        const legacy = getLegacyData(dateKey, weekKey);

        let nextMorning = normalizeMorning(daily.morning);
        let nextEmotions = normalizeEmotions(daily.emotions);
        let nextTasks = normalizeTasks(daily.tasks);
        let nextClosed = Boolean(daily.closed);
        let nextWeekVirtue =
          typeof weeklyMeta?.virtue === "string" ? weeklyMeta.virtue : "";
        let nextPreviousCycleFocus =
          typeof weeklyMeta?.closing?.nextFocus === "string"
            ? weeklyMeta.closing.nextFocus
            : "";

        let shouldSaveDaily = false;

        const hasSupabaseMorning = Boolean(
          nextMorning.mode ||
            nextMorning.feeling ||
            nextMorning.actions ||
            nextMorning.challenges ||
            nextMorning.control ||
            nextMorning.priorities.some((item) => item.trim()),
        );

        if (!hasSupabaseMorning) {
          const hasLegacyMorning = Boolean(
            legacy.morning.mode ||
              legacy.morning.feeling ||
              legacy.morning.actions ||
              legacy.morning.challenges ||
              legacy.morning.control ||
              legacy.morning.priorities.some((item) => item.trim()),
          );

          if (hasLegacyMorning) {
            nextMorning = legacy.morning;
            shouldSaveDaily = true;
          }
        }

        const hasSupabaseEmotions = Boolean(
          nextEmotions.morning.emotion ||
            nextEmotions.afternoon.emotion ||
            nextEmotions.evening.emotion ||
            nextEmotions.morning.observations ||
            nextEmotions.afternoon.observations ||
            nextEmotions.evening.observations,
        );

        if (!hasSupabaseEmotions) {
          const hasLegacyEmotions = Boolean(
            legacy.emotions.morning.emotion ||
              legacy.emotions.afternoon.emotion ||
              legacy.emotions.evening.emotion ||
              legacy.emotions.morning.observations ||
              legacy.emotions.afternoon.observations ||
              legacy.emotions.evening.observations,
          );

          if (hasLegacyEmotions) {
            nextEmotions = legacy.emotions;
            shouldSaveDaily = true;
          }
        }

        if (nextTasks.length === 0 && legacy.tasks.length > 0) {
          nextTasks = legacy.tasks;
          shouldSaveDaily = true;
        }

        if (!nextClosed && legacy.closed) {
          nextClosed = true;
          shouldSaveDaily = true;
        }

        if (shouldSaveDaily) {
          await saveDailyRecord(uid, dateKey, {
            morning: nextMorning,
            emotions: nextEmotions,
            tasks: nextTasks,
            closed: nextClosed,
          });
        }

        if (!nextWeekVirtue.trim() && legacy.weekVirtue.trim()) {
          setWeekVirtue(legacy.weekVirtue);
        } else {
          setWeekVirtue(nextWeekVirtue);
        }

        if (
          !nextPreviousCycleFocus.trim() &&
          legacy.previousCycleFocus.trim()
        ) {
          setPreviousCycleFocus(legacy.previousCycleFocus);
        } else {
          setPreviousCycleFocus(nextPreviousCycleFocus);
        }

        if (cancelled) return;

        setMorningRitual(nextMorning);
        setEmotions(nextEmotions);
        setTasks(nextTasks);
        setDayClosed(nextClosed);

        await loadWeeklyPlan(uid);

        localStorage.setItem(`${dateKey}-tasks`, JSON.stringify(nextTasks));
        localStorage.setItem(
          `${dateKey}-morning-ritual`,
          JSON.stringify(nextMorning),
        );
        localStorage.setItem(
          `${dateKey}-emotions`,
          JSON.stringify(nextEmotions),
        );
        localStorage.setItem(`${dateKey}-closed`, JSON.stringify(nextClosed));
        if (weekVirtue.trim()) {
          localStorage.setItem(
            `planner-week-virtue-${weekKey}`,
            JSON.stringify(weekVirtue),
          );
        }

        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Home está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacy = getLegacyData(dateKey, weekKey);

        setUserId(null);
        setStorageMode("local");
        setMorningRitual(legacy.morning);
        setEmotions(legacy.emotions);
        setTasks(legacy.tasks);
        setDayClosed(legacy.closed);
        setWeekVirtue(legacy.weekVirtue);
        setPreviousCycleFocus(legacy.previousCycleFocus);
        setWeeklyPlan(EMPTY_WEEKLY_PLAN);
        setHasLoaded(true);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [dateKey, weekKey]);

  useEffect(() => {
    if (!hasLoaded) return;

    const saveClosed = async () => {
      try {
        if (storageMode === "supabase" && userId) {
          await saveDailyRecord(userId, dateKey, {
            closed: dayClosed,
          });
        }

        localStorage.setItem(`${dateKey}-closed`, JSON.stringify(dayClosed));
      } catch (error) {
        console.error("Erro ao salvar fechamento do dia:", error);
      }
    };

    saveClosed();
  }, [dayClosed, hasLoaded, storageMode, userId, dateKey]);

  const weeklyPlanStatus = getWeeklyPlanStatus(weeklyPlan);
  const stoicQuote = getStoicQuoteByDate(dateKey);

  const proofsList = parseProofs(weeklyPlan.proofs);
  const totalProofs = proofsList.length;
  const completedProofs = proofsList.filter((proof) => proof.checked).length;

  const completedTodayTasks = tasks.filter((t) => t.status === "done").length;
  const criticalTasks = tasks.filter((t) => t.status === "critical");
  const pendingTasks = tasks.filter((t) => t.status === "todo");

  const filledPriorities = (morningRitual.priorities || []).filter((item) =>
    item?.trim(),
  );

  const primaryPriority = filledPriorities[0]?.trim() || "";

  const today = new Date(dateKey + "T12:00:00");
  const day = today.getDay();
  const isSunday = day === 0;
  const isSaturday = isEndOfWeek(dateKey);

  const todayWeeklyFocus =
    [
      weeklyPlan.sunday,
      weeklyPlan.monday,
      weeklyPlan.tuesday,
      weeklyPlan.wednesday,
      weeklyPlan.thursday,
      weeklyPlan.friday,
      weeklyPlan.saturday,
    ][day] || "";

  const defaultTrailStep =
    criticalTasks.length > 0
      ? `Tarefa crítica: ${criticalTasks[0].title || "Sem título"}`
      : pendingTasks.length > 0
        ? `Próximo passo: ${pendingTasks[0].title || "Sem título"}`
        : todayWeeklyFocus
          ? `Hoje: ${todayWeeklyFocus}`
          : completedTodayTasks > 0
            ? `${completedTodayTasks} tarefa(s) concluída(s) hoje`
            : "Defina o próximo passo do dia.";

  const defaultTrailHint =
    criticalTasks.length > 0
      ? "O mais importante do dia já está sinalizado."
      : pendingTasks.length > 0
        ? "A trilha do dia começa pela primeira tarefa pendente."
        : todayWeeklyFocus
          ? `Foco herdado da semana: ${todayWeeklyFocus}`
          : "Comece pequeno, mas comece.";

  const isSurvivalMode = morningRitual.mode === "survival";

  const survivalEssentialText =
    primaryPriority ||
    todayWeeklyFocus ||
    weeklyPlan.change?.trim() ||
    "Hoje, só o essencial.";

  const nextTrailStep = isSurvivalMode
    ? survivalEssentialText
    : defaultTrailStep;

  const nextTrailHint = isSurvivalMode
    ? "Menos peso. Mais cuidado. Faça só o que for possível."
    : defaultTrailHint;

  const goToPreviousDay = () => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setDateKey(d.toISOString().slice(0, 10));
  };

  const goToNextDay = () => {
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setDateKey(d.toISOString().slice(0, 10));
  };

  const goToToday = () => {
    setDateKey(getCurrentDateKey());
  };

  const activateNightMode = () => {
    window.localStorage.setItem(
      "planner-selected-date",
      JSON.stringify(dateKey),
    );
    window.localStorage.setItem("planner-appearance", "candle");
    document.documentElement.classList.add("theme-candle");
    window.location.href = `${import.meta.env.BASE_URL}noite`;
  };

  const activateDayMode = () => {
    window.localStorage.setItem(
      "planner-selected-date",
      JSON.stringify(dateKey),
    );
    window.localStorage.removeItem("planner-appearance");
    document.documentElement.classList.remove("theme-candle");
    window.location.href = `${import.meta.env.BASE_URL}manha`;
  };

  const goToWeeklyClosing = () => {
    window.localStorage.setItem(
      "planner-selected-date",
      JSON.stringify(dateKey),
    );
    window.location.href = `${import.meta.env.BASE_URL}fechamento-semanal`;
  };

  const handleCloseDay = () => {
    setDayClosed(true);
    setShowCloseSuccess(true);
    setTimeout(() => setShowCloseSuccess(false), 2500);
  };

  const progressPercent =
    totalProofs > 0 ? Math.round((completedProofs / totalProofs) * 100) : 0;

  const isSelectedDateToday = dateKey === getCurrentDateKey();
  const showMorningFirst = !isSelectedDateToday || currentHour < 17;

  const activePeriod: Period = getCurrentPeriod(currentHour);

  const activeEmotionValue =
    activePeriod === "morning"
      ? morningRitual.feeling || null
      : (emotions[activePeriod]?.emotion ?? null);

  const activeEmotion =
    FEELING_OPTIONS.find((item) => item.value === activeEmotionValue) ?? null;

  const shouldHighlightSos = isLowState(activeEmotion?.value) || isSurvivalMode;

  const sosTitle = isLowState(activeEmotion?.value)
    ? "Apoio agora"
    : "Modo sobrevivência";

  const sosMessage = isLowState(activeEmotion?.value)
    ? "Seu estado pede menos peso e mais cuidado."
    : "Hoje o app vai te mostrar só o essencial.";

  return (
    <Layout>
      <div className="flex-1 bg-background px-4 pt-6 pb-5">
        <div className="mx-auto max-w-md">
          <header className="mb-5 text-center">
            <div className="mb-2 flex items-center justify-center gap-3 text-sm">
              <button
                onClick={goToPreviousDay}
                className="rounded-full px-2 py-1 text-muted-foreground"
              >
                ←
              </button>
              <button
                onClick={goToToday}
                className="rounded-full px-2 py-1 text-primary"
              >
                Hoje
              </button>
              <button
                onClick={goToNextDay}
                className="rounded-full px-2 py-1 text-muted-foreground"
              >
                →
              </button>
            </div>

            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>

            <h1 className="mt-2 font-serif text-4xl text-foreground">
              A Travessia
            </h1>

            {weekVirtue?.trim() && (
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                — {weekVirtue.trim()}
              </p>
            )}

            {activeEmotion && (
              <div className="mt-3 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                  <span>{activeEmotion.emoji}</span>
                  <span>{activeEmotion.label}</span>
                </div>
              </div>
            )}
          </header>

          {shouldHighlightSos && (
            <section className="mb-4 rounded-[28px] border border-primary/20 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <HeartPulse className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    {sosTitle}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{sosMessage}</p>
                </div>

                <Link href="/sos">
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    SOS
                  </button>
                </Link>
              </div>
            </section>
          )}

          <section className="mb-4 rounded-[28px] border border-border/50 bg-card px-5 py-5 shadow-sm">
            <p className="text-sm text-primary">Hoje</p>

            <p className="mt-2 font-serif text-3xl leading-none text-foreground">
              {new Date(dateKey + "T00:00:00").toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "long",
              })}
            </p>

            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {stoicQuote ? stoicQuote.quote : "Um passo de cada vez"}
            </p>

            <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              — {stoicQuote ? stoicQuote.author : "A Travessia"}
            </p>
          </section>

          {isSunday && (
            <section className="mb-4 rounded-[28px] border border-primary/20 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Abertura da semana
                  </p>

                  <p className="mt-2 font-serif text-xl leading-snug text-foreground">
                    Hoje é dia de definir a direção dos próximos 7 dias.
                  </p>

                  <p className="mt-2 text-sm text-muted-foreground">
                    Abra o plano semanal, escolha a mudança da semana e
                    distribua o que vai sustentar este novo ciclo.
                  </p>

                  {previousCycleFocus && (
                    <div className="mt-3 rounded-2xl border border-border/50 bg-background px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                        Foco trazido do ciclo anterior
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {previousCycleFocus}
                      </p>
                    </div>
                  )}
                </div>

                <Link href="/plano-semanal">
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    Abrir
                  </button>
                </Link>
              </div>
            </section>
          )}

          {isSaturday && (
            <section className="mb-4 rounded-[28px] border border-primary/20 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Fechamento da semana
                  </p>
                  <p className="mt-2 font-serif text-xl text-foreground leading-snug">
                    Hoje é dia de encerrar o ciclo.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reúna o que foi vivido, veja o que avançou e escolha o que
                    leva para a próxima semana.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goToWeeklyClosing}
                  className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                >
                  Encerrar
                </button>
              </div>
            </section>
          )}

          {isSurvivalMode ? (
            <>
              <section className="mb-4 rounded-[28px] border border-border/50 bg-card p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Ritmo do dia
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={activateDayMode}
                    className="flex flex-col items-center justify-center rounded-[22px] border border-border/40 bg-background px-3 py-4 text-center transition-colors hover:bg-muted/30"
                  >
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <SunMedium className="h-6 w-6" />
                    </div>
                    <p className="text-lg font-serif text-foreground">Manhã</p>
                  </button>

                  <button
                    type="button"
                    onClick={activateNightMode}
                    className="flex flex-col items-center justify-center rounded-[22px] border border-border/40 bg-background px-3 py-4 text-center transition-colors hover:bg-muted/30"
                  >
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Flame className="h-6 w-6" />
                    </div>
                    <p className="text-lg font-serif text-foreground">Noite</p>
                  </button>
                </div>
              </section>

              <section className="mb-4 rounded-[24px] border border-border/50 bg-card px-4 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Hoje, só o essencial
                </p>
                <p className="mt-3 text-base text-foreground">
                  {survivalEssentialText}
                </p>
              </section>
            </>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-[1.45fr_1fr] gap-3 items-stretch">
                <Link href="/plano-semanal">
                  <section className="h-full cursor-pointer rounded-[30px] border border-border/50 bg-card p-4 shadow-sm">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                        <CalendarDays className="h-6 w-6 text-primary" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-primary">
                          Mudança da semana
                        </p>

                        <p className="mt-2 font-serif text-3xl leading-tight text-foreground">
                          {weeklyPlan.change?.trim() ||
                            "Nenhuma mudança definida ainda"}
                        </p>

                        <div className="mt-3 inline-flex rounded-full border border-border/50 bg-background px-3 py-1 text-xs text-muted-foreground">
                          {weeklyPlanStatus}
                        </div>
                      </div>
                    </div>
                  </section>
                </Link>

                <section className="h-full rounded-[30px] border border-border/50 bg-card p-4 shadow-sm">
                  <div className="flex h-full flex-col justify-between gap-2">
                    {showMorningFirst ? (
                      <>
                        <button
                          type="button"
                          onClick={activateDayMode}
                          className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-transparent px-3 py-2 text-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <SunMedium className="h-6 w-6" />
                          </div>
                          <p className="text-lg font-serif text-foreground">
                            Manhã
                          </p>
                        </button>

                        <div className="h-px bg-border/40" />

                        <button
                          type="button"
                          onClick={activateNightMode}
                          className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-transparent px-3 py-2 text-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Flame className="h-6 w-6" />
                          </div>
                          <p className="text-lg font-serif text-foreground">
                            Noite
                          </p>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={activateNightMode}
                          className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-transparent px-3 py-2 text-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Flame className="h-6 w-6" />
                          </div>
                          <p className="text-lg font-serif text-foreground">
                            Noite
                          </p>
                        </button>

                        <div className="h-px bg-border/40" />

                        <button
                          type="button"
                          onClick={activateDayMode}
                          className="flex flex-1 flex-col items-center justify-center rounded-[22px] border border-transparent px-3 py-2 text-center hover:bg-muted/30 transition-colors"
                        >
                          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <SunMedium className="h-6 w-6" />
                          </div>
                          <p className="text-lg font-serif text-foreground">
                            Manhã
                          </p>
                        </button>
                      </>
                    )}
                  </div>
                </section>
              </div>

              <section className="mb-4 rounded-[28px] border border-border/50 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-foreground">Marcos da semana</p>
                    <p className="mt-1 text-3xl font-serif text-foreground">
                      {totalProofs > 0
                        ? `${completedProofs} de ${totalProofs}`
                        : "0 de 0"}
                    </p>
                  </div>

                  <div className="w-[48%]">
                    <div className="h-12 rounded-2xl border border-border/50 bg-background p-1">
                      <div
                        className="h-full rounded-xl bg-primary/60 transition-all"
                        style={{
                          width: `${totalProofs > 0 ? Math.max(progressPercent, completedProofs > 0 ? 18 : 0) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </section>

              <div className="mb-4 grid grid-cols-4 gap-2">
                <QuickLink
                  href="/pessoas"
                  label="Pessoas"
                  icon={<Users className="h-5 w-5" />}
                />
                <QuickLink
                  href="/habitos"
                  label="Hábitos"
                  icon={<Repeat className="h-5 w-5" />}
                />
                <QuickLink
                  href="/financeiro"
                  label="Finanças"
                  icon={<Wallet className="h-5 w-5" />}
                />
                <QuickLink
                  href="/emocoes"
                  label="Emoções"
                  icon={<Smile className="h-5 w-5" />}
                />
              </div>

              {filledPriorities.length > 0 && (
                <section className="mb-4 rounded-[24px] border border-border/50 bg-card px-4 py-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Prioridade do dia
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {filledPriorities.map((priority, index) => (
                      <div
                        key={`${priority}-${index}`}
                        className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm text-foreground"
                      >
                        {priority}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <section
            onClick={() => (window.location.href = "/tasks")}
            className="mb-5 cursor-pointer rounded-[28px] border border-border/50 bg-card p-4 shadow-sm transition-transform hover:scale-[1.01]"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <ChevronRight className="h-7 w-7 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-primary">Trilha de hoje</p>

                <p className="mt-2 font-serif text-2xl leading-snug text-foreground">
                  {nextTrailStep}
                </p>

                <p className="mt-2 text-sm text-muted-foreground">
                  {nextTrailHint}
                </p>
              </div>
            </div>
          </section>

          <div className="mt-3 space-y-3">
            {showCloseSuccess && (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Dia encerrado com sucesso
              </div>
            )}

            {dayClosed ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Dia encerrado
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCloseDay}
                className="w-full rounded-2xl border border-primary/30 px-4 py-3 text-sm text-primary"
              >
                Encerrar dia
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <div className="rounded-[22px] border border-border/50 bg-card px-2 py-3 text-center shadow-sm cursor-pointer">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-xs text-foreground leading-tight">{label}</p>
      </div>
    </Link>
  );
}
