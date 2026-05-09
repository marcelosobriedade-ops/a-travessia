export type SosTrigger =
  | "impulso"
  | "ansiedade"
  | "raiva"
  | "tristeza"
  | "confusao"
  | "desistir"
  | "outro"
  | "";

export type SosEntry = {
  trigger: SosTrigger;
  intensity: number;
  notes: string;
  safeAction: string;
  createdAt: string;
  groundingSee: string;
  groundingTouch: string;
  groundingHear: string;
  groundingSmell: string;
  groundingTaste: string;
  outcome: "better" | "hard" | "support" | "";
};

export const EMPTY_SOS_ENTRY: SosEntry = {
  trigger: "",
  intensity: 5,
  notes: "",
  safeAction: "",
  createdAt: "",
  groundingSee: "",
  groundingTouch: "",
  groundingHear: "",
  groundingSmell: "",
  groundingTaste: "",
  outcome: "",
};

export function getSosStatus(
  entry: SosEntry,
): "Pendente" | "Em andamento" | "Completo" {
  const filledCount = [
    entry.trigger,
    entry.notes.trim(),
    entry.safeAction.trim(),
  ].filter(Boolean).length;

  if (filledCount === 0) return "Pendente";
  if (filledCount === 3) return "Completo";
  return "Em andamento";
}
