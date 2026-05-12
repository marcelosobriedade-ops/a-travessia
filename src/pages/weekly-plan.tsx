import { supabase } from "@/lib/supabase";
import React, { useEffect, useState } from "react";
import { Check, Plus, Save, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { getCurrentDateKey } from "@/lib/date";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  EMPTY_WEEKLY_PLAN,
  WeeklyPlan,
  getWeekKeyFromDate,
  getWeeklyPlanStatus,
} from "@/lib/weekly-plan";
import { getCurrentUserId } from "@/lib/user-data";

type ProofItem = {
  text: string;
  checked: boolean;
};

type SaveStatus = "loading" | "idle" | "saving" | "saved" | "error";

function parseProofs(proofs: string): ProofItem[] {
  if (!proofs?.trim()) return [];

  return proofs
    .split("\\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      text: line.replace("[ ] ", "").replace("[x] ", ""),
      checked: line.startsWith("[x]"),
    }));
}

function serializeProofs(items: ProofItem[]) {
  return items
    .map((item) => `${item.checked ? "[x]" : "[ ]"} ${item.text}`)
    .join("\\n");
}

function normalizeWeeklyPlan(value: any): WeeklyPlan {
  return {
    ...EMPTY_WEEKLY_PLAN,
    change: typeof value?.change === "string" ? value.change : "",
    proofs: typeof value?.proofs === "string" ? value.proofs : "",
    risks: typeof value?.risks === "string" ? value.risks : "",
    prevention: typeof value?.prevention === "string"
      ? value.prevention
      : "",
  };
}

export default function WeeklyPlanPage() {
  const [selectedDateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(selectedDateKey);

  const [plan, setPlan] = useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [newProof, setNewProof] = useState("");

  const proofsList = parseProofs(plan.proofs);
  const weeklyPlanStatus = getWeeklyPlanStatus(plan);

  useEffect(() => {
    const loadPlan = async () => {
      try {
        setStatus("loading");
        setMessage("");

        const uid = await getCurrentUserId();
        setUserId(uid);

        if (!uid) {
          setPlan(EMPTY_WEEKLY_PLAN);
          setDirty(false);
          setStatus("error");
          setMessage("Usuário não autenticado. Faça login novamente.");
          return;
        }

        const { data, error } = await supabase
          .from("weekly_meta")
          .select("plan")
          .eq("user_id", uid)
          .eq("week_key", weekKey)
          .maybeSingle();

        if (error) throw error;

        setPlan(
          data?.plan ? normalizeWeeklyPlan(data.plan) : EMPTY_WEEKLY_PLAN,
        );
        setDirty(false);
        setStatus("idle");
      } catch (error: any) {
        console.error("Erro ao carregar plano semanal:", error);
        setStatus("error");
        setMessage(error?.message || "Erro ao carregar plano semanal.");
      }
    };

    loadPlan();
  }, [weekKey]);

  const updatePlan = (patch: Partial<WeeklyPlan>) => {
    setPlan((current) => ({
      ...current,
      ...patch,
    }));

    setDirty(true);

    if (status === "saved") {
      setStatus("idle");
      setMessage("");
    }
  };

  const savePlan = async () => {
    if (!userId) {
      setStatus("error");
      setMessage("Usuário não autenticado. Faça login novamente.");
      return;
    }

    try {
      setStatus("saving");
      setMessage("Salvando...");

      const cleanPlan = normalizeWeeklyPlan(plan);

      console.log("SALVANDO PLANO:", cleanPlan);

      const { error } = await supabase
        .from("weekly_meta")
        .upsert(
          {
            user_id: userId,
            week_key: weekKey,
            plan: cleanPlan,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,week_key",
          },
        );

      if (error) throw error;

      setPlan(cleanPlan);
      setDirty(false);
      setStatus("saved");
      setMessage("Salvo no Supabase.");
    } catch (error: any) {
      console.error("Erro ao salvar plano semanal:", error);
      setStatus("error");
      setMessage(error?.message || "Erro ao salvar plano semanal.");
    }
  };

  const addProof = () => {
    const value = newProof.trim();
    if (!value) return;

    updatePlan({
      proofs: serializeProofs([...proofsList, { text: value, checked: false }]),
    });

    setNewProof("");
  };

  const toggleProof = (indexToToggle: number) => {
    updatePlan({
      proofs: serializeProofs(
        proofsList.map((proof, index) =>
          index === indexToToggle
            ? { ...proof, checked: !proof.checked }
            : proof,
        ),
      ),
    });
  };

  const removeProof = (indexToRemove: number) => {
    updatePlan({
      proofs: serializeProofs(
        proofsList.filter((_, index) => index !== indexToRemove),
      ),
    });
  };

  const isBusy = status === "loading" || status === "saving";

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-background px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Semana iniciada em {weekKey}
            </p>

            <h1 className="font-serif text-3xl text-foreground">
              Plano Semanal
            </h1>

            <p className="text-sm text-muted-foreground">{weeklyPlanStatus}</p>
          </header>

          {message && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                status === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {message}
            </div>
          )}

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-serif text-xl text-foreground">
              1. Visão — daqui a 7 dias
            </h2>

            <textarea
              value={plan.change}
              disabled={isBusy}
              onChange={(e) => updatePlan({ change: e.target.value })}
              placeholder="Qual mudança precisa acontecer nesta semana?"
              className="min-h-[120px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none disabled:opacity-60"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-serif text-xl text-foreground">
              2. Provas da semana
            </h2>

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
                className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none disabled:opacity-60"
              />

              <button
                type="button"
                onClick={addProof}
                disabled={isBusy || !newProof.trim()}
                className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {proofsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma prova adicionada ainda.
                </p>
              ) : (
                proofsList.map((proof, index) => (
                  <div
                    key={`${proof.text}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleProof(index)}
                      disabled={isBusy}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                        proof.checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    <p
                      className={`flex-1 text-sm ${
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
                      disabled={isBusy}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-serif text-xl text-foreground">
              3. O que pode te derrubar nesta semana?
            </h2>

            <textarea
              value={plan.risks}
              disabled={isBusy}
              onChange={(e) => updatePlan({ risks: e.target.value })}
              placeholder="Liste riscos, armadilhas ou padrões que podem atrapalhar."
              className="min-h-[110px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none disabled:opacity-60"
            />
          </section>

          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-serif text-xl text-foreground">
              4. O que você fará quando isso acontecer?
            </h2>

            <textarea
              value={plan.prevention}
              disabled={isBusy}
              onChange={(e) => updatePlan({ prevention: e.target.value })}
              placeholder="Defina respostas simples para quando os riscos aparecerem."
              className="min-h-[110px] w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none disabled:opacity-60"
            />
          </section>

          <section className="sticky bottom-4 rounded-2xl border border-border/50 bg-card/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {dirty
                  ? "Existem alterações não salvas."
                  : status === "saved"
                    ? "Última alteração salva."
                    : "Nenhuma alteração pendente."}
              </p>

              <button
                type="button"
                onClick={savePlan}
                disabled={isBusy || !dirty}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {status === "saving" ? "Salvando..." : "Salvar plano"}
              </button>
            </div>
          </section>
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
    <a href={href}>
      <div className="rounded-[22px] border border-border/50 bg-card px-2 py-3 text-center shadow-sm cursor-pointer">
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-xs text-foreground leading-tight">{label}</p>
      </div>
    </a>
  );
}
</query>
