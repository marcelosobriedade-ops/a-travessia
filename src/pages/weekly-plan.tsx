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
  return proofs.split("\n").map((line) => ({
    text: line.replace("[ ] ", "").replace("[x] ", ""),
    checked: line.startsWith("[x]"),
  }));
}

function serializeProofs(items: ProofItem[]) {
  return items.map((i) => `${i.checked ? "[x]" : "[ ]"} ${i.text}`).join("\n");
}

function normalizeWeeklyPlan(value: any): WeeklyPlan {
  return {
    ...EMPTY_WEEKLY_PLAN,
    change: value?.change ?? "",
    proofs: value?.proofs ?? "",
    risks: value?.risks ?? "",
    prevention: value?.prevention ?? "",
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
  const [dirty, setDirty] = useState(false);
  const [newProof, setNewProof] = useState("");

  const proofsList = parseProofs(plan.proofs);

  // LOAD
  useEffect(() => {
    const load = async () => {
      setStatus("loading");

      const uid = await getCurrentUserId();
      setUserId(uid);

      const { data } = await supabase
        .from("weekly_meta")
        .select("plan")
        .eq("user_id", uid)
        .eq("week_key", weekKey)
        .maybeSingle();

      setPlan(data?.plan ? normalizeWeeklyPlan(data.plan) : EMPTY_WEEKLY_PLAN);

      setStatus("idle");
    };

    load();
  }, [weekKey]);

  const updatePlan = (patch: Partial<WeeklyPlan>) => {
    setPlan((p) => ({ ...p, ...patch }));
    setDirty(true);
  };

  // SAVE (simples e confiável)
  const savePlan = async () => {
    if (!userId) return;

    setStatus("saving");

    const clean = normalizeWeeklyPlan(plan);

    const { error } = await supabase.from("weekly_meta").upsert(
      {
        user_id: userId,
        week_key: weekKey,
        plan: clean,
      },
      { onConflict: "user_id,week_key" },
    );

    if (error) {
      setStatus("error");
      return;
    }

    // 🔥 reload garantido
    const { data } = await supabase
      .from("weekly_meta")
      .select("plan")
      .eq("user_id", userId)
      .eq("week_key", weekKey)
      .maybeSingle();

    setPlan(data?.plan ? normalizeWeeklyPlan(data.plan) : EMPTY_WEEKLY_PLAN);

    setDirty(false);
    setStatus("saved");
  };

  const addProof = () => {
    if (!newProof.trim()) return;
    updatePlan({
      proofs: serializeProofs([
        ...proofsList,
        { text: newProof, checked: false },
      ]),
    });
    setNewProof("");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">Plano Semanal</h1>

        {/* VISÃO */}
        <textarea
          value={plan.change}
          onChange={(e) => updatePlan({ change: e.target.value })}
          className="w-full border p-3"
        />

        {/* PROVAS */}
        <div>
          <input
            value={newProof}
            onChange={(e) => setNewProof(e.target.value)}
            placeholder="Nova prova"
            className="border p-2 w-full"
          />
          <button onClick={addProof}>Adicionar</button>

          {proofsList.map((p, i) => (
            <div key={i}>{p.text}</div>
          ))}
        </div>

        {/* RISCOS */}
        <textarea
          value={plan.risks}
          onChange={(e) => updatePlan({ risks: e.target.value })}
          className="w-full border p-3"
        />

        {/* PREVENÇÃO */}
        <textarea
          value={plan.prevention}
          onChange={(e) => updatePlan({ prevention: e.target.value })}
          className="w-full border p-3"
        />

        {/* STATUS */}
        <div>
          {status === "saving" && "Salvando..."}
          {status === "saved" && "Salvo no Supabase"}
          {status === "error" && "Erro ao salvar"}
        </div>

        <button onClick={savePlan} disabled={!dirty}>
          Salvar plano
        </button>
      </div>
    </Layout>
  );
}
