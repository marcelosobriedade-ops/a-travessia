import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { MorningRitual, EMPTY_MORNING_RITUAL } from "@/lib/ritual";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronDown, Wallet } from "lucide-react";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";

type StorageMode = "supabase" | "local";

type FinancialStateValue =
  | ""
  | "apertado"
  | "preocupado"
  | "estavel"
  | "tranquilo"
  | "confiante";

interface FinancialEntry {
  state: FinancialStateValue;
  dailyBudget: string;
  safeAction: string;
  note: string;
}

const EMPTY_FINANCIAL_ENTRY: FinancialEntry = {
  state: "",
  dailyBudget: "",
  safeAction: "",
  note: "",
};

const FINANCIAL_STATES: {
  value: FinancialStateValue;
  label: string;
}[] = [
  { value: "apertado", label: "Apertado" },
  { value: "preocupado", label: "Preocupado" },
  { value: "estavel", label: "Estável" },
  { value: "tranquilo", label: "Tranquilo" },
  { value: "confiante", label: "Confiante" },
];

const SAFE_ACTIONS = [
  "Não comprar por impulso",
  "Olhar saldo",
  "Anotar gastos",
  "Pagar uma conta",
  "Adiar decisão grande",
  "Não gastar hoje",
];

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

function normalizeFinancial(value: any): FinancialEntry {
  return {
    state:
      typeof value?.state === "string"
        ? (value.state as FinancialStateValue)
        : "",
    dailyBudget:
      typeof value?.dailyBudget === "string" ? value.dailyBudget : "",
    safeAction: typeof value?.safeAction === "string" ? value.safeAction : "",
    note: typeof value?.note === "string" ? value.note : "",
  };
}

function hasAnyFinancialData(entry: FinancialEntry) {
  return Boolean(
    entry.state ||
      entry.dailyBudget.trim() ||
      entry.safeAction.trim() ||
      entry.note.trim(),
  );
}

function getLegacyMorningData(dateKey: string) {
  return normalizeMorning(
    safeJsonParse(localStorage.getItem(`${dateKey}-morning-ritual`), {}),
  );
}

function getLegacyFinancialData(dateKey: string) {
  return normalizeFinancial(
    safeJsonParse(
      localStorage.getItem(`${dateKey}-financial`),
      EMPTY_FINANCIAL_ENTRY,
    ),
  );
}

function saveLegacyFinancialData(dateKey: string, entry: FinancialEntry) {
  localStorage.setItem(`${dateKey}-financial`, JSON.stringify(entry));
}

export default function Financial() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [morningRitual, setMorningRitual] =
    useState<MorningRitual>(EMPTY_MORNING_RITUAL);
  const [entry, setEntry] = useState<FinancialEntry>(EMPTY_FINANCIAL_ENTRY);

  const [noteExpanded, setNoteExpanded] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>("local");
  const [hasLoaded, setHasLoaded] = useState(false);

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
        let nextEntry = normalizeFinancial(daily.financial);

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyFinancial = getLegacyFinancialData(dateKey);

        let shouldSave = false;

        const hasSupabaseMorning = Boolean(
          nextMorningRitual.mode ||
            nextMorningRitual.feeling ||
            nextMorningRitual.actions ||
            nextMorningRitual.challenges ||
            nextMorningRitual.control ||
            nextMorningRitual.priorities.some((item) => item.trim()),
        );

        if (!hasSupabaseMorning) {
          const hasLegacyMorning = Boolean(
            legacyMorning.mode ||
              legacyMorning.feeling ||
              legacyMorning.actions ||
              legacyMorning.challenges ||
              legacyMorning.control ||
              legacyMorning.priorities.some((item) => item.trim()),
          );

          if (hasLegacyMorning) {
            nextMorningRitual = legacyMorning;
            shouldSave = true;
          }
        }

        if (
          !hasAnyFinancialData(nextEntry) &&
          hasAnyFinancialData(legacyFinancial)
        ) {
          nextEntry = legacyFinancial;
          shouldSave = true;
        }

        if (shouldSave) {
          await saveDailyRecord(uid, dateKey, {
            morning: nextMorningRitual,
            financial: nextEntry,
          });
        }

        if (cancelled) return;

        setMorningRitual(nextMorningRitual);
        setEntry(nextEntry);
        setNoteExpanded(Boolean(nextEntry.note?.trim()));
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Finanças está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyMorning = getLegacyMorningData(dateKey);
        const legacyFinancial = getLegacyFinancialData(dateKey);

        setUserId(null);
        setStorageMode("local");
        setMorningRitual(legacyMorning);
        setEntry(legacyFinancial);
        setNoteExpanded(Boolean(legacyFinancial.note?.trim()));
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
            financial: entry,
          });
        } else {
          saveLegacyFinancialData(dateKey, entry);
        }
      } catch (error) {
        console.error("Erro ao salvar finanças:", error);
      }
    };

    save();
  }, [entry, hasLoaded, storageMode, userId, dateKey]);

  const isSurvivalMode = morningRitual.mode === "survival";
  const isProductiveMode = morningRitual.mode === "productive";

  const needsCare =
    entry.state === "apertado" ||
    entry.state === "preocupado" ||
    isSurvivalMode;

  const careMessage =
    entry.state === "apertado" || entry.state === "preocupado"
      ? "Hoje vale evitar compras por impulso e decisões grandes."
      : "Hoje vale manter o financeiro simples e seguro.";

  function updateEntry(patch: Partial<FinancialEntry>) {
    setEntry((prev) => ({
      ...prev,
      ...patch,
    }));
  }

  function toggleState(value: FinancialStateValue) {
    updateEntry({
      state: entry.state === value ? "" : value,
    });
  }

  function toggleSafeAction(action: string) {
    updateEntry({
      safeAction: entry.safeAction === action ? "" : action,
    });
  }

  return (
    <Layout>
      <Header title="Finanças" />

      <div className="flex-1 flex flex-col gap-8 overflow-y-auto p-6 pb-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="h-8 w-8" />
          </div>

          <p className="text-center font-serif italic text-muted-foreground">
            "Cuidar do dinheiro também é cuidar da mente."
          </p>
        </div>

        {isProductiveMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Modo produtivo
            </p>
            <p className="mt-1 text-sm text-foreground">
              Hoje vale trazer mais clareza e direção para o financeiro.
            </p>
          </section>
        )}

        {isSurvivalMode && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Modo sobrevivência
            </p>
            <p className="mt-1 text-sm text-foreground">
              Aqui o foco é reduzir risco, evitar impulso e manter só o
              essencial.
            </p>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Como o dinheiro está me afetando hoje?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {FINANCIAL_STATES.map((option) => {
              const selected = entry.state === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleState(option.value)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-center text-sm transition-all",
                    selected
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border/40 bg-card text-muted-foreground hover:border-border/70",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        {needsCare && (
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Cuidado hoje
            </p>
            <p className="mt-1 text-sm text-foreground">{careMessage}</p>
          </section>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Qual é o limite seguro de hoje?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Pode ser um valor simples ou até “sem gasto hoje”.
            </p>
          </div>

          <Input
            value={entry.dailyBudget}
            onChange={(e) => updateEntry({ dailyBudget: e.target.value })}
            placeholder="Ex: R$ 30, R$ 50, sem gasto hoje..."
            className="h-12 rounded-xl border-border/50 bg-card/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />

          <div className="flex flex-wrap gap-2">
            {["R$ 0", "R$ 20", "R$ 50", "Sem gasto hoje"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => updateEntry({ dailyBudget: suggestion })}
                className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Qual é a ação financeira mais segura hoje?
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            {SAFE_ACTIONS.map((action) => {
              const selected = entry.safeAction === action;

              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => toggleSafeAction(action)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-primary/40 bg-primary/8 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {action}
                </button>
              );
            })}
          </div>

          <Textarea
            value={entry.safeAction}
            onChange={(e) => updateEntry({ safeAction: e.target.value })}
            placeholder="Ou escreva sua própria ação segura..."
            className="min-h-[88px] resize-none rounded-xl border-border/40 bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
          />
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setNoteExpanded((prev) => !prev)}
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
                noteExpanded && "rotate-180",
              )}
            />
          </button>

          {noteExpanded && (
            <div className="mt-4 space-y-2">
              <Label
                htmlFor="financial-note"
                className="text-xs font-medium uppercase tracking-widest text-primary/60"
              >
                Registro
              </Label>

              <Textarea
                id="financial-note"
                value={entry.note}
                onChange={(e) => updateEntry({ note: e.target.value })}
                placeholder="Ex: hoje estou com medo de olhar a conta, hoje está sob controle, preciso evitar impulso..."
                className="min-h-[88px] resize-none rounded-xl border-border/40 bg-card shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
