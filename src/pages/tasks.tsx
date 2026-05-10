import React, { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { Layout } from "@/components/layout";
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

function normalizeTasks(value: any): Task[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => ({
    id: item?.id || `${Date.now()}-${Math.random()}`,
    title: item?.title || "",
    category: item?.category || "",
    status: item?.status || "todo",
    type: item?.type || "task",
    time: item?.time || "",
  }));
}

export default function Tasks() {
  const [dateKey] = useState(getCurrentDateKey());

  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔥 LOAD 100% SUPABASE
  useEffect(() => {
    const load = async () => {
      try {
        const uid = await getCurrentUserId();
        setUserId(uid);

        const daily = await getDailyRecord(uid, dateKey);
        setTasks(normalizeTasks(daily.tasks));
      } catch (err) {
        console.error("Erro ao carregar tarefas:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [dateKey]);

  // 🔥 SAVE 100% SUPABASE
  useEffect(() => {
    if (!userId || loading) return;

    const save = async () => {
      try {
        await saveDailyRecord(userId, dateKey, { tasks });
      } catch (err) {
        console.error("Erro ao salvar tarefas:", err);
      }
    };

    save();
  }, [tasks, userId, loading, dateKey]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title: title.trim(),
        category,
        status: "todo",
        time,
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

  if (loading) {
    return (
      <Layout>
        <Header title="Tarefas" />
        <div className="p-6">Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Tarefas" />

      <div className="flex-1 flex flex-col p-6 gap-6">
        <form onSubmit={addTask} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa"
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria"
          />

          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded"
          >
            <Plus className="w-4 h-4 inline" /> Adicionar
          </button>
        </form>

        {tasks.length === 0 && (
          <div className="text-center text-muted-foreground">
            <Circle className="mx-auto mb-2" />
            Nenhuma tarefa
          </div>
        )}

        {tasks.map((task) => (
          <div
            key={task.id}
            className="border p-3 rounded flex justify-between"
          >
            <span>{task.title}</span>

            <div className="flex gap-2">
              <button onClick={() => updateStatus(task.id, "done")}>
                <Check />
              </button>
              <button onClick={() => deleteTask(task.id)}>
                <Trash2 />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
