import { getCurrentDateKey } from "@/lib/date";
import { getWeekEndKeyFromDate, getWeekKeyFromDate } from "@/lib/weekly-plan";

export interface DaySummary {
  dateKey: string;
  formattedDate: string;
  weekKey: string;
  weekEndKey: string;
  priorities: string[];
  tasks: { done: number; total: number };
  balance: number;
  eveningEmotion: string | null;
  eveningDone: boolean;
  closed: boolean;
}

export interface WeekSummary {
  weekKey: string;
  weekEndKey: string;
  label: string;
  dayCount: number;
  closedDays: number;
  eveningDays: number;
  completedTasks: number;
  totalTasks: number;
  balance: number;
  days: DaySummary[];
}

export interface EmotionCheckIn {
  emotion: string | null;
  intensity: number | null;
  cause: string;
  observations: string;
}

export interface DayDetail {
  dateKey: string;
  formattedDate: string;
  weekKey: string;
  weekEndKey: string;
  priorities: string[];
  tasks: { id: string; title: string; category?: string; status: string }[];
  transactions: {
    id: string;
    type: string;
    description: string;
    amount: number;
  }[];
  balance: number;
  emotions: {
    morning: EmotionCheckIn;
    afternoon: EmotionCheckIn;
    evening: EmotionCheckIn;
  };
  people: {
    id: string;
    name: string;
    context: string;
    observed: string;
    learned: string;
    nextStep: string;
    boundary: string;
  }[];
  eveningReflection: {
    learning: string;
    improve: string;
    wins: string;
    feeling: string;
    value: string;
  };
  habits: { name: string; done: boolean }[];
  closed: boolean;
  eveningDone: boolean;
}

function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatWeekLabel(weekKey: string): string {
  const weekEndKey = getWeekEndKeyFromDate(weekKey);

  const [startYear, startMonth, startDay] = weekKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = weekEndKey.split("-").map(Number);

  const startDate = new Date(startYear, startMonth - 1, startDay);
  const endDate = new Date(endYear, endMonth - 1, endDay);

  const startLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(startDate);

  const endLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(endDate);

  return `${startLabel} → ${endLabel}`;
}

export function getAllDayKeys(): string[] {
  const datePattern = /^(\d{4}-\d{2}-\d{2})-/;
  const dateSet = new Set<string>();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const match = key.match(datePattern);
    if (match) dateSet.add(match[1]);
  }

  return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
}

export function getDaySummary(dateKey: string): DaySummary {
  const morningRitual = readKey<{ priorities?: string[] }>(
    `${dateKey}-morning-ritual`,
    {},
  );
  const legacyMorning = readKey<string[]>(`${dateKey}-morning`, []);
  const priorities = (morningRitual.priorities ?? legacyMorning).filter(
    (p) => p.trim() !== "",
  );

  const tasks = readKey<{ id: string; status: string }[]>(
    `${dateKey}-tasks`,
    [],
  );
  const doneTasks = tasks.filter((t) => t.status === "done").length;

  const transactions = readKey<{ type: string; amount: number }[]>(
    `${dateKey}-financial`,
    [],
  );
  const balance = transactions.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0,
  );

  const emotions = readKey<{
    morning: { emotion: string | null };
    afternoon: { emotion: string | null };
    evening: { emotion: string | null };
  }>(`${dateKey}-emotions`, {
    morning: { emotion: null },
    afternoon: { emotion: null },
    evening: { emotion: null },
  });

  const eveningEmotion =
    emotions.evening.emotion ||
    emotions.afternoon.emotion ||
    emotions.morning.emotion;

  const nightRitual = readKey<{
    learning?: string;
    improve?: string;
    wins?: string;
    feeling?: string;
    value?: string;
  }>(`${dateKey}-night-ritual`, {});

  const legacyEvening = readKey<{
    good: string;
    different: string;
    learned: string;
  }>(`${dateKey}-evening`, { good: "", different: "", learned: "" });

  const eveningDone =
    [
      nightRitual.learning,
      nightRitual.improve,
      nightRitual.wins,
      nightRitual.feeling,
      nightRitual.value,
    ].some((v) => (v ?? "").trim() !== "") ||
    legacyEvening.good.trim() !== "" ||
    legacyEvening.different.trim() !== "" ||
    legacyEvening.learned.trim() !== "";

  const closed = readKey<boolean>(`${dateKey}-closed`, false);

  return {
    dateKey,
    formattedDate: formatDateKey(dateKey),
    weekKey: getWeekKeyFromDate(dateKey),
    weekEndKey: getWeekEndKeyFromDate(dateKey),
    priorities,
    tasks: { done: doneTasks, total: tasks.length },
    balance,
    eveningEmotion,
    eveningDone,
    closed,
  };
}

export function getAllDaySummaries(): DaySummary[] {
  return getAllDayKeys().map((dateKey) => getDaySummary(dateKey));
}

export function getWeekSummaries(): WeekSummary[] {
  const daySummaries = getAllDaySummaries();

  const grouped = new Map<string, DaySummary[]>();

  for (const day of daySummaries) {
    if (!grouped.has(day.weekKey)) {
      grouped.set(day.weekKey, []);
    }
    grouped.get(day.weekKey)!.push(day);
  }

  return Array.from(grouped.entries())
    .map(([weekKey, days]) => {
      const orderedDays = [...days].sort((a, b) =>
        a.dateKey.localeCompare(b.dateKey),
      );
      const weekEndKey = getWeekEndKeyFromDate(weekKey);

      return {
        weekKey,
        weekEndKey,
        label: formatWeekLabel(weekKey),
        dayCount: orderedDays.length,
        closedDays: orderedDays.filter((d) => d.closed).length,
        eveningDays: orderedDays.filter((d) => d.eveningDone).length,
        completedTasks: orderedDays.reduce((acc, d) => acc + d.tasks.done, 0),
        totalTasks: orderedDays.reduce((acc, d) => acc + d.tasks.total, 0),
        balance: orderedDays.reduce((acc, d) => acc + d.balance, 0),
        days: orderedDays,
      };
    })
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
}

export function getWeekSummary(weekKey: string): WeekSummary | null {
  return getWeekSummaries().find((week) => week.weekKey === weekKey) ?? null;
}

export function getCurrentWeekSummary(): WeekSummary | null {
  return getWeekSummary(getWeekKeyFromDate(getCurrentDateKey()));
}

export function getDayDetail(dateKey: string): DayDetail {
  const morningRitual = readKey<{ priorities?: string[] }>(
    `${dateKey}-morning-ritual`,
    {},
  );
  const legacyMorning = readKey<string[]>(`${dateKey}-morning`, []);
  const priorities = (morningRitual.priorities ?? legacyMorning).filter(
    (p) => p.trim() !== "",
  );

  const tasks = readKey<
    { id: string; title: string; category?: string; status: string }[]
  >(`${dateKey}-tasks`, []);

  const transactions = readKey<
    { id: string; type: string; description: string; amount: number }[]
  >(`${dateKey}-financial`, []);

  const balance = transactions.reduce(
    (acc, t) => acc + (t.type === "income" ? t.amount : -t.amount),
    0,
  );

  const defaultCheckIn: EmotionCheckIn = {
    emotion: null,
    intensity: null,
    cause: "",
    observations: "",
  };

  const emotions = readKey<{
    morning: EmotionCheckIn;
    afternoon: EmotionCheckIn;
    evening: EmotionCheckIn;
  }>(`${dateKey}-emotions`, {
    morning: { ...defaultCheckIn },
    afternoon: { ...defaultCheckIn },
    evening: { ...defaultCheckIn },
  });

  const people = readKey<
    {
      id: string;
      name: string;
      context: string;
      observed: string;
      learned: string;
      nextStep: string;
      boundary: string;
    }[]
  >(`${dateKey}-people`, []);

  const nightRitual = readKey<{
    learning?: string;
    improve?: string;
    wins?: string;
    feeling?: string;
    value?: string;
  }>(`${dateKey}-night-ritual`, {});

  const legacyEvening = readKey<{
    good: string;
    different: string;
    learned: string;
  }>(`${dateKey}-evening`, { good: "", different: "", learned: "" });

  const globalHabits = readKey<{ id: string; name: string }[]>(
    "global-habits",
    [],
  );
  const completedHabits = readKey<string[]>(`${dateKey}-habits-completed`, []);

  const habits = globalHabits.map((h) => ({
    name: h.name,
    done: completedHabits.includes(h.id),
  }));

  const eveningReflection = {
    learning: nightRitual.learning ?? "",
    improve: nightRitual.improve ?? "",
    wins: nightRitual.wins ?? "",
    feeling: nightRitual.feeling ?? "",
    value:
      nightRitual.value ??
      [
        legacyEvening.good.trim(),
        legacyEvening.different.trim(),
        legacyEvening.learned.trim(),
      ]
        .filter(Boolean)
        .join(" | "),
  };

  const eveningDone = [
    eveningReflection.learning,
    eveningReflection.improve,
    eveningReflection.wins,
    eveningReflection.feeling,
    eveningReflection.value,
  ].some((v) => v.trim() !== "");

  const closed = readKey<boolean>(`${dateKey}-closed`, false);

  return {
    dateKey,
    formattedDate: formatDateKey(dateKey),
    weekKey: getWeekKeyFromDate(dateKey),
    weekEndKey: getWeekEndKeyFromDate(dateKey),
    priorities,
    tasks,
    transactions,
    balance,
    emotions,
    people,
    eveningReflection,
    habits,
    closed,
    eveningDone,
  };
}
