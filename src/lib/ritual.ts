export interface MorningRitual {
  feeling: string;
  control: string;
  virtueOfDay: string;
  challenges: string;
  actions: string;
  priorities: [string, string, string];
  mode: "productive" | "normal" | "survival" | "";
}

export const EMPTY_MORNING_RITUAL: MorningRitual = {
  feeling: "",
  control: "",
  virtueOfDay: "",
  challenges: "",
  actions: "",
  priorities: ["", "", ""],
  mode: "",
};

export interface NightRitual {
  learning: string;
  improve: string;
  wins: string;
  feeling: string;
  value: string;
}

export const EMPTY_NIGHT_RITUAL: NightRitual = {
  learning: "",
  improve: "",
  wins: "",
  feeling: "",
  value: "",
};

export type RitualStatus = "Pendente" | "Em andamento" | "Completo";

export function getMorningStatus(r: MorningRitual): RitualStatus {
  const reflections = [
    r.feeling,
    r.control,
    r.virtueOfDay,
    r.challenges,
    r.actions,
  ];
  const filled = reflections.filter((v) => v.trim() !== "").length;
  const hasPriority = r.priorities.some((p) => p.trim() !== "");
  if (filled === 0 && !hasPriority && r.mode === "") return "Pendente";
  if (filled === reflections.length && hasPriority && r.mode !== "")
    return "Completo";
  return "Em andamento";
}

export function getNightStatus(r: NightRitual): RitualStatus {
  const fields = [r.learning, r.improve, r.wins, r.feeling, r.value];
  const filled = fields.filter((v) => v.trim() !== "").length;
  if (filled === 0) return "Pendente";
  if (filled === fields.length) return "Completo";
  return "Em andamento";
}

export function getWeekKey(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  return sunday.toISOString().slice(0, 10);
}
