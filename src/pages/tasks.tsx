import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getCurrentDateKey } from "@/lib/date";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Circle,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCurrentUserId,
  getDailyRecord,
  saveDailyRecord,
} from "@/lib/user-data";

type StorageMode = "supabase" | "local";
type TaskStatus = "todo" | "done" | "cancelled" | "critical" | "postponed";

interface Task {
  id: string;
  title: string;
  category: string;
  status: TaskStatus;
  type?: "task" | "event";
  time?: string;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "A fazer" },
  { value: "done", label: "Feita" },
  { value: "critical", label: "Crítica" },
  { value: "postponed", label: "Adiada" },
  { value: "cancelled", label: "Cancelada" },
];

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTasks(value: any): Task[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const safeStatus: TaskStatus =
      item?.status === "todo" ||
      item?.status === "done" ||
      item?.status === "cancelled" ||
      item?.status === "critical" ||
      item?.status === "postponed"
        ? item.status
        : "todo";

    return {
      id:
        typeof item?.id === "string"
          ? item.id
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: typeof item?.title === "string" ? item.title : "",
      category: typeof item?.category === "string" ? item.category : "",
      status: safeStatus,
      type: item?.type === "event" ? "event" : "task",
      time: typeof item?.time === "string" ? item.time : "",
    };
  });
}

function hasAnyTasks(tasks: Task[]) {
  return Array.isArray(tasks) && tasks.length > 0;
}

function getLegacyTasks(dateKey: string) {
  return normalizeTasks(
    safeJsonParse(localStorage.getItem(`${dateKey}-tasks`), []),
  );
}

function saveLegacyTasks(dateKey: string, tasks: Task[]) {
  localStorage.setItem(`${dateKey}-tasks`, JSON.stringify(tasks));
}

function TaskStatusButton({
  current,
  value,
  label,
  onChange,
}: {
  current: TaskStatus;
  value: TaskStatus;
  label: string;
  onChange: (s: TaskStatus) => void;
}) {
  const selected = current === value;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
        selected
          ? value === "critical"
            ? "bg-rose-600 border-rose-600 text-white shadow-sm"
            : value === "done"
              ? "bg-primary border-primary text-primary-foreground shadow-sm"
              : value === "postponed"
                ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                : value === "cancelled"
                  ? "bg-muted-foreground border-muted-foreground text-background shadow-sm"
                  : "bg-foreground border-foreground text-background shadow-sm"
          : "bg-card border-border/40 text-muted-foreground hover:bg-muted/70",
      )}
    >
      {label}
    </button>
  );
}

function TaskItem({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "bg-card border rounded-xl shadow-sm overflow-hidden transition-all",
        task.status === "critical" && "border-rose-300/60 bg-rose-50/40",
        task.status === "done" && "opacity-60 border-border/20",
        task.status === "cancelled" && "opacity-40 border-border/20",
        task.status === "postponed" && "border-amber-300/50 bg-amber-50/30",
        task.status === "todo" && "border-border/40",
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() =>
            onStatusChange(task.id, task.status === "done" ? "todo" : "done")
          }
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
            task.status === "done"
              ? "bg-primary border-primary text-primary-foreground"
              : task.status === "critical"
                ? "border-rose-500 text-rose-500"
                : "border-primary/40 hover:border-primary text-transparent",
          )}
        >
          {task.status === "critical" ? (
            <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
          ) : (
            <Check className="w-3 h-3" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-foreground leading-snug",
                task.status === "done" && "line-through text-muted-foreground",
                task.status === "cancelled" &&
                  "line-through text-muted-foreground",
              )}
            >
              {task.title}
            </p>

            {task.time && (
              <span className="text-xs text-muted-foreground block">
                {task.time}
              </span>
            )}

            <div className="flex items-center gap-2 mt-0.5">
              {task.category && (
                <p className="text-xs text-muted-foreground/70">
                  {task.category}
                </p>
              )}

              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                  task.status === "done" &&
                    "text-primary/70 border-primary/20 bg-primary/5",
                  task.status === "critical" &&
                    "text-rose-600 border-rose-300/50 bg-rose-50/40",
                  task.status === "postponed" &&
                    "text-amber-600 border-amber-300/50 bg-amber-50/30",
                  task.status === "cancelled" &&
                    "text-muted-foreground/50 border-border/20",
                  task.status === "todo" &&
                    "text-muted-foreground/50 border-border/20",
                )}
              >
                {STATUS_OPTIONS.find((o) => o.value === task.status)?.label}
              </span>
            </div>
          </div>

          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="flex-shrink-0 p-1.5 text-muted-foreground/40 hover:text-destructive transition-colors rounded-lg hover:bg-muted"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 flex flex-wrap gap-1.5 border-t border-border/20 pt-3">
          {STATUS_OPTIONS.map((opt) => (
            <TaskStatusButton
              key={opt.value}
              current={task.status}
              value={opt.value}
              label={opt.label}
              onChange={(s) => onStatusChange(task.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Tasks() {
  const [dateKey] = useLocalStorage<string>(
    "planner-selected-date",
    getCurrentDateKey(),
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");

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

        let nextTasks = normalizeTasks(daily.tasks);
        const legacyTasks = getLegacyTasks(dateKey);

        if (!hasAnyTasks(nextTasks) && hasAnyTasks(legacyTasks)) {
          nextTasks = legacyTasks;
          await saveDailyRecord(uid, dateKey, { tasks: nextTasks });
        }

        if (cancelled) return;

        setTasks(nextTasks);
        saveLegacyTasks(dateKey, nextTasks);
        setHasLoaded(true);
      } catch (error) {
        console.warn(
          "Sem usuário autenticado. Tarefas está usando armazenamento local.",
          error,
        );

        if (cancelled) return;

        const legacyTasks = getLegacyTasks(dateKey);

        setUserId(null);
        setStorageMode("local");
        setTasks(legacyTasks);
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
          await saveDailyRecord(userId, dateKey, { tasks });
        }

        saveLegacyTasks(dateKey, tasks);
      } catch (error) {
        console.error("Erro ao salvar tarefas:", error);
      }
    };

    save();
  }, [tasks, hasLoaded, storageMode, userId, dateKey]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: title.trim(),
        category: category.trim(),
        status: "todo",
        time,
        type: "task",
      },
    ]);

    setTitle("");
    setTime("");
    setCategory("");
  };

  const updateStatus = (id: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  const priorities = sortedTasks.filter((t) => t.status === "critical");

  const others = sortedTasks.filter(
    (t) => t.status !== "critical" && t.status !== "postponed",
  );

  const postponed = sortedTasks.filter((t) => t.status === "postponed");

  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <Layout>
      <Header title="Tarefas" />

      <div className="flex-1 flex flex-col p-6 overflow-y-auto gap-8">
        <div className="flex items-end justify-between">
          <p className="font-serif italic text-muted-foreground">
            Deveres do dia.
          </p>

          {tasks.length > 0 && (
            <p className="text-xs font-medium tracking-widest text-primary/70 uppercase">
              {done}/{tasks.length} feitas
            </p>
          )}
        </div>

        <form
          onSubmit={addTask}
          className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm space-y-3"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa"
            className="bg-transparent border-b border-0 border-border/50 rounded-none focus-visible:ring-0 px-0 h-10 text-base"
          />

          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />

          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria (opcional)"
            className="bg-transparent border-b border-0 border-border/40 rounded-none focus-visible:ring-0 px-0 h-9 text-sm text-muted-foreground"
          />

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </form>

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-3 py-10">
            <Circle className="w-10 h-10 stroke-[1.5]" />
            <p className="font-serif italic">Nenhuma tarefa para hoje</p>
          </div>
        )}

        {priorities.length > 0 && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-widest text-rose-600 mb-3">
              Prioridades
            </h3>
            <div className="space-y-2">
              {priorities.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </section>
        )}

        {others.length > 0 && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
              Outras tarefas
            </h3>
            <div className="space-y-2">
              {others.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </section>
        )}

        {postponed.length > 0 && (
          <section>
            <h3 className="text-xs font-medium uppercase tracking-widest text-amber-600 mb-3">
              Adiados
            </h3>
            <div className="space-y-2">
              {postponed.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </section>
        )}

        <p className="text-center text-xs text-muted-foreground/40 italic font-serif pb-4">
          Toque numa tarefa para mudar o status.
        </p>
      </div>
    </Layout>
  );
}
