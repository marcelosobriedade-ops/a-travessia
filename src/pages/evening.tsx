import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { NightRitual, EMPTY_NIGHT_RITUAL } from "@/lib/ritual";
import { getWeekKeyFromDate } from "@/lib/weekly-plan";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";

type StorageMode = "supabase" | "local";

type ProofItem = {
  text: string;
  checked: boolean;
};

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

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeNight(value: any): NightRitual {
  return {
    ...EMPTY_NIGHT_RITUAL,
    ...(value || {}),
    learning: typeof value?.learning === "string" ? value.learning : "",
    improve: typeof value?.improve === "string" ? value.improve : "",
    wins: typeof value?.wins === "string" ? value.wins : "",
    feeling: typeof value?.feeling === "string" ? value.feeling : "",
    value: typeof value?.value === "string" ? value.value : "",
  };
}

function hasAnyNightData(ritual: NightRitual) {
  return Boolean(
    ritual.learning?.trim() ||
      ritual.improve?.trim() ||
      ritual.wins?.trim() ||
      ritual.feeling?.trim() ||
      ritual.value?.trim(),
  );
}

function getLegacyNightData(dateKey: string) {
  return normalizeNight(
    safeJsonParse(localStorage.getItem(`${dateKey}-night-ritual`), {}),
  );
}

function saveLegacyNightData(dateKey: string, ritual: NightRitual) {
  localStorage.setItem(`${dateKey}-night-ritual`, JSON.stringify(ritual));
}

export default function Evening() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(dateKey);

  const [ritual, setRitual] = useState<NightRitual>(EMPTY_NIGHT_RITUAL);
  const [weeklyPlan, setWeeklyPlan] = useState<any>(null);
  const [todayWeeklyFocus, setTodayWeeklyFocus] = useState("");
  const [pendingProofs, setPendingProofs] = useState<ProofItem[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [hasLoaded, setHasLoaded] = useState(false);

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
      console.error("Erro ao carregar plano semanal na noite:", error);
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

    const loadData = async () => {
      setHasLoaded(false);

      try {
        const uid = await getCurrentUserId();
        if (cancelled) return;

        if (!uid) {
          const legacyNight = getLegacyNightData(dateKey);

          setUserId(null);
          setStorageMode("local");
          setRitual(legacyNight);
          setWeeklyPlan(null);
          setTodayWeeklyFocus("");
          setPendingProofs([]);
          setHasLoaded(true);
          return;
        }

        setUserId(uid);
        setStorageMode("supabase");

        const daily = await getDailyRecord(uid, dateKey);
        if (cancelled) return;

        let nextRitual = normalizeNight(daily.evening);
        const legacyNight = getLegacyNightData(dateKey);

        if (!hasAnyNightData(nextRitual) && hasAnyNightData(legacyNight)) {
          nextRitual = legacyNight;
          await saveDailyRecord(uid, dateKey, {
            evening: nextRitual,
          });
        }

        if (cancelled) return;

        setRitual(nextRitual);
        await loadWeeklyPlan(uid);
        setHasLoaded(true);
      } catch (error) {
        console.error("Erro ao carregar noite:", error);

        if (cancelled) return;

        const legacyNight = getLegacyNightData(dateKey);

        setUserId(null);
        setStorageMode("local");
        setRitual(legacyNight);
        setWeeklyPlan(null);
        setTodayWeeklyFocus("");
        setPendingProofs([]);
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

    const save = async () => {
      try {
        if (storageMode === "supabase" && userId) {
          await saveDailyRecord(userId, dateKey, {
            evening: ritual,
          });
        } else {
          saveLegacyNightData(dateKey, ritual);
        }
      } catch (error) {
        console.error("Erro ao salvar noite:", error);
      }
    };

    save();
  }, [ritual, hasLoaded, storageMode, userId, dateKey]);

  function setField(key: keyof NightRitual, value: string) {
    setRitual((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Layout>
      <Header title="Noite" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic mb-2">
          "Examine as suas ações do dia. O que fez de errado? O que fez de
          certo? O que deixou por fazer?"
        </p>

        {(weeklyPlan?.change ||
          todayWeeklyFocus ||
          pendingProofs.length > 0) && (
          <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
            <div>
              <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                Fechamento da semana no dia
              </h2>
              <p className="text-xs text-muted-foreground/60 mt-1">
                A noite revê o dia à luz da direção da semana.
              </p>
            </div>

            {weeklyPlan?.change && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Direção da semana
                </p>
                <p className="text-sm text-foreground">{weeklyPlan.change}</p>
              </div>
            )}

            {todayWeeklyFocus && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Foco de hoje
                </p>
                <p className="text-sm text-foreground">{todayWeeklyFocus}</p>
              </div>
            )}

            {pendingProofs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Provas ainda pendentes
                </p>
                <div className="space-y-2">
                  {pendingProofs.map((proof, index) => (
                    <div
                      key={`${proof.text}-${index}`}
                      className="rounded-xl border border-border/40 bg-background px-3 py-2"
                    >
                      <p className="text-sm text-foreground">{proof.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <div className="space-y-8">
          <NightField
            id="learning"
            label="1. O que me aproximou da mudança da semana hoje?"
            placeholder="O que hoje apoiou a travessia da semana?"
            value={ritual.learning}
            onChange={(v) => setField("learning", v)}
          />

          <NightField
            id="improve"
            label="2. O que me afastou ou me derrubou hoje?"
            placeholder="Onde desviei, me perdi ou cedi ao automático?"
            value={ritual.improve}
            onChange={(v) => setField("improve", v)}
          />

          <NightField
            id="wins"
            label="3. Que prova, passo ou pequena vitória toquei hoje?"
            placeholder="Quais sinais reais de avanço apareceram no dia?"
            value={ritual.wins}
            onChange={(v) => setField("wins", v)}
          />

          <NightField
            id="feeling"
            label="4. Como estou terminando este dia?"
            placeholder="Estado emocional, mental e físico ao fechar o dia..."
            value={ritual.feeling}
            onChange={(v) => setField("feeling", v)}
          />

          <NightField
            id="value"
            label="5. Qual ajuste ou intenção eu deixo para amanhã?"
            placeholder="Amanhã, o que precisa ser lembrado, protegido ou ajustado?"
            value={ritual.value}
            onChange={(v) => setField("value", v)}
          />
        </div>
      </div>
    </Layout>
  );
}

function NightField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label
        htmlFor={id}
        className="text-sm font-medium uppercase tracking-widest text-primary/80"
      >
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-none bg-card border-border/40 rounded-xl min-h-[110px] focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
      />
    </div>
  );
}
