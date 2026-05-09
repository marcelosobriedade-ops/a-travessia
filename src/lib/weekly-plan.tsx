export type WeeklyPlan = {
  change: string;
  proofs: string;
  sunday: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  why: string;
  importance: number;
  confidence: number;
  risks: string;
  prevention: string;
  when: string;
  where: string;
  tracking: string;
};

export const EMPTY_WEEKLY_PLAN: WeeklyPlan = {
  change: "",
  proofs: "",
  sunday: "",
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  why: "",
  importance: 5,
  confidence: 5,
  risks: "",
  prevention: "",
  when: "",
  where: "",
  tracking: "",
};

export function getWeekKeyFromDate(dateKey: string): string {
  const date = new Date(dateKey + "T12:00:00");
  const day = date.getDay(); // 0 = domingo, 6 = sábado

  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);

  return sunday.toISOString().slice(0, 10);
}

export function getWeekEndKeyFromDate(dateKey: string): string {
  const weekStart = new Date(getWeekKeyFromDate(dateKey) + "T12:00:00");
  const saturday = new Date(weekStart);
  saturday.setDate(weekStart.getDate() + 6);
  return saturday.toISOString().slice(0, 10);
}

export function isStartOfWeek(dateKey: string): boolean {
  const date = new Date(dateKey + "T12:00:00");
  return date.getDay() === 0;
}

export function isEndOfWeek(dateKey: string): boolean {
  const date = new Date(dateKey + "T12:00:00");
  return date.getDay() === 6;
}

export function getWeeklyPlanStatus(
  plan: WeeklyPlan,
): "Pendente" | "Em andamento" | "Completo" {
  const filledCount = [
    plan.change.trim(),
    plan.proofs.trim(),
    plan.sunday.trim(),
    plan.monday.trim(),
    plan.tuesday.trim(),
    plan.wednesday.trim(),
    plan.thursday.trim(),
    plan.friday.trim(),
    plan.saturday.trim(),
    plan.risks.trim(),
    plan.prevention.trim(),
  ].filter(Boolean).length;

  if (filledCount === 0) return "Pendente";
  if (filledCount >= 9) return "Completo";
  return "Em andamento";
}
