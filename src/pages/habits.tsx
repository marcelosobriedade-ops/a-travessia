import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { getWeekKeyFromDate } from "@/lib/weekly-plan";
import { Input } from "@/components/ui/input";
import { Check, Plus, Trash2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
  getUserHabits,
  saveUserHabits,
  getWeeklyMeta,
  saveWeeklyMeta,
} from "@/lib/user-data";

type StorageMode = "supabase" | "local";

interface Habit {
  id: string;
  title: string;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "1", title: "Meditação (10m)" },
  { id: "2", title: "Leitura (15m)" },
  { id: "3", title: "Exercício físico" },
];

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeHabits(value: any): Habit[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => ({
      id:
        typeof item?.id === "string"
          ? item.id
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: typeof item?.title === "string" ? item.title : "",
    }))
    .filter((item) => item.title.trim());
}

function normalizeCompleted(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function getLegacyHabits() {
  const stored = safeJsonParse<Habit[] | null>(
    localStorage.getItem("global-habits"),
    null,
  );

  if (!stored) return DEFAULT_HABITS;
  return normalizeHabits(stored);
}

function saveLegacyHabits(habits: Habit[]) {
  localStorage.setItem("global-habits", JSON.stringify(habits));
}

function getLegacyCompleted(dateKey: string) {
  return normalizeCompleted(
    safeJsonParse(localStorage.getItem(`${dateKey}-habits-completed`), []),
  );
}

function saveLegacyCompleted(dateKey: string, completed: string[]) {
  localStorage.setItem(
    `${dateKey}-habits-completed`,
    JSON.stringify(completed),
  );
}

function getLegacyWeekVirtue(weekKey: string) {
  const value = safeJsonParse(
    localStorage.getItem(`planner-week-virtue-${weekKey}`),
    "",
  );
  return typeof value === "string" ? value : "";
}

function saveLegacyWeekVirtue(weekKey: string, value: string) {
  localStorage.setItem(`planner-week-virtue-${weekKey}`, JSON.stringify(value));
}

function hasAnyHabits(habits: Habit[]) {
  return Array.isArray(habits) && habits.length > 0;
}

export default function Habits() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(dateKey);

  const [habits, setHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [weekVirtue, setWeekVirtue] = useState("");
  const [newHabit, setNewHabit] = useState("");

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

        const [daily, storedHabits, weeklyMeta] = await Promise.all([
          getDailyRecord(uid, dateKey),
          getUserHabits(uid),
          getWeeklyMeta(uid, weekKey),
        ]);

        if (cancelled) return;

        const legacyHabits = getLegacyHabits();
        const legacyCompleted = getLegacyCompleted(dateKey);
        const legacyWeekVirtue = getLegacyWeekVirtue(weekKey);

        let nextHabits = normalizeHabits(storedHabits);
        let nextCompleted = normalizeCompleted(daily.habits_completed);
        let nextWeekVirtue =
          typeof weeklyMeta?.virtue === "string" ? weeklyMeta.virtue : "";

        if (!hasAnyHabits(nextHabits)) {
          if (hasAnyHabits(legacyHabits)) {
            nextHabits = legacyHabits;
          } else {
            nextHabits = DEFAULT_HABITS;
          }

          await saveUserHabits(uid, nextHabits);
        }

        if (nextCompleted.length === 0 && legacyCompleted.length > 0) {
          nextCompleted = legacyCompleted;
          await saveDailyRecord(uid, dateKey, {
            habits_completed: nextCompleted,
          });
        }

        if (!nextWeekVirtue.trim() && legacyWeekVirtue.trim()) {
          nextWeekVirtue = legacyWeekVirtue;
          await saveWeeklyMeta(uid, weekKey, {
            virtue: nextWeekVirtue,
          });
        }

        const validCompleted = nextCompleted.filter((id) =>
          nextHabits.some((habit) => habit.id === id),
        );

        if (validCompleted.length !== nextCompleted.length && uid) {
          nextCompleted = validCompleted;
          await saveDailyRecord(uid, dateKey, {
            habits_completed: nextCompleted,
          });
        }

        if (cancelled) return;

        setHabits(nextHabits);
        setCompleted(nextCompleted);
        setWeekVirtue(nextWeekVirtue);

        saveLegacyHabits(nextHabits);
        saveLegacyCompleted(dateKey, nextCompleted);
        saveLegacyWeekVirtue(weekKey, nextWeekVirtue);

        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Hábitos está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyHabits = getLegacyHabits();
        const legacyCompleted = getLegacyCompleted(dateKey).filter((id) =>
          legacyHabits.some((habit) => habit.id === id),
        );
        const legacyWeekVirtue = getLegacyWeekVirtue(weekKey);

        setUserId(null);
        setStorageMode("local");
        setHabits(legacyHabits);
        setCompleted(legacyCompleted);
        setWeekVirtue(legacyWeekVirtue);
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
        const validCompleted = completed.filter((id) =>
          habits.some((habit) => habit.id === id),
        );

        if (validCompleted.length !== completed.length) {
          setCompleted(validCompleted);
          return;
        }

        if (storageMode === "supabase" && userId) {
          await Promise.all([
            saveUserHabits(userId, habits),
            saveDailyRecord(userId, dateKey, {
              habits_completed: validCompleted,
            }),
            saveWeeklyMeta(userId, weekKey, {
              virtue: weekVirtue,
            }),
          ]);
        }

        saveLegacyHabits(habits);
        saveLegacyCompleted(dateKey, validCompleted);
        saveLegacyWeekVirtue(weekKey, weekVirtue);
      } catch (error) {
        console.error("Erro ao salvar hábitos:", error);
      }
    };

    save();
  }, [
    habits,
    completed,
    weekVirtue,
    hasLoaded,
    storageMode,
    userId,
    dateKey,
    weekKey,
  ]);

  const addHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabit.trim()) return;

    setHabits((prev) => [
      ...prev,
      { id: Date.now().toString(), title: newHabit.trim() },
    ]);
    setNewHabit("");
  };

  const deleteHabit = (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setCompleted((prev) => prev.filter((c) => c !== id));
  };

  const toggleHabit = (id: string) => {
    setCompleted((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  return (
    <Layout>
      <Header title="Hábitos" />

      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="mb-6 flex flex-col items-center justify-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>

          <p className="text-center font-serif italic text-muted-foreground">
            "A excelência não é um ato, mas um hábito."
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="mb-3">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Virtude da semana
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              A virtude que acompanha esta travessia nesta semana.
            </p>
          </div>

          <Input
            value={weekVirtue}
            onChange={(e) => setWeekVirtue(e.target.value)}
            placeholder="Ex: Disciplina, Presença, Coragem..."
            className="h-12 rounded-xl border-border/50 bg-card/50 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />
        </section>

        <form onSubmit={addHabit} className="relative mb-8 flex-shrink-0">
          <Input
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            placeholder="Novo hábito..."
            className="h-14 rounded-xl border-border/50 bg-card/50 pr-12 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>

        <div className="-mx-2 flex-1 space-y-3 overflow-y-auto px-2 pb-8">
          {habits.length === 0 ? (
            <p className="py-8 text-center font-serif italic text-muted-foreground/60">
              Nenhum hábito configurado.
            </p>
          ) : (
            habits.map((habit) => {
              const isCompleted = completed.includes(habit.id);

              return (
                <div
                  key={habit.id}
                  className={cn(
                    "group flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-all",
                    isCompleted
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/30 hover:border-border/60",
                  )}
                  onClick={() => toggleHabit(habit.id)}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/30 text-transparent",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </div>

                  <span
                    className={cn(
                      "flex-1 text-lg font-medium transition-all",
                      isCompleted ? "text-foreground" : "text-foreground/80",
                    )}
                  >
                    {habit.title}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteHabit(habit.id);
                    }}
                    className="rounded-lg p-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
