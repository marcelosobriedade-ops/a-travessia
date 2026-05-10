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

        setUserId(uid);
        setStorageMode("supabase");

        const daily = await getDailyRecord(uid, dateKey);
        if (cancelled) return;

        const supabaseMorning = daily.morning ?? {};
        const hasSupabaseMorning = Object.keys(supabaseMorning).length > 0;

        let nextRitual = normalizeMorning(supabaseMorning);
        let nextFeelingNote =
          typeof supabaseMorning.feelingNote === "string"
            ? supabaseMorning.feelingNote
            : "";

        if (!hasSupabaseMorning) {
          const legacy = getLegacyMorningData(dateKey);
          const hasLegacyData = Boolean(
            legacy.note ||
              legacy.ritual.mode ||
              legacy.ritual.feeling ||
              legacy.ritual.actions ||
              legacy.ritual.challenges ||
              legacy.ritual.control ||
              legacy.ritual.priorities.some((item) => item.trim()),
          );

          if (hasLegacyData) {
            nextRitual = legacy.ritual;
            nextFeelingNote = legacy.note;

            await saveDailyRecord(uid, dateKey, {
              morning: {
                ...legacy.ritual,
                feelingNote: legacy.note,
              },
            });
          }
        }

        if (cancelled) return;

        setRitual(nextRitual);
        setFeelingNote(nextFeelingNote);
        await loadWeeklyPlan(uid);
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. A manhã está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacy = getLegacyMorningData(dateKey);

        setUserId(null);
        setStorageMode("local");
        setRitual(legacy.ritual);
        setFeelingNote(legacy.note);
        setWeeklyPlan(null);
        setTodayWeeklyFocus("");
        setPendingProofs([]);
        setHasLoaded(true);
      }
    };

    loadMorning();

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
            morning: {
              ...ritual,
              feelingNote,
            },
          });
        } else {
          saveLegacyMorningData(dateKey, ritual, feelingNote);
        }
      } catch (error) {
        console.error("Erro ao salvar manhã:", error);
      }
    };

    save();
  }, [ritual, feelingNote, hasLoaded, storageMode, userId, dateKey]);

  useEffect(() => {
    if (
      ritual.feeling?.trim() &&
      !feelingValues.includes(ritual.feeling as any) &&
      !feelingNote.trim()
    ) {
      setFeelingNote(ritual.feeling);
      setRitual((prev) => ({ ...prev, feeling: "" }));
    }
  }, []);

  const toggleProofFromMorning = async (proofText: string) => {
    if (!weeklyPlan || !userId) return;

    const currentProofs = parseProofs(weeklyPlan.proofs ?? "");
    const nextProofs = currentProofs.map((proof) =>
      proof.text === proofText ? { ...proof, checked: !proof.checked } : proof,
    );

    const nextPlan = {
      ...weeklyPlan,
      proofs: serializeProofs(nextProofs),
    };

    setWeeklyPlan(nextPlan);
    setPendingProofs(nextProofs.filter((proof) => !proof.checked));

    const { error } = await supabase.from("weekly_meta").upsert(
      {
        week_key: weekKey,
        user_id: userId,
        plan: nextPlan,
      },
      {
        onConflict: "user_id,week_key",
      },
    );

    if (error) {
      console.error("Erro ao marcar prova na manhã:", error);
      await loadWeeklyPlan(userId);
    }
  };

  function setField<K extends keyof MorningRitual>(
    key: K,
    value: MorningRitual[K],
  ) {
    setRitual((prev) => ({ ...prev, [key]: value }));
  }

  function setPriority(index: number, value: string) {
    setRitual((prev) => {
      const next: [string, string, string] = [...prev.priorities] as [
        string,
        string,
        string,
      ];
      next[index] = value;
      return { ...prev, priorities: next };
    });
  }

  const filledPriorities = (ritual.priorities || []).filter((item) =>
    item?.trim(),
  );

  const prioritiesSummary =
    filledPriorities.length === 0
      ? "Nenhuma prioridade definida ainda"
      : filledPriorities.length === 1
        ? filledPriorities[0]
        : `${filledPriorities.length} prioridades definidas`;

  const proofsSummary =
    pendingProofs.length === 0
      ? "Nenhuma prova pendente"
      : pendingProofs.length === 1
        ? "1 prova pendente"
        : `${pendingProofs.length} provas pendentes`;

  const essentialPriority =
    ritual.priorities[0] ||
    todayWeeklyFocus ||
    weeklyPlan?.change?.trim() ||
    "";

  return (
    <Layout>
      <Header title="Manhã" />

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto p-6 pb-12">
        <p className="text-center font-serif italic text-muted-foreground">
          "Que o teu princípio seja este: agir como um estóico."
        </p>

        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
            Modo do dia
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {DAY_MODES.map((m) => {
              const selected = ritual.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setField("mode", selected ? "" : m.value)}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-center text-xs font-medium transition-all",
                    selected
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border/40 bg-card text-muted-foreground hover:border-border/70",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </section>

        {isProductiveMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Modo produtivo
            </p>
            <p className="mt-1 text-sm text-foreground">
              Hoje a manhã assume mais direção, clareza e tração.
            </p>
          </section>
        )}

        {isSurvivalMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HeartPulse className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Modo sobrevivência
                </p>
                <p className="mt-1 text-sm text-foreground">
                  Hoje vamos reduzir o peso e focar só no essencial.
                </p>
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

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Como estou me sentindo agora?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FEELING_OPTIONS.map((option) => {
              const selected = selectedFeeling === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setField("feeling", selected ? "" : option.value)
                  }
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center transition-all",
                    selected
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border/40 bg-card text-muted-foreground hover:border-border/70",
                  )}
                >
                  <div className="text-lg">{option.emoji}</div>
                  <div className="mt-1 text-xs font-medium">{option.label}</div>
                </button>
              );
            })}
          </div>

          <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setFeelingNoteExpanded((prev) => !prev)}
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
                  feelingNoteExpanded && "rotate-180",
                )}
              />
            </button>

            {feelingNoteExpanded && (
              <div className="mt-4">
                <Textarea
                  id="feeling-note"
                  value={feelingNote}
                  onChange={(e) => setFeelingNote(e.target.value)}
                  placeholder="Se quiser, escreva em uma frase curta."
                  className="min-h-[78px] resize-none rounded-xl border-border/40 bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            )}
          </section>
        </section>

        {(weeklyPlan?.change || todayWeeklyFocus) && (
          <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              O que este dia pede
            </h2>

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
          </section>
        )}

        {isSurvivalMode ? (
          <>
            <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <div className="space-y-1.5">
                <Label
                  htmlFor="essential-priority"
                  className="text-xs font-medium uppercase tracking-widest text-primary/70"
                >
                  Hoje, só o essencial
                </Label>
                <Input
                  id="essential-priority"
                  value={essentialPriority}
                  onChange={(e) => setPriority(0, e.target.value)}
                  placeholder="Se precisar, escolha só uma coisa."
                  className="h-11 rounded-none border-0 border-b border-border/50 bg-transparent px-0 text-base placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-0"
                />
              </div>
            </section>

            <MorningTextarea
              id="actions"
              label="Qual é o menor passo possível agora?"
              placeholder="Qual é o menor movimento possível para este momento?"
              value={ritual.actions}
              onChange={(v) => setField("actions", v)}
            />

            <MorningTextarea
              id="control"
              label="Como quero me tratar hoje?"
              placeholder="Como você quer se responder hoje, com menos peso?"
              value={ritual.control}
              onChange={(v) => setField("control", v)}
            />
          </>
        ) : isProductiveMode ? (
          <>
            <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <div>
                <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                  Prioridades do dia
                </h2>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Hoje vale abrir a manhã com clareza e tração.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {([0, 1, 2] as const).map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Label
                      htmlFor={`priority-${i}`}
                      className="text-xs font-medium uppercase tracking-widest text-primary/60"
                    >
                      Prioridade {i + 1}
                    </Label>
                    <Input
                      id={`priority-${i}`}
                      value={ritual.priorities[i]}
                      onChange={(e) => setPriority(i, e.target.value)}
                      placeholder="O que precisa ser sustentado hoje?"
                      className="h-11 rounded-none border-0 border-b border-border/50 bg-transparent px-0 text-base placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-0"
                    />
                  </div>
                ))}

                <p className="text-right text-xs text-muted-foreground/50">
                  Máximo de 3 por dia
                </p>
              </div>
            </section>

            <MorningTextarea
              id="actions"
              label="Qual é o primeiro passo possível hoje?"
              placeholder="Qual é a ação mais simples e concreta para começar?"
              value={ritual.actions}
              onChange={(v) => setField("actions", v)}
            />

            <MorningTextarea
              id="challenges"
              label="O que pode me derrubar hoje?"
              placeholder="Antecipe o que pode te desorganizar, travar ou puxar para baixo."
              value={ritual.challenges}
              onChange={(v) => setField("challenges", v)}
            />

            <MorningTextarea
              id="control"
              label="Como quero responder?"
              placeholder="Como você quer agir quando isso acontecer?"
              value={ritual.control}
              onChange={(v) => setField("control", v)}
            />

            {pendingProofs.length > 0 && (
              <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
                <div>
                  <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Provas da semana
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {proofsSummary}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  {pendingProofs.map((proof, index) => (
                    <button
                      key={`${proof.text}-${index}`}
                      type="button"
                      onClick={() => toggleProofFromMorning(proof.text)}
                      className="flex w-full items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/30 px-3 py-3 text-left transition-colors hover:bg-amber-50/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/70 text-amber-700">
                        <Check className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug text-foreground">
                          {proof.text}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Toque para marcar como tocada
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setPrioritiesExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                    Prioridade do dia
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {prioritiesSummary}
                  </p>
                </div>

                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                    prioritiesExpanded && "rotate-180",
                  )}
                />
              </button>

              {prioritiesExpanded && (
                <div className="mt-5 space-y-4">
                  {([0, 1, 2] as const).map((i) => (
                    <div key={i} className="space-y-1.5">
                      <Label
                        htmlFor={`priority-${i}`}
                        className="text-xs font-medium uppercase tracking-widest text-primary/60"
                      >
                        Prioridade {i + 1}
                      </Label>
                      <Input
                        id={`priority-${i}`}
                        value={ritual.priorities[i]}
                        onChange={(e) => setPriority(i, e.target.value)}
                        placeholder="O que precisa ser sustentado hoje?"
                        className="h-11 rounded-none border-0 border-b border-border/50 bg-transparent px-0 text-base placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-0"
                      />
                    </div>
                  ))}

                  <p className="text-right text-xs text-muted-foreground/50">
                    Máximo de 3 por dia
                  </p>
                </div>
              )}
            </section>

            <MorningTextarea
              id="actions"
              label="Qual é o primeiro passo possível hoje?"
              placeholder="Qual é a ação mais simples e concreta para começar?"
              value={ritual.actions}
              onChange={(v) => setField("actions", v)}
            />

            <MorningTextarea
              id="challenges"
              label="O que pode me derrubar hoje?"
              placeholder="Antecipe o que pode te desorganizar, travar ou puxar para baixo."
              value={ritual.challenges}
              onChange={(v) => setField("challenges", v)}
            />

            <MorningTextarea
              id="control"
              label="Como quero responder?"
              placeholder="Como você quer agir quando isso acontecer?"
              value={ritual.control}
              onChange={(v) => setField("control", v)}
            />

            {pendingProofs.length > 0 && (
              <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setProofsExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
                      Provas da semana
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {proofsSummary}
                    </p>
                  </div>

                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                      proofsExpanded && "rotate-180",
                    )}
                  />
                </button>

                {proofsExpanded && (
                  <div className="mt-4 space-y-2">
                    {pendingProofs.map((proof, index) => (
                      <button
                        key={`${proof.text}-${index}`}
                        type="button"
                        onClick={() => toggleProofFromMorning(proof.text)}
                        className="flex w-full items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/30 px-3 py-3 text-left transition-colors hover:bg-amber-50/50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/70 text-amber-700">
                          <Check className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground">
                            {proof.text}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Toque para marcar como tocada
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function MorningTextarea({
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
    <div className="space-y-2">
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
        className="min-h-[90px] resize-none rounded-xl border-border/40 bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
      />
    </div>
  );
}
