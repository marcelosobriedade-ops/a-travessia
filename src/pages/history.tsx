import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Wallet,
  Smile,
  BookOpen,
  Home,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { getCurrentDateKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { DaySummary, WeekSummary, getWeekSummaries } from "@/lib/history";

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function readWeeklyClosing(weekKey: string): WeeklyClosing | null {
  try {
    const raw = localStorage.getItem(`weekly-closing-${weekKey}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as WeeklyClosing;
    const hasContent = Object.values(parsed).some(
      (value) => (value ?? "").trim() !== "",
    );

    return hasContent ? parsed : null;
  } catch {
    return null;
  }
}

function DayRow({ summary }: { summary: DaySummary }) {
  const isToday = summary.dateKey === getCurrentDateKey();

  return (
    <Link href={`/historico/${summary.dateKey}`}>
      <div
        className={cn(
          "bg-background border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer",
          isToday ? "border-primary/40" : "border-border/40",
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-0.5">
              {summary.dateKey}
            </p>
            <h3 className="font-serif text-base text-foreground capitalize leading-tight">
              {summary.formattedDate.split(",").slice(0, 2).join(",")}
            </h3>
          </div>

          {isToday && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Hoje
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            <span>
              {summary.priorities.length > 0
                ? `${summary.priorities.length} prioridade${summary.priorities.length > 1 ? "s" : ""}`
                : "Sem prioridades"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckSquare className="w-4 h-4 flex-shrink-0" />
            <span>
              {summary.tasks.total > 0
                ? `${summary.tasks.done}/${summary.tasks.total} tarefas`
                : "Sem tarefas"}
            </span>
          </div>

          <div
            className={cn(
              "flex items-center gap-2 text-sm",
              summary.balance > 0
                ? "text-emerald-700"
                : summary.balance < 0
                  ? "text-rose-700"
                  : "text-muted-foreground",
            )}
          >
            <Wallet className="w-4 h-4 flex-shrink-0" />
            <span>{formatCurrency(summary.balance)}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Smile className="w-4 h-4 flex-shrink-0" />
            <span>{summary.eveningEmotion ?? "Sem emoção"}</span>
          </div>
        </div>

        {(summary.eveningDone || summary.closed) && (
          <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-3 flex-wrap">
            {summary.eveningDone && (
              <span className="text-xs text-muted-foreground/70 italic font-serif">
                Reflexão noturna registrada
              </span>
            )}
            {summary.closed && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary/70">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dia encerrado
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function WeekCard({
  week,
  defaultOpen = false,
}: {
  week: WeekSummary;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const weeklyClosing = useMemo(
    () => readWeeklyClosing(week.weekKey),
    [week.weekKey],
  );

  return (
    <section className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
              Semana
            </p>
            <h2 className="font-serif text-xl text-foreground">{week.label}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {week.weekKey} até {week.weekEndKey}
            </p>
          </div>

          <div className="pt-1 text-muted-foreground">
            {open ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {weeklyClosing ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fechamento preenchido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-background text-muted-foreground border border-border/40">
              Fechamento pendente
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-5 pt-5 border-t border-border/30 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Dias com registro" value={`${week.dayCount}/7`} />
            <MiniStat label="Dias encerrados" value={`${week.closedDays}/7`} />
            <MiniStat
              label="Noites preenchidas"
              value={`${week.eveningDays}/7`}
            />
            <MiniStat
              label="Tarefas"
              value={`${week.completedTasks}/${week.totalTasks}`}
            />
          </div>

          {weeklyClosing && (
            <section className="rounded-2xl border border-border/40 bg-background p-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Fechamento da semana
                </p>
              </div>

              {weeklyClosing.nextFocus.trim() && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                    Próximo foco
                  </p>
                  <p className="text-sm text-foreground font-serif">
                    {weeklyClosing.nextFocus}
                  </p>
                </div>
              )}

              {weeklyClosing.carryForward.trim() && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                    O que levo comigo
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {weeklyClosing.carryForward}
                  </p>
                </div>
              )}
            </section>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Dias da semana
            </p>
            <p
              className={cn(
                "text-xs font-medium",
                week.balance > 0
                  ? "text-emerald-700"
                  : week.balance < 0
                    ? "text-rose-700"
                    : "text-muted-foreground",
              )}
            >
              Saldo: {formatCurrency(week.balance)}
            </p>
          </div>

          <div className="space-y-3">
            {week.days.map((day) => (
              <DayRow key={day.dateKey} summary={day} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/30 bg-background px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-serif text-foreground mt-1">{value}</p>
    </div>
  );
}

export default function History() {
  const weeks = useMemo(() => getWeekSummaries(), []);

  const currentWeekKey = useMemo(() => {
    const today = getCurrentDateKey();
    const currentWeek = weeks.find((week) =>
      week.days.some((day) => day.dateKey === today),
    );
    return currentWeek?.weekKey ?? weeks[0]?.weekKey ?? null;
  }, [weeks]);

  return (
    <Layout>
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md pb-4 pt-6 px-6 border-b border-border/40">
        <div className="flex items-center justify-between mb-1">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Registros
          </span>

          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors p-2 -mr-2 rounded-full hover:bg-muted/50"
            title="Voltar ao dia atual"
          >
            <Home className="w-5 h-5" />
          </Link>
        </div>

        <h1 className="text-2xl font-serif text-center mt-2">Histórico</h1>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        {weeks.length === 0 ? (
          <div className="h-60 flex flex-col items-center justify-center text-center space-y-4">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 stroke-[1.5]" />
            <div className="space-y-1">
              <p className="font-serif text-xl text-foreground/60">
                Nenhum registro ainda
              </p>
              <p className="text-sm text-muted-foreground/60">
                As suas semanas aparecerão aqui conforme forem vividas.
              </p>
            </div>
            <Link href="/">
              <span className="text-sm text-primary underline underline-offset-4">
                Começar hoje
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-5 pb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-6">
              {weeks.length} semana{weeks.length !== 1 ? "s" : ""} com registros
            </p>

            {weeks.map((week) => (
              <WeekCard
                key={week.weekKey}
                week={week}
                defaultOpen={week.weekKey === currentWeekKey}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
