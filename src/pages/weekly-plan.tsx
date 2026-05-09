import { supabase } from "@/lib/supabase";
import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlan,
  getWeekKeyFromDate,
  getWeeklyPlanStatus,
  isEndOfWeek,
} from "@/lib/weekly-plan";
import { getCurrentUserId, getWeeklyMeta } from "@/lib/user-data";

type WeekDayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

type ProofItem = {
  text: string;
  checked: boolean;
};

const DAY_OPTIONS: { value: WeekDayKey; label: string }[] = [
  { value: "sunday", label: "Dom" },
  { value: "monday", label: "Seg" },
  { value: "tuesday", label: "Ter" },
  { value: "wednesday", label: "Qua" },
  { value: "thursday", label: "Qui" },
  { value: "friday", label: "Sex" },
  { value: "saturday", label: "Sáb" },
];

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

function getPreviousWeekKey(weekKey: string) {
  const date = new Date(weekKey + "T12:00:00");
  date.setDate(date.getDate() - 7);
  return date.toISOString().slice(0, 10);
}

function normalizeWeeklyPlan(value: any): WeeklyPlan {
  return {
    ...EMPTY_WEEKLY_PLAN,
    ...(value || {}),
  };
}

export default function WeeklyPlanPage() {
  const [selectedDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(selectedDateKey);
  const isSaturday = isEndOfWeek(selectedDateKey);
  const previousWeekKey = useMemo(() => getPreviousWeekKey(weekKey), [weekKey]);

  const [plan, setPlan] = useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);
  const [selectedDay, setSelectedDay] = useState<WeekDayKey>("sunday");
  const [newProof, setNewProof] = useState("");
  const [previousCycleFocus, setPreviousCycleFocus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const status = getWeeklyPlanStatus(plan);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      setHasLoaded(false);

      try {
        const uid = await getCurrentUserId();
        if (cancelled) return;

        setUserId(uid);

        const [{ data, error }, previousMeta] = await Promise.all([
          supabase
            .from("weekly_plans")
            .select("data")
            .eq("user_id", uid)
            .eq("week_key", weekKey)
            .maybeSingle(),
          getWeeklyMeta(uid, previousWeekKey),
        ]);

        if (error) {
          console.error("Erro ao carregar plano:", error);
          if (!cancelled) {
            setPlan(EMPTY_WEEKLY_PLAN);
            setPreviousCycleFocus("");
            setHasLoaded(true);
          }
          return;
        }

        if (cancelled) return;

        setPlan(
          data?.data ? normalizeWeeklyPlan(data.data) : EMPTY_WEEKLY_PLAN,
        );
        setPreviousCycleFocus(
          typeof previousMeta?.closing?.nextFocus === "string"
            ? previousMeta.closing.nextFocus.trim()
            : "",
        );
        setHasLoaded(true);
      } catch (error) {
        console.error("Erro ao carregar plano semanal:", error);
        if (cancelled) return;

        setUserId(null);
        setPlan(EMPTY_WEEKLY_PLAN);
        setPreviousCycleFocus("");
        setHasLoaded(true);
      }
    };

    loadPlan();

    return () => {
      cancelled = true;
    };
  }, [weekKey, previousWeekKey]);

  useEffect(() => {
    if (!hasLoaded) return;
    if (!userId) return;

    const timeoutId = window.setTimeout(async () => {
      try {
        const { error } = await supabase.from("weekly_plans").upsert(
          {
            week_key: weekKey,
            user_id: userId,
            data: plan,
          },
          {
            onConflict: "user_id,week_key",
          },
        );

        if (error) {
          console.error("Erro ao salvar plano:", error);
        }
      } catch (error) {
        console.error("Erro ao salvar plano semanal:", error);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [plan, hasLoaded, userId, weekKey]);

  const updatePlan = (patch: Partial<WeeklyPlan>) => {
    setPlan((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const proofsList = parseProofs(plan.proofs);

  const addProof = () => {
    const value = newProof.trim();
    if (!value) return;

    const nextProofs = serializeProofs([
      ...proofsList,
      { text: value, checked: false },
    ]);

    updatePlan({ proofs: nextProofs });
    setNewProof("");
  };

  const removeProof = (indexToRemove: number) => {
    const nextProofs = serializeProofs(
      proofsList.filter((_, index) => index !== indexToRemove),
    );

    updatePlan({ proofs: nextProofs });
  };

  const toggleProof = (indexToToggle: number) => {
    const nextProofs = serializeProofs(
      proofsList.map((proof, index) =>
        index === indexToToggle ? { ...proof, checked: !proof.checked } : proof,
      ),
    );

    updatePlan({ proofs: nextProofs });
  };

  const selectedDayIndex = DAY_OPTIONS.findIndex(
    (day) => day.value === selectedDay,
  );

  const goToPreviousWeekDay = () => {
    const previousIndex =
      selectedDayIndex === 0 ? DAY_OPTIONS.length - 1 : selectedDayIndex - 1;
    setSelectedDay(DAY_OPTIONS[previousIndex].value);
  };

  const goToNextWeekDay = () => {
    const nextIndex =
      selectedDayIndex === DAY_OPTIONS.length - 1 ? 0 : selectedDayIndex + 1;
    setSelectedDay(DAY_OPTIONS[nextIndex].value);
  };

  const selectedDayLabel =
    DAY_OPTIONS.find((day) => day.value === selectedDay)?.label || "Dom";

  return (
    <Layout>
      <div className="flex-1 flex flex-col pt-12 pb-8 px-6 bg-background">
        <header className="mb-8 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl border border-sky-500/20 bg-sky-500/10 flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-sky-600" />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Semana iniciada em {weekKey}
            </p>
            <h1 className="text-3xl font-serif text-foreground mt-2">
              Plano Semanal
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Direção simples para os próximos 7 dias.
            </p>
          </div>

          <div className="flex justify-center">
            <span className="text-xs px-3 py-1 rounded-full border border-border bg-card text-muted-foreground">
              {status}
            </span>
          </div>
        </header>

        <div className="space-y-6 max-w-3xl mx-auto w-full">
          {previousCycleFocus && (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                Foco trazido do ciclo anterior
              </p>
              <p className="text-base font-serif text-foreground">
                {previousCycleFocus}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-serif text-foreground">
                1. Visão — daqui a 7 dias
              </h2>
            </div>

            <textarea
              value={plan.change}
              onChange={(e) => updatePlan({ change: e.target.value })}
              className="w-full min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-serif text-foreground">
                2. Provas da semana
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newProof}
                  onChange={(e) => setNewProof(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProof();
                    }
                  }}
                  placeholder="Adicionar prova da semana"
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={addProof}
                  className="h-12 px-4 rounded-xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Adicionar</span>
                </button>
              </div>

              {proofsList.length > 0 ? (
                <div className="space-y-2">
                  {proofsList.map((proof, index) => (
                    <div
                      key={`${proof.text}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => toggleProof(index)}
                        className={`h-9 w-9 shrink-0 rounded-full border flex items-center justify-center ${
                          proof.checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <p
                        className={`flex-1 text-sm leading-snug ${
                          proof.checked
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {proof.text}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeProof(index)}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma prova adicionada ainda.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <div>
              <h2 className="text-lg font-serif text-foreground">
                3. Distribuir na semana
              </h2>
            </div>

            <div className="rounded-2xl border border-border/40 bg-background p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={goToPreviousWeekDay}
                  className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex-1 text-center">
                  <p className="text-2xl font-serif text-foreground">
                    {selectedDayLabel}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goToNextWeekDay}
                  className="h-11 w-11 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <input
                value={plan[selectedDay]}
                onChange={(e) =>
                  updatePlan({
                    [selectedDay]: e.target.value,
                  } as Partial<WeeklyPlan>)
                }
                placeholder="Ex: Corpo + trabalho"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="text-lg font-serif text-foreground">
              4. O que pode te derrubar nesta semana?
            </h2>

            <textarea
              value={plan.risks}
              onChange={(e) => updatePlan({ risks: e.target.value })}
              className="w-full min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="text-lg font-serif text-foreground">
              5. O que você fará quando isso acontecer?
            </h2>

            <textarea
              value={plan.prevention}
              onChange={(e) => updatePlan({ prevention: e.target.value })}
              className="w-full min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none"
            />
          </section>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = `${import.meta.env.BASE_URL}fechamento-semanal`;
              }}
              className={`text-xs px-3 py-2 rounded-full border ${
                isSaturday
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 bg-card text-muted-foreground"
              }`}
            >
              {isSaturday ? "Encerrar semana" : "Fechar ciclo da semana"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
