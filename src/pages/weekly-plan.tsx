import { supabase } from "@/lib/supabase";
import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Check,
  Save,
  AlertTriangle,
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

type ProofItem = {
  text: string;
  checked: boolean;
};

type SaveStatus = "idle" | "loading" | "saving" | "saved" | "error";

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

export default function WeeklyPlanPage() {
  const [selectedDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(selectedDateKey);
  const isSaturday = isEndOfWeek(selectedDateKey);
  const previousWeekKey = useMemo(() => getPreviousWeekKey(weekKey), [weekKey]);

  const [plan, setPlan] = useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);
  const [newProof, setNewProof] = useState("");
  const [previousCycleFocus, setPreviousCycleFocus] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const weeklyPlanStatus = getWeeklyPlanStatus(plan);
  const proofsList = parseProofs(plan.proofs);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const uid = await getCurrentUserId();
        if (cancelled) return;

        setUserId(uid);

        const [{ data, error }, previousMeta] = await Promise.all([
          supabase
            .from("weekly_meta")
            .select("plan")
            .eq("user_id", uid)
            .eq("week_key", weekKey)
            .maybeSingle(),
          getWeeklyMeta(uid, previousWeekKey),
        ]);

        if (error) throw error;
        if (cancelled) return;

        setPlan(
          data?.plan ? normalizeWeeklyPlan(data.plan) : EMPTY_WEEKLY_PLAN,
        );

        setPreviousCycleFocus(
          typeof previousMeta?.closing?.nextFocus === "string"
            ? previousMeta.closing.nextFocus.trim()
            : "",
        );

        setDirty(false);
        setStatus("idle");
      } catch (error: any) {
        console.error("Erro ao carregar plano semanal:", error);
        if (cancelled) return;

        setPlan(EMPTY_WEEKLY_PLAN);
        setPreviousCycleFocus("");
        setErrorMessage(error?.message || "Erro ao carregar plano semanal.");
        setStatus("error");
      }
    };

    loadPlan();

    return () => {
      cancelled = true;
    };
  }, [weekKey, previousWeekKey]);

  const updatePlan = (patch: Partial<WeeklyPlan>) => {
    setPlan((prev) => ({
      ...prev,
      ...patch,
    }));
    setDirty(true);
    if (status === "saved") setStatus("idle");
  };

  const savePlan = async () => {
    if (!userId) {
      setStatus("error");
      setErrorMessage("Usuário não autenticado. Faça login novamente.");
      return;
    }

    setStatus("saving");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("weekly_meta").upsert(
        {
          week_key: weekKey,
          user_id: userId,
          plan,
        },
        {
          onConflict: "user_id,week_key",
        },
      );

      if (error) throw error;

      setDirty(false);
      setStatus("saved");
    } catch (error: any) {
      console.error("Erro ao salvar plano semanal:", error);
      setStatus("error");
      setErrorMessage(error?.message || "Erro ao salvar plano semanal.");
    }
  };

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

  const goToWeeklyClosing = () => {
    window.location.href = `${import.meta.env.BASE_URL}fechamento-semanal`;
  };

  const isBusy = status === "loading" || status === "saving";

  return (
    <Layout>
      <div className="flex-1 flex flex-col pt-12 pb-8 px-6 bg-background overflow-y-auto">
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
              {weeklyPlanStatus}
            </span>
          </div>
        </header>

        <div className="space-y-6 max-w-3xl mx-auto w-full">
          {status === "loading" && (
            <section className="rounded-2xl border border-border/50 bg-card p-5 text-sm text-muted-foreground">
              Carregando plano semanal...
            </section>
          )}

          {status === "error" && (
            <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Erro</p>
                <p className="mt-1">{errorMessage}</p>
              </div>
            </section>
          )}

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
            <h2 className="text-lg font-serif text-foreground">
              1. Visão — daqui a 7 dias
            </h2>

            <textarea
              value={plan.change}
              disabled={isBusy}
              onChange={(e) => updatePlan({ change: e.target.value })}
              placeholder="Qual mudança precisa acontecer nesta semana?"
              className="w-full min-h-[120px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none disabled:opacity-60"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="text-lg font-serif text-foreground">
              2. Provas da semana
            </h2>

            <p className="text-sm text-muted-foreground">
              Marcos concretos que mostram que a semana avançou.
            </p>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={newProof}
                  disabled={isBusy}
                  onChange={(e) => setNewProof(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addProof();
                    }
                  }}
                  placeholder="Adicionar prova da semana"
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={addProof}
                  disabled={isBusy || !newProof.trim()}
                  className="h-12 px-4 rounded-xl border border-primary/20 bg-primary/10 text-primary flex items-center justify-center gap-2 disabled:opacity-50"
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
                        disabled={isBusy}
                        onClick={() => toggleProof(index)}
                        className={`h-9 w-9 shrink-0 rounded-full border flex items-center justify-center disabled:opacity-60 ${
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
                        disabled={isBusy}
                        onClick={() => removeProof(index)}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-60"
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
            <h2 className="text-lg font-serif text-foreground">
              3. O que pode te derrubar nesta semana?
            </h2>

            <textarea
              value={plan.risks}
              disabled={isBusy}
              onChange={(e) => updatePlan({ risks: e.target.value })}
              placeholder="Liste riscos, armadilhas ou padrões que podem atrapalhar."
              className="w-full min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none disabled:opacity-60"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="text-lg font-serif text-foreground">
              4. O que você fará quando isso acontecer?
            </h2>

            <textarea
              value={plan.prevention}
              disabled={isBusy}
              onChange={(e) => updatePlan({ prevention: e.target.value })}
              placeholder="Defina respostas simples para quando os riscos aparecerem."
              className="w-full min-h-[110px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none outline-none disabled:opacity-60"
            />
          </section>

          <section className="sticky bottom-4 rounded-2xl border border-border/50 bg-card/95 backdrop-blur p-4 shadow-lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                {status === "saving" && (
                  <p className="text-muted-foreground">Salvando...</p>
                )}

                {status === "saved" && !dirty && (
                  <p className="text-primary">Salvo no Supabase.</p>
                )}

                {dirty && status !== "saving" && (
                  <p className="text-muted-foreground">
                    Existem alterações não salvas.
                  </p>
                )}

                {status === "idle" && !dirty && (
                  <p className="text-muted-foreground">
                    Nenhuma alteração pendente.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={savePlan}
                disabled={isBusy || !dirty}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {status === "saving" ? "Salvando..." : "Salvar plano"}
              </button>
            </div>
          </section>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={goToWeeklyClosing}
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
