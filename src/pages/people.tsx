import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";

type StorageMode = "supabase" | "local";

interface Interaction {
  id: string;
  name: string;
  context: string;
  observed: string;
  learned: string;
  nextStep: string;
  boundary: string;
}

const emptyForm = (): Omit<Interaction, "id"> => ({
  name: "",
  context: "",
  observed: "",
  learned: "",
  nextStep: "",
  boundary: "",
});

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeInteractions(value: any): Interaction[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => ({
    id:
      typeof item?.id === "string"
        ? item.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: typeof item?.name === "string" ? item.name : "",
    context: typeof item?.context === "string" ? item.context : "",
    observed: typeof item?.observed === "string" ? item.observed : "",
    learned: typeof item?.learned === "string" ? item.learned : "",
    nextStep: typeof item?.nextStep === "string" ? item.nextStep : "",
    boundary: typeof item?.boundary === "string" ? item.boundary : "",
  }));
}

function hasAnyInteractions(interactions: Interaction[]) {
  return Array.isArray(interactions) && interactions.length > 0;
}

function getLegacyPeople(dateKey: string) {
  return normalizeInteractions(
    safeJsonParse(localStorage.getItem(`${dateKey}-people`), []),
  );
}

function saveLegacyPeople(dateKey: string, interactions: Interaction[]) {
  localStorage.setItem(`${dateKey}-people`, JSON.stringify(interactions));
}

function InteractionCard({
  interaction,
  onDelete,
}: {
  interaction: Interaction;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const fields: { label: string; value: string }[] = [
    { label: "Contexto", value: interaction.context },
    { label: "O que observei", value: interaction.observed },
    { label: "O que aprendi", value: interaction.learned },
    { label: "Proximo passo", value: interaction.nextStep },
    { label: "Limite ou acao futura", value: interaction.boundary },
  ].filter((f) => f.value.trim() !== "");

  return (
    <div className="bg-card border border-border/40 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div>
          <p className="font-serif text-lg font-medium text-foreground leading-snug">
            {interaction.name}
          </p>
          {interaction.context && !open && (
            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[220px]">
              {interaction.context}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(interaction.id);
            }}
            className="p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors rounded-lg hover:bg-muted"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {open && fields.length > 0 && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/20 pt-3">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                {label}
              </p>
              <p className="text-sm text-foreground leading-relaxed">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function People() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

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

        let nextInteractions = normalizeInteractions(daily.people);
        const legacyInteractions = getLegacyPeople(dateKey);

        if (
          !hasAnyInteractions(nextInteractions) &&
          hasAnyInteractions(legacyInteractions)
        ) {
          nextInteractions = legacyInteractions;
          await saveDailyRecord(uid, dateKey, { people: nextInteractions });
        }

        if (cancelled) return;

        setInteractions(nextInteractions);
        saveLegacyPeople(dateKey, nextInteractions);
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Pessoas está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyInteractions = getLegacyPeople(dateKey);

        setUserId(null);
        setStorageMode("local");
        setInteractions(legacyInteractions);
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
            people: interactions,
          });
        }

        saveLegacyPeople(dateKey, interactions);
      } catch (error) {
        console.error("Erro ao salvar pessoas:", error);
      }
    };

    save();
  }, [interactions, hasLoaded, storageMode, userId, dateKey]);

  const setField = (field: keyof Omit<Interaction, "id">, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setInteractions((prev) => [
      {
        id: Date.now().toString(),
        ...form,
      },
      ...prev,
    ]);

    setForm(emptyForm());
    setShowForm(false);
  };

  const deleteInteraction = (id: string) => {
    setInteractions((prev) => prev.filter((i) => i.id !== id));
  };

  const filtered = interactions.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();

    return (
      i.name.toLowerCase().includes(q) ||
      i.context.toLowerCase().includes(q) ||
      i.observed.toLowerCase().includes(q) ||
      i.learned.toLowerCase().includes(q) ||
      i.nextStep.toLowerCase().includes(q) ||
      i.boundary.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      <Header title="Pessoas" />
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto pb-12">
        <p className="text-center font-serif text-muted-foreground italic text-sm leading-relaxed">
          "Hoje encontrarei pessoas que me desafiam. Estou preparado."
        </p>

        {interactions.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, contexto..."
              className="pl-9 bg-card border-border/40 rounded-xl focus-visible:ring-1 focus-visible:ring-primary placeholder:text-muted-foreground/40"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm font-medium transition-all",
            showForm
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-card border-border/40 text-muted-foreground hover:bg-muted/50 hover:border-border/70",
          )}
        >
          <Plus
            className={cn(
              "w-4 h-4 transition-transform",
              showForm && "rotate-45",
            )}
          />
          {showForm ? "Cancelar" : "Registrar interacao"}
        </button>

        {showForm && (
          <form
            onSubmit={addInteraction}
            className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm space-y-4"
          >
            {(
              [
                {
                  field: "name",
                  label: "Nome",
                  placeholder: "Quem foi?",
                  required: true,
                },
                {
                  field: "context",
                  label: "Contexto",
                  placeholder: "Onde / como se encontraram?",
                },
                {
                  field: "observed",
                  label: "O que observei",
                  placeholder: "Comportamento, energia, atitude...",
                },
                {
                  field: "learned",
                  label: "O que aprendi",
                  placeholder: "Insight ou reflexao...",
                },
                {
                  field: "nextStep",
                  label: "Proximo passo",
                  placeholder: "Acao concreta para a proxima vez...",
                },
                {
                  field: "boundary",
                  label: "Limite ou acao futura",
                  placeholder: "Algo a considerar com cuidado...",
                },
              ] as {
                field: keyof Omit<Interaction, "id">;
                label: string;
                placeholder: string;
                required?: boolean;
              }[]
            ).map(({ field, label, placeholder, required }) => (
              <div key={field}>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                  {label}
                  {required && " *"}
                </p>
                {field === "name" ||
                field === "context" ||
                field === "nextStep" ||
                field === "boundary" ? (
                  <Input
                    value={form[field]}
                    onChange={(e) => setField(field, e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 h-9 text-sm"
                  />
                ) : (
                  <Textarea
                    value={form[field]}
                    onChange={(e) => setField(field, e.target.value)}
                    placeholder={placeholder}
                    className="resize-none bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 min-h-[56px] text-sm placeholder:text-muted-foreground/40"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!form.name.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Registrar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {filtered.length > 0 ? (
            filtered.map((i) => (
              <InteractionCard
                key={i.id}
                interaction={i}
                onDelete={deleteInteraction}
              />
            ))
          ) : search.trim() ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground/50">
              <Users className="w-10 h-10 stroke-[1.5] opacity-50" />
              <p className="font-serif italic text-center">
                Nenhuma pessoa encontrada.
              </p>
            </div>
          ) : !showForm ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground/50">
              <Users className="w-10 h-10 stroke-[1.5] opacity-50" />
              <p className="font-serif italic text-center">
                Nenhuma interacao registrada hoje.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
