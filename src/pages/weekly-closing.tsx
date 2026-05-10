import React, { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Header } from "@/components/header";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import {
  WeeklyPlan,
  EMPTY_WEEKLY_PLAN,
  getWeekEndKeyFromDate,
  getWeekKeyFromDate,
} from "@/lib/weekly-plan";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getWeekSummary } from "@/lib/history";
import { CheckCircle2, MoonStar, Circle } from "lucide-react";

type WeeklyClosing = {
  origin: string;
  construction: string;
  patterns: string;
  growth: string;
  identity: string;
  release: string;
  carryForward: string;
  nextFocus: string;
};

const EMPTY_WEEKLY_CLOSING: WeeklyClosing = {
  origin: "",
  construction: "",
  patterns: "",
  growth: "",
  identity: "",
  release: "",
  carryForward: "",
  nextFocus: "",
};

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

function formatWeekRange(startKey: string, endKey: string) {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);

  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const startLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(start);

  const endLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(end);

  return `${startLabel} → ${endLabel}`;
}

export default function WeeklyClosingPage() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const weekKey = getWeekKeyFromDate(dateKey);
  const weekEndKey = getWeekEndKeyFromDate(dateKey);

  const [weeklyPlan, setWeeklyPlan] =
    React.useState<WeeklyPlan>(EMPTY_WEEKLY_PLAN);
  const [closing, setClosing] = useLocalStorage<WeeklyClosing>(
    `weekly-closing-${weekKey}`,
    EMPTY_WEEKLY_CLOSING,
  );

  useEffect(() => {
    loadWeeklyPlan();
  }, [weekKey]);

  const loadWeeklyPlan = async () => {
    const { data, error } = await supabase
      .from("weekly_meta")
      .select("plan")
      .eq("week_key", weekKey)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar plano semanal no fechamento:", error);
      setWeeklyPlan(EMPTY_WEEKLY_PLAN);
      return;
    }

    if (data?.plan) {
      setWeeklyPlan(data.plan as WeeklyPlan);
    } else {
      setWeeklyPlan(EMPTY_WEEKLY_PLAN);
    }
  };

  const proofs = parseProofs(weeklyPlan.proofs);
  const completedProofs = proofs.filter((proof) => proof.checked);
  const pendingProofs = proofs.filter((proof) => !proof.checked);

  const weekSummary = getWeekSummary(weekKey);
  const closedDays = weekSummary?.closedDays ?? 0;
  const eveningDays = weekSummary?.eveningDays ?? 0;
  const completedTasks = weekSummary?.completedTasks ?? 0;
  const totalTasks = weekSummary?.totalTasks ?? 0;

  function setField<K extends keyof WeeklyClosing>(
    key: K,
    value: WeeklyClosing[K],
  ) {
    setClosing({ ...closing, [key]: value });
  }

  return (
    <Layout>
      <Header title="Fechamento semanal" />

      <div className="flex-1 p-6 flex flex-col gap-8 overflow-y-auto pb-12">
        <section className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Ciclo da semana
            </p>
            <h2 className="text-2xl font-serif text-foreground mt-2">
              {formatWeekRange(weekKey, weekEndKey)}
            </h2>
          </div>

          {weeklyPlan.change && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Mudança da semana
              </p>
              <p className="text-sm text-foreground">{weeklyPlan.change}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/50 bg-card p-4">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-widest text-primary/70">
              Leitura do ciclo
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Antes de fechar, veja o que realmente aconteceu nesta semana.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Marcos tocados"
              value={`${completedProofs.length}/${proofs.length}`}
            />
            <MiniStat label="Dias encerrados" value={`${closedDays}/7`} />
            <MiniStat label="Noites preenchidas" value={`${eveningDays}/7`} />
            <MiniStat
              label="Tarefas concluídas"
              value={`${completedTasks}/${totalTasks}`}
            />
          </div>

          {completedProofs.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Provas tocadas
              </p>

              <div className="space-y-2">
                {completedProofs.map((proof, index) => (
                  <div
                    key={`${proof.text}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-3 py-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <p className="text-sm text-foreground">{proof.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingProofs.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Provas ainda pendentes
              </p>

              <div className="space-y-2">
                {pendingProofs.map((proof, index) => (
                  <div
                    key={`${proof.text}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-border/40 bg-background px-3 py-2"
                  >
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-sm text-foreground">{proof.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedProofs.length === 0 && pendingProofs.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma prova foi definida nesta semana.
            </p>
          )}
        </section>

        <p className="text-center font-serif text-muted-foreground italic">
          “Vou olhar minha vida com verdade.”
        </p>

        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              1. Olhar para trás
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Recuperar o caminho e reconhecer a construção.
            </p>
          </div>

          <ClosingField
            id="origin"
            label="De onde eu saí?"
            placeholder="Como eu estava no começo? O que estava difícil? O que eu estava evitando?"
            value={closing.origin}
            onChange={(v) => setField("origin", v)}
          />

          <ClosingField
            id="construction"
            label="O que eu construí?"
            placeholder="O que eu fiz mesmo sem vontade? Onde fui firme? O que sustentei?"
            value={closing.construction}
            onChange={(v) => setField("construction", v)}
          />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              2. Ler padrões
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Ver o que ajudou, o que atrapalhou e onde ainda preciso crescer.
            </p>
          </div>

          <ClosingField
            id="patterns"
            label="O que eu preciso manter / evitar?"
            placeholder="O que funcionou? O que me ajudou? O que me atrapalhou?"
            value={closing.patterns}
            onChange={(v) => setField("patterns", v)}
          />

          <ClosingField
            id="growth"
            label="Onde preciso crescer?"
            placeholder="Onde ainda estou fraco? O que ainda evito?"
            value={closing.growth}
            onChange={(v) => setField("growth", v)}
          />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              3. Integrar e soltar
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Reconhecer quem eu me tornei e liberar o que ficou.
            </p>
          </div>

          <ClosingField
            id="identity"
            label="Quem eu me tornei?"
            placeholder="Estou mais disciplinado? Mais consciente? Mais presente?"
            value={closing.identity}
            onChange={(v) => setField("identity", v)}
          />

          <ClosingField
            id="release"
            label="O que eu escolho soltar?"
            placeholder="Culpa, erros, frustrações, pesos desnecessários..."
            value={closing.release}
            onChange={(v) => setField("release", v)}
          />
        </section>

        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-primary/70">
              4. Fechar e seguir
            </h2>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Consolidar o ciclo e apontar a próxima direção.
            </p>
          </div>

          <ClosingField
            id="carryForward"
            label="O que eu levo para o próximo ciclo?"
            placeholder="O que mudou em mim? O que eu não quero mais voltar a ser? O que segue comigo?"
            value={closing.carryForward}
            onChange={(v) => setField("carryForward", v)}
          />

          <ClosingField
            id="nextFocus"
            label="Próximo foco"
            placeholder="Uma direção clara e simples para o próximo ciclo."
            value={closing.nextFocus}
            onChange={(v) => setField("nextFocus", v)}
          />
        </section>
      </div>
    </Layout>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background px-3 py-3">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-serif text-foreground mt-1">{value}</p>
    </div>
  );
}

function ClosingField({
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
