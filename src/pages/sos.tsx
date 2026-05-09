import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { EMPTY_SOS_ENTRY, SosEntry, SosTrigger, getSosStatus } from "@/lib/sos";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";

const TRIGGER_OPTIONS: { value: SosTrigger; label: string }[] = [
  { value: "impulso", label: "Impulso forte" },
  { value: "ansiedade", label: "Ansiedade" },
  { value: "raiva", label: "Raiva" },
  { value: "tristeza", label: "Tristeza" },
  { value: "confusao", label: "Confusão mental" },
  { value: "desistir", label: "Vontade de desistir" },
  { value: "outro", label: "Outro" },
];

const SAFE_ACTIONS = [
  "Beber água",
  "Lavar o rosto",
  "Respirar por 1 minuto",
  "Caminhar 5 minutos",
  "Sair do ambiente de risco",
  "Escrever sem agir",
  "Falar com alguém",
];

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

function getCurrentPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getPeriodLabel(period: Period) {
  if (period === "morning") return "manhã";
  if (period === "afternoon") return "tarde";
  return "noite";
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

function normalizeSos(value: any): SosEntry {
  return {
    ...EMPTY_SOS_ENTRY,
    ...(value || {}),
  };
}

function hasAnySosData(entry: SosEntry) {
  return Boolean(
    entry.trigger ||
      entry.notes ||
      entry.safeAction ||
      entry.outcome ||
      entry.groundingSee ||
      entry.groundingTouch ||
      entry.groundingHear ||
      entry.groundingSmell ||
      entry.groundingTaste ||
      (typeof entry.intensity === "number" && entry.intensity > 0),
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
    safeJsonParse(
      localStorage.getItem(`${dateKey}-emotions`),
      defaultEmotionsState,
    ),
  );
}

function getLegacySosData(dateKey: string) {
  return normalizeSos(
    safeJsonParse(localStorage.getItem(`${dateKey}-sos`), EMPTY_SOS_ENTRY),
  );
}

function saveLegacySosData(dateKey: string, entry: SosEntry) {
  localStorage.setItem(`${dateKey}-sos`, JSON.stringify(entry));
}

export default function Sos() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [entry, setEntry] = useState<SosEntry>(EMPTY_SOS_ENTRY);
  const [morningRitual, setMorningRitual] =
    useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [morningFeelingNote, setMorningFeelingNote] = useState("");
  const [emotions, setEmotions] = useState<EmotionsState>(defaultEmotionsState);

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathingSeconds, setBreathingSeconds] = useState(60);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

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

  useEffect(() => {
    if (!breathingActive) return;
    if (breathingSeconds === 0) {
      setBreathingActive(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setBreathingSeconds((prev) => prev - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [breathingActive, breathingSeconds]);

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
        let nextEntry = normalizeSos(daily.sos);

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyEmotions = getLegacyEmotionsData(dateKey);
        const legacySos = getLegacySosData(dateKey);

        let shouldSave = false;

        const hasSupabaseMorning = Boolean(
          nextMorningFeelingNote ||
            nextMorningRitual.mode ||
            nextMorningRitual.feeling ||
            nextMorningRitual.actions ||
            nextMorningRitual.challenges ||
            nextMorningRitual.control ||
            nextMorningRitual.priorities.some((item) => item.trim()),
        );

        if (!hasSupabaseMorning) {
          const hasLegacyMorning = Boolean(
            legacyMorning.note ||
              legacyMorning.ritual.mode ||
              legacyMorning.ritual.feeling ||
              legacyMorning.ritual.actions ||
              legacyMorning.ritual.challenges ||
              legacyMorning.ritual.control ||
              legacyMorning.ritual.priorities.some((item) => item.trim()),
          );

          if (hasLegacyMorning) {
            nextMorningRitual = legacyMorning.ritual;
            nextMorningFeelingNote = legacyMorning.note;
            shouldSave = true;
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
            legacyEmotions.morning.emotion ||
              legacyEmotions.afternoon.emotion ||
              legacyEmotions.evening.emotion ||
              legacyEmotions.morning.observations ||
              legacyEmotions.afternoon.observations ||
              legacyEmotions.evening.observations,
          );

          if (hasLegacyEmotions) {
            nextEmotions = legacyEmotions;
            shouldSave = true;
          }
        }

        if (!hasAnySosData(nextEntry) && hasAnySosData(legacySos)) {
          nextEntry = legacySos;
          shouldSave = true;
        }

        if (shouldSave) {
          await saveDailyRecord(uid, dateKey, {
            morning: {
              ...nextMorningRitual,
              feelingNote: nextMorningFeelingNote,
            },
            emotions: nextEmotions,
            sos: nextEntry,
          });
        }

        if (cancelled) return;

        setMorningRitual(nextMorningRitual);
        setMorningFeelingNote(nextMorningFeelingNote);
        setEmotions(nextEmotions);
        setEntry(nextEntry);
        setAdvancedExpanded(
          Boolean(
            nextEntry.notes ||
              nextEntry.groundingSee ||
              nextEntry.groundingTouch ||
              nextEntry.groundingHear ||
              nextEntry.groundingSmell ||
              nextEntry.groundingTaste,
          ),
        );
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. SOS está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyEmotions = getLegacyEmotionsData(dateKey);
        const legacySos = getLegacySosData(dateKey);

        setUserId(null);
        setStorageMode("local");
        setMorningRitual(legacyMorning.ritual);
        setMorningFeelingNote(legacyMorning.note);
        setEmotions(legacyEmotions);
        setEntry(legacySos);
        setAdvancedExpanded(
          Boolean(
            legacySos.notes ||
              legacySos.groundingSee ||
              legacySos.groundingTouch ||
              legacySos.groundingHear ||
              legacySos.groundingSmell ||
              legacySos.groundingTaste,
          ),
        );
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
            sos: entry,
          });
        } else {
          saveLegacySosData(dateKey, entry);
        }
      } catch (error) {
        console.error("Erro ao salvar SOS:", error);
      }
    };

    save();
  }, [entry, hasLoaded, storageMode, userId, dateKey]);

  const currentPeriod = getCurrentPeriod(currentHour);

  const currentEmotion =
    currentPeriod === "morning"
      ? morningRitual.feeling || null
      : (emotions[currentPeriod]?.emotion ?? null);

  const currentEmotionNote =
    currentPeriod === "morning"
      ? morningFeelingNote
      : (emotions[currentPeriod]?.observations ?? "");

  const currentEmotionLabel =
    FEELING_OPTIONS.find((item) => item.value === currentEmotion)?.label ??
    currentEmotion;

  const currentEmotionEmoji =
    FEELING_OPTIONS.find((item) => item.value === currentEmotion)?.emoji ?? "•";

  const lowStateDetected = isLowState(currentEmotion);

  const status = getSosStatus(entry);

  const intensityValue =
    typeof entry.intensity === "number" &&
    entry.intensity >= 1 &&
    entry.intensity <= 10
      ? entry.intensity
      : 5;

  const formattedDate = new Date(dateKey + "T00:00:00").toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  const updateEntry = (patch: Partial<SosEntry>) => {
    setEntry((prev) => ({
      ...prev,
      ...patch,
      createdAt: prev.createdAt || new Date().toISOString(),
    }));
  };

  const startBreathing = () => {
    setBreathingSeconds(60);
    setBreathingActive(true);
  };

  const hasAdvancedContent = useMemo(() => {
    return Boolean(
      entry.notes ||
        entry.groundingSee ||
        entry.groundingTouch ||
        entry.groundingHear ||
        entry.groundingSmell ||
        entry.groundingTaste,
    );
  }, [
    entry.notes,
    entry.groundingSee,
    entry.groundingTouch,
    entry.groundingHear,
    entry.groundingSmell,
    entry.groundingTaste,
  ]);

  return (
    <Layout>
      <div className="flex-1 bg-background px-6 pt-12 pb-8">
        <div className="mx-auto w-full max-w-2xl space-y-5">
          <header className="space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {formattedDate}
              </p>
              <h1 className="mt-2 text-3xl font-serif text-foreground">SOS</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Segurança primeiro.
              </p>
            </div>

            <div className="flex justify-center">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                {status}
              </span>
            </div>
          </header>

          {lowStateDetected && (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-foreground">
                <span className="text-lg">{currentEmotionEmoji}</span>
                <span className="text-sm">
                  Estado recente na {getPeriodLabel(currentPeriod)}:{" "}
                  <strong>{currentEmotionLabel}</strong>
                </span>
              </div>

              {currentEmotionNote?.trim() && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {currentEmotionNote}
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-5 shadow-sm">
            <div>
              <h2 className="text-lg font-serif text-foreground">1. Agora</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Nomeie e meça o que está acontecendo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TRIGGER_OPTIONS.map((option) => {
                const selected = entry.trigger === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateEntry({ trigger: option.value })}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-amber-500/40 bg-amber-500/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Intensidade
              </p>

              <input
                type="range"
                min={1}
                max={10}
                value={intensityValue}
                onChange={(e) =>
                  updateEntry({ intensity: Number(e.target.value) })
                }
                className="w-full"
              />

              <div className="text-center text-sm text-muted-foreground">
                Intensidade atual:{" "}
                <span className="font-medium text-foreground">
                  {intensityValue}/10
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-5 shadow-sm">
            <div>
              <h2 className="text-lg font-serif text-foreground">
                2. Apoio imediato
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Respire e escolha uma ação segura agora.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-background px-4 py-5 text-center space-y-3">
              <p className="text-3xl font-serif text-foreground">
                {breathingSeconds}s
              </p>
              <p className="text-sm text-muted-foreground">
                {breathingActive
                  ? "Continue respirando devagar."
                  : "Inspire por 4, segure por 4, expire por 6."}
              </p>

              <button
                type="button"
                onClick={startBreathing}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-foreground transition-colors hover:bg-amber-500/20"
              >
                {breathingActive
                  ? "Reiniciar 1 minuto"
                  : "Respirar por 1 minuto"}
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Ação segura
              </p>

              <div className="flex flex-wrap gap-2">
                {SAFE_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => updateEntry({ safeAction: action })}
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition-colors",
                      entry.safeAction === action
                        ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {action}
                  </button>
                ))}
              </div>

              <Textarea
                value={entry.safeAction}
                onChange={(e) => updateEntry({ safeAction: e.target.value })}
                placeholder="Ou escreva sua própria ação segura..."
                className="min-h-[78px] resize-none rounded-xl border-border/40 bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setAdvancedExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <h2 className="text-lg font-serif text-foreground">
                  3. Quero aprofundar isso
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasAdvancedContent
                    ? "Registro preenchido"
                    : "Abra só se precisar descarregar ou fazer grounding"}
                </p>
              </div>

              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  advancedExpanded && "rotate-180",
                )}
              />
            </button>

            {advancedExpanded && (
              <div className="mt-5 space-y-5">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                    Escreva o que está acontecendo
                  </p>
                  <Textarea
                    value={entry.notes}
                    onChange={(e) => updateEntry({ notes: e.target.value })}
                    placeholder="Tire da cabeça e coloque aqui."
                    className="min-h-[120px] resize-none rounded-xl border-border/40 bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Grounding 5-4-3-2-1
                  </p>

                  <GroundingField
                    label="5 coisas que vejo"
                    value={entry.groundingSee}
                    onChange={(value) => updateEntry({ groundingSee: value })}
                    placeholder="Ex: a janela, a mesa, a parede..."
                  />

                  <GroundingField
                    label="4 coisas que toco"
                    value={entry.groundingTouch}
                    onChange={(value) => updateEntry({ groundingTouch: value })}
                    placeholder="Ex: roupa na pele, cadeira, chão..."
                  />

                  <GroundingField
                    label="3 coisas que ouço"
                    value={entry.groundingHear}
                    onChange={(value) => updateEntry({ groundingHear: value })}
                    placeholder="Ex: ventilador, rua, minha respiração..."
                  />

                  <GroundingField
                    label="2 coisas que cheiro"
                    value={entry.groundingSmell}
                    onChange={(value) => updateEntry({ groundingSmell: value })}
                    placeholder="Ex: perfume, café, sabonete..."
                  />

                  <GroundingField
                    label="1 coisa que provo"
                    value={entry.groundingTaste}
                    onChange={(value) => updateEntry({ groundingTaste: value })}
                    placeholder="Ex: gosto de água, café, pasta de dente..."
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 shadow-sm">
            <div>
              <h2 className="text-lg font-serif text-foreground">
                4. Como você está agora?
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => updateEntry({ outcome: "better" })}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm transition-colors",
                  entry.outcome === "better"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                )}
              >
                Melhorei
              </button>

              <button
                type="button"
                onClick={() => updateEntry({ outcome: "hard" })}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm transition-colors",
                  entry.outcome === "hard"
                    ? "border-amber-500/40 bg-amber-500/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                )}
              >
                Ainda está difícil
              </button>

              <button
                type="button"
                onClick={() => updateEntry({ outcome: "support" })}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm transition-colors",
                  entry.outcome === "support"
                    ? "border-rose-500/40 bg-rose-500/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                )}
              >
                Preciso de apoio
              </button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function GroundingField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 min-h-[78px] resize-none rounded-xl border-border/40 bg-background shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
      />
    </div>
  );
}
