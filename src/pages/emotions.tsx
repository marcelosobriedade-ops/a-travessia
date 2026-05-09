import React, { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import { ChevronDown, HeartPulse } from "lucide-react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";
import { useLocalStorage } from "@/hooks/use-local-storage";

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

interface EmotionHistoryEntry {
  dateKey: string;
  mode: MorningRitual["mode"];
  morning: string | null;
  afternoon: string | null;
  evening: string | null;
}

const defaultCheckIn: CheckIn = {
  emotion: null,
  intensity: null,
  cause: "",
  observations: "",
};

const defaultState: EmotionsState = {
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

const PERIODS = [
  { id: "morning" as Period, label: "Manhã", time: "Ao acordar" },
  { id: "afternoon" as Period, label: "Tarde", time: "Meio do dia" },
  { id: "evening" as Period, label: "Noite", time: "Antes de dormir" },
];

function getCurrentPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function isLowState(value: string | null) {
  return value === "muito mal" || value === "mal";
}

function getFeelingMeta(value: string | null | undefined) {
  return FEELING_OPTIONS.find((option) => option.value === value) ?? null;
}

function getModeLabel(mode: MorningRitual["mode"]) {
  if (mode === "productive") return "Produtivo";
  if (mode === "survival") return "Sobrevivência";
  if (mode === "normal") return "Normal";
  return "";
}

function formatHistoryDate(dateKey: string) {
  return new Date(dateKey + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function improvedFromStart(entry: EmotionHistoryEntry) {
  const endGood =
    entry.evening === "ok" ||
    entry.evening === "bem" ||
    entry.evening === "muito bem";

  return isLowState(entry.morning) && endGood;
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

function hasAnyMorningData(ritual: MorningRitual, note: string) {
  return Boolean(
    note.trim() ||
      ritual.mode ||
      ritual.feeling ||
      ritual.actions ||
      ritual.challenges ||
      ritual.control ||
      ritual.priorities.some((item) => item.trim()),
  );
}

function hasAnyEmotionsData(emotions: EmotionsState) {
  return (
    Boolean(emotions.morning.emotion) ||
    Boolean(emotions.afternoon.emotion) ||
    Boolean(emotions.evening.emotion) ||
    Boolean(emotions.morning.observations.trim()) ||
    Boolean(emotions.afternoon.observations.trim()) ||
    Boolean(emotions.evening.observations.trim()) ||
    Boolean(emotions.morning.cause.trim()) ||
    Boolean(emotions.afternoon.cause.trim()) ||
    Boolean(emotions.evening.cause.trim()) ||
    emotions.morning.intensity !== null ||
    emotions.afternoon.intensity !== null ||
    emotions.evening.intensity !== null
  );
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

function getLegacyEmotionsData(dateKey: string) {
  return normalizeEmotions(
    safeJsonParse(localStorage.getItem(`${dateKey}-emotions`), defaultState),
  );
}

function saveLegacyEmotionsData(dateKey: string, emotions: EmotionsState) {
  localStorage.setItem(`${dateKey}-emotions`, JSON.stringify(emotions));
}

function getLegacyHistory(): EmotionHistoryEntry[] {
  const raw = safeJsonParse<Record<string, EmotionHistoryEntry>>(
    localStorage.getItem("emotion-history-v1"),
    {},
  );

  return Object.values(raw)
    .filter(
      (entry) =>
        entry?.dateKey &&
        (entry.morning || entry.afternoon || entry.evening || entry.mode),
    )
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7);
}

function saveLegacyHistoryEntry(
  dateKey: string,
  entry: EmotionHistoryEntry,
): EmotionHistoryEntry[] {
  const raw = safeJsonParse<Record<string, EmotionHistoryEntry>>(
    localStorage.getItem("emotion-history-v1"),
    {},
  );

  raw[dateKey] = entry;
  localStorage.setItem("emotion-history-v1", JSON.stringify(raw));

  return Object.values(raw)
    .filter(
      (item) =>
        item?.dateKey &&
        (item.morning || item.afternoon || item.evening || item.mode),
    )
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, 7);
}

export default function Emotions() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [morningRitual, setMorningRitual] =
    useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [morningFeelingNote, setMorningFeelingNote] = useState("");
  const [emotions, setEmotions] = useState<EmotionsState>(defaultState);
  const [historyEntries, setHistoryEntries] = useState<EmotionHistoryEntry[]>(
    [],
  );

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [expandedNotes, setExpandedNotes] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });
  const [historyExpanded, setHistoryExpanded] = useState(false);

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

  const mode = morningRitual.mode || "normal";
  const isSurvivalMode = mode === "survival";
  const isProductiveMode = mode === "productive";

  const currentPeriod = getCurrentPeriod(currentHour);

  const orderedPeriods = useMemo(() => {
    const current = PERIODS.find((period) => period.id === currentPeriod)!;
    const others = PERIODS.filter((period) => period.id !== currentPeriod);
    return [current, ...others];
  }, [currentPeriod]);

  const loadHistoryFromSupabase = async (uid: string) => {
    const { data, error } = await supabase
      .from("daily_records")
      .select("date_key, morning, emotions")
      .eq("user_id", uid)
      .order("date_key", { ascending: false })
      .limit(7);

    if (error) {
      console.error("Erro ao carregar histórico emocional:", error);
      setHistoryEntries([]);
      return;
    }

    const nextHistory: EmotionHistoryEntry[] = (data ?? []).map((row: any) => {
      const rowMorning = normalizeMorning(row.morning);
      const rowEmotions = normalizeEmotions(row.emotions);

      return {
        dateKey: row.date_key,
        mode: rowMorning.mode,
        morning: rowMorning.feeling || null,
        afternoon: rowEmotions.afternoon.emotion,
        evening: rowEmotions.evening.emotion,
      };
    });

    setHistoryEntries(nextHistory);
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

        const daily = await getDailyRecord(uid, dateKey);
        if (cancelled) return;

        let nextMorningRitual = normalizeMorning(daily.morning);
        let nextMorningFeelingNote =
          typeof daily.morning?.feelingNote === "string"
            ? daily.morning.feelingNote
            : "";
        let nextEmotions = normalizeEmotions(daily.emotions);

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyEmotions = getLegacyEmotionsData(dateKey);

        let shouldSave = false;

        if (
          !hasAnyMorningData(nextMorningRitual, nextMorningFeelingNote) &&
          hasAnyMorningData(legacyMorning.ritual, legacyMorning.note)
        ) {
          nextMorningRitual = legacyMorning.ritual;
          nextMorningFeelingNote = legacyMorning.note;
          shouldSave = true;
        }

        if (
          !hasAnyEmotionsData(nextEmotions) &&
          hasAnyEmotionsData(legacyEmotions)
        ) {
          nextEmotions = legacyEmotions;
          shouldSave = true;
        }

        if (shouldSave) {
          await saveDailyRecord(uid, dateKey, {
            morning: {
              ...nextMorningRitual,
              feelingNote: nextMorningFeelingNote,
            },
            emotions: nextEmotions,
          });
        }

        if (cancelled) return;

        setMorningRitual(nextMorningRitual);
        setMorningFeelingNote(nextMorningFeelingNote);
        setEmotions(nextEmotions);
        await loadHistoryFromSupabase(uid);
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Emoções está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyEmotions = getLegacyEmotionsData(dateKey);

        setUserId(null);
        setStorageMode("local");
        setMorningRitual(legacyMorning.ritual);
        setMorningFeelingNote(legacyMorning.note);
        setEmotions(legacyEmotions);
        setHistoryEntries(getLegacyHistory());
        setHasLoaded(true);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  useEffect(() => {
    if (!hasLoaded) return;

    const save = async () => {
      try {
        if (storageMode === "supabase" && userId) {
          await saveDailyRecord(userId, dateKey, {
            emotions,
          });
          await loadHistoryFromSupabase(userId);
        } else {
          saveLegacyEmotionsData(dateKey, emotions);

          const entry: EmotionHistoryEntry = {
            dateKey,
            mode: morningRitual.mode,
            morning: morningRitual.feeling || null,
            afternoon: emotions.afternoon.emotion,
            evening: emotions.evening.emotion,
          };

          setHistoryEntries(saveLegacyHistoryEntry(dateKey, entry));
        }
      } catch (error) {
        console.error("Erro ao salvar emoções:", error);
      }
    };

    save();
  }, [
    emotions,
    hasLoaded,
    storageMode,
    userId,
    dateKey,
    morningRitual.mode,
    morningRitual.feeling,
  ]);

  const update = (period: Period, patch: Partial<CheckIn>) => {
    setEmotions((prev) => ({
      ...prev,
      [period]: { ...defaultCheckIn, ...prev[period], ...patch },
    }));
  };

  const toggleEmotion = (period: Period, emotion: string) => {
    const current = emotions[period]?.emotion ?? null;
    update(period, { emotion: current === emotion ? null : emotion });
  };

  const toggleExpandedNote = (period: Period) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [period]: !prev[period],
    }));
  };

  const morningEmotion = FEELING_OPTIONS.some(
    (option) => option.value === morningRitual.feeling,
  )
    ? morningRitual.feeling
    : null;

  const morningOption = FEELING_OPTIONS.find(
    (option) => option.value === morningEmotion,
  );

  const recentHistory = historyEntries;

  const historyWithEmotion = recentHistory.filter(
    (entry) => entry.morning || entry.afternoon || entry.evening,
  );

  const lowEndings = historyWithEmotion.filter((entry) =>
    isLowState(entry.evening),
  ).length;

  const improvedDays = historyWithEmotion.filter(improvedFromStart).length;

  return (
    <Layout>
      <Header title="Emoções" />

      <div className="flex-1 space-y-8 overflow-y-auto p-6 pb-12">
        <p className="text-center font-serif italic text-muted-foreground">
          "Observar sem julgar. Sentir sem ser consumido."
        </p>

        {isProductiveMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Modo produtivo
            </p>
            <p className="mt-1 text-sm text-foreground">
              Faça um check-in rápido e siga com clareza.
            </p>
          </section>
        )}

        {isSurvivalMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Modo sobrevivência
            </p>
            <p className="mt-1 text-sm text-foreground">
              Aqui o foco é cuidado, regulação e apoio.
            </p>
          </section>
        )}

        {orderedPeriods.map(({ id, label, time }) => {
          const isCurrent = id === currentPeriod;
          const isMorningCard = id === "morning";
          const showNoteSection = !isSurvivalMode || isCurrent;

          const state = isMorningCard
            ? {
                emotion: morningEmotion,
                observations: morningFeelingNote,
              }
            : {
                emotion: emotions[id]?.emotion ?? null,
                observations: emotions[id]?.observations ?? "",
              };

          return (
            <section
              key={id}
              className={cn(
                "rounded-2xl border bg-card shadow-sm transition-all",
                isCurrent ? "border-primary/30" : "border-border/50",
                isSurvivalMode && isCurrent && "ring-1 ring-primary/10",
                isSurvivalMode && !isCurrent && "opacity-80",
                "p-4",
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-serif text-xl text-foreground">
                      {label}
                    </h2>

                    {isCurrent && (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                        Agora
                      </span>
                    )}
                  </div>

                  {!isProductiveMode && (
                    <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                      {time}
                    </p>
                  )}
                </div>
              </div>

              {isMorningCard ? (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                      Estado vindo da Manhã
                    </p>

                    {morningOption ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background px-3 py-2 text-sm text-foreground">
                        <span className="text-base">{morningOption.emoji}</span>
                        <span>{morningOption.label}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Ainda não definido na página Manhã.
                      </p>
                    )}
                  </div>

                  {isLowState(state.emotion) && (
                    <Link href="/sos">
                      <div
                        className={cn(
                          "cursor-pointer rounded-2xl border p-4 transition-colors",
                          isSurvivalMode
                            ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                            : "border-primary/15 bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <HeartPulse className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-widest text-primary/70">
                              SOS
                            </p>
                            <p className="text-sm text-foreground">
                              {isSurvivalMode
                                ? "Seu estado da manhã pede cuidado agora."
                                : "Seu estado da manhã pede apoio."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {showNoteSection && (
                    <section className="rounded-2xl border border-border/50 bg-background p-4">
                      <button
                        type="button"
                        onClick={() => toggleExpandedNote(id)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-widest text-primary/60">
                            Registro da manhã
                          </p>
                        </div>

                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                            expandedNotes[id] && "rotate-180",
                          )}
                        />
                      </button>

                      {expandedNotes[id] && (
                        <div className="mt-4">
                          {morningFeelingNote.trim() ? (
                            <div className="rounded-xl border border-border/40 bg-card px-3 py-3 text-sm text-foreground">
                              {morningFeelingNote}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Nenhum registro adicional da manhã.
                            </p>
                          )}
                        </div>
                      )}
                    </section>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                      Estado agora
                    </p>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {FEELING_OPTIONS.map((option) => {
                        const selected = state.emotion === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleEmotion(id, option.value)}
                            className={cn(
                              "rounded-xl border px-3 py-3 text-center transition-all",
                              selected
                                ? "border-primary/40 bg-primary/8 text-foreground"
                                : "border-border/40 bg-background text-muted-foreground hover:border-border/70",
                            )}
                          >
                            <div className="text-lg">{option.emoji}</div>
                            <div className="mt-1 text-xs font-medium">
                              {option.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {isLowState(state.emotion) && (
                    <Link href="/sos">
                      <div
                        className={cn(
                          "cursor-pointer rounded-2xl border p-4 transition-colors",
                          isSurvivalMode
                            ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                            : "border-primary/15 bg-primary/5 hover:bg-primary/10",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <HeartPulse className="h-5 w-5" />
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-widest text-primary/70">
                              SOS
                            </p>
                            <p className="text-sm text-foreground">
                              {isSurvivalMode
                                ? "Seu estado atual pede apoio agora."
                                : "Seu estado pede apoio agora."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {showNoteSection && (
                    <section className="rounded-2xl border border-border/50 bg-background p-4">
                      <button
                        type="button"
                        onClick={() => toggleExpandedNote(id)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-widest text-primary/60">
                            Quero registrar algo sobre isso?
                          </p>
                        </div>

                        <ChevronDown
                          className={cn(
                            "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                            expandedNotes[id] && "rotate-180",
                          )}
                        />
                      </button>

                      {expandedNotes[id] && (
                        <div className="mt-4">
                          <Textarea
                            value={state.observations}
                            onChange={(e) =>
                              update(id, { observations: e.target.value })
                            }
                            placeholder="Se quiser, escreva em uma frase curta."
                            className="min-h-[78px] resize-none rounded-xl border-border/40 bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        </div>
                      )}
                    </section>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {recentHistory.length > 0 && (
          <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setHistoryExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Histórico emocional
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Veja como os dias têm começado, virado e terminado.
                </p>
              </div>

              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  historyExpanded && "rotate-180",
                )}
              />
            </button>

            {historyExpanded && (
              <div className="mt-4 space-y-4">
                {(historyWithEmotion.length >= 2 ||
                  lowEndings > 0 ||
                  improvedDays > 0) && (
                  <div className="rounded-2xl border border-border/50 bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-widest text-primary/60">
                      Leitura recente
                    </p>

                    <div className="mt-3 space-y-2 text-sm text-foreground">
                      {improvedDays > 0 && (
                        <p>
                          {improvedDays} dia(s) começaram mais pesados e
                          terminaram melhor.
                        </p>
                      )}

                      {lowEndings > 0 && (
                        <p>{lowEndings} dia(s) recentes terminaram em baixa.</p>
                      )}

                      {improvedDays === 0 && lowEndings === 0 && (
                        <p>Seu histórico recente está mais estável.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {recentHistory.map((entry) => {
                    const morningMeta = getFeelingMeta(entry.morning);
                    const afternoonMeta = getFeelingMeta(entry.afternoon);
                    const eveningMeta = getFeelingMeta(entry.evening);

                    const dayLine =
                      morningMeta && eveningMeta
                        ? `Começou em ${morningMeta.label.toLowerCase()} e terminou em ${eveningMeta.label.toLowerCase()}.`
                        : morningMeta
                          ? `Começou em ${morningMeta.label.toLowerCase()}.`
                          : eveningMeta
                            ? `Terminou em ${eveningMeta.label.toLowerCase()}.`
                            : "Sem leitura suficiente neste dia.";

                    return (
                      <div
                        key={entry.dateKey}
                        className="rounded-2xl border border-border/50 bg-background p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {formatHistoryDate(entry.dateKey)}
                            </p>

                            {entry.mode && (
                              <p className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                                {getModeLabel(entry.mode)}
                              </p>
                            )}
                          </div>

                          {entry.dateKey === dateKey && (
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                              Hoje
                            </span>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <HistoryPill label="Manhã" value={entry.morning} />
                          <HistoryPill label="Tarde" value={entry.afternoon} />
                          <HistoryPill label="Noite" value={entry.evening} />
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground">
                          {dayLine}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <div className="h-4" />
      </div>
    </Layout>
  );
}

function HistoryPill({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const meta = getFeelingMeta(value);

  return (
    <div className="rounded-xl border border-border/50 bg-card px-3 py-2 text-center">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">
        {meta ? (
          <span className="inline-flex items-center gap-1.5">
            <span>{meta.emoji}</span>
            <span>{meta.label}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
