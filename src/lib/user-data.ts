import { supabase } from "@/lib/supabase";

export interface DailyRecord {
  morning: Record<string, any>;
  emotions: Record<string, any>;
  tasks: any[];
  financial: Record<string, any>;
  people: any[];
  evening: Record<string, any>;
  sos: Record<string, any>;
  habits_completed: string[];
  closed: boolean;
}

export const EMPTY_DAILY_RECORD: DailyRecord = {
  morning: {},
  emotions: {
    morning: {},
    afternoon: {},
    evening: {},
  },
  tasks: [],
  financial: {},
  people: [],
  evening: {},
  sos: {},
  habits_completed: [],
  closed: false,
};

export interface WeeklyMetaRecord {
  virtue: string;
  closing: Record<string, any>;
}

export const EMPTY_WEEKLY_META: WeeklyMetaRecord = {
  virtue: "",
  closing: {},
};

export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Erro ao obter usuário atual:", error);
    return null;
  }

  return user?.id ?? null;
}

export async function getDailyRecord(userId: string, dateKey: string) {
  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("user_id", userId)
    .eq("date_key", dateKey)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      date_key: dateKey,
      ...EMPTY_DAILY_RECORD,
    };
  }

  return {
    date_key: dateKey,
    morning: data.morning ?? {},
    emotions: data.emotions ?? EMPTY_DAILY_RECORD.emotions,
    tasks: data.tasks ?? [],
    financial: data.financial ?? {},
    people: data.people ?? [],
    evening: data.evening ?? {},
    sos: data.sos ?? {},
    habits_completed: data.habits_completed ?? [],
    closed: Boolean(data.closed),
  };
}

export async function saveDailyRecord(
  userId: string,
  dateKey: string,
  patch: Partial<DailyRecord>,
) {
  const current = await getDailyRecord(userId, dateKey);

  const next = {
    morning: patch.morning ?? current.morning,
    emotions: patch.emotions ?? current.emotions,
    tasks: patch.tasks ?? current.tasks,
    financial: patch.financial ?? current.financial,
    people: patch.people ?? current.people,
    evening: patch.evening ?? current.evening,
    sos: patch.sos ?? current.sos,
    habits_completed: patch.habits_completed ?? current.habits_completed,
    closed: patch.closed ?? current.closed,
  };

  const { error } = await supabase.from("daily_records").upsert(
    {
      user_id: userId,
      date_key: dateKey,
      ...next,
    },
    {
      onConflict: "user_id,date_key",
    },
  );

  if (error) throw error;

  return next;
}

export async function getUserHabits(userId: string) {
  const { data, error } = await supabase
    .from("user_habits")
    .select("habits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data?.habits ?? [];
}

export async function saveUserHabits(userId: string, habits: any[]) {
  const { error } = await supabase.from("user_habits").upsert(
    {
      user_id: userId,
      habits,
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) throw error;
}

export async function getWeeklyMeta(userId: string, weekKey: string) {
  const { data, error } = await supabase
    .from("weekly_meta")
    .select("virtue, closing")
    .eq("user_id", userId)
    .eq("week_key", weekKey)
    .maybeSingle();

  if (error) throw error;

  return {
    virtue: data?.virtue ?? "",
    closing: data?.closing ?? {},
  };
}

export async function saveWeeklyMeta(
  userId: string,
  weekKey: string,
  patch: Partial<WeeklyMetaRecord>,
) {
  const current = await getWeeklyMeta(userId, weekKey);

  const next = {
    virtue: patch.virtue ?? current.virtue,
    closing: patch.closing ?? current.closing,
  };

  const { error } = await supabase.from("weekly_meta").upsert(
    {
      user_id: userId,
      week_key: weekKey,
      ...next,
    },
    {
      onConflict: "user_id,week_key",
    },
  );

  if (error) throw error;

  return next;
}
